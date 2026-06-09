import { Request, Response } from 'express';
import { prisma, PaymentStatus, PaymentGateway, OrderStatus, RefundStatus } from '@alphastryk/db';
import crypto from 'crypto';
import Razorpay from 'razorpay';
import { createInvoiceForOrder } from './invoice';

// Audit logging helper
const logAuditEvent = async (
  actorId: string | null,
  action: string,
  entityType: string,
  entityId: string | null,
  oldValues: any = null,
  newValues: any = null,
  req?: Request
) => {
  try {
    await prisma.auditLog.create({
      data: {
        actorId,
        action,
        entityType,
        entityId,
        oldValues: oldValues ? JSON.parse(JSON.stringify(oldValues)) : null,
        newValues: newValues ? JSON.parse(JSON.stringify(newValues)) : null,
        ipAddress: req?.ip || req?.socket?.remoteAddress || null,
        userAgent: req?.headers['user-agent'] || null,
      },
    });
  } catch (error) {
    console.error('Failed to write audit log in payment controller:', error);
  }
};

// Initialize Razorpay
const getRazorpayInstance = () => {
  const keyId = process.env.RAZORPAY_KEY_ID || 'rzp_test_mockkeyid123';
  const keySecret = process.env.RAZORPAY_KEY_SECRET || 'mocksecretkey123';
  return new Razorpay({
    key_id: keyId,
    key_secret: keySecret,
  });
};

const isRazorpayConfigured = () => {
  return (
    process.env.RAZORPAY_KEY_ID &&
    process.env.RAZORPAY_KEY_ID !== 'rzp_test_mockkeyid123' &&
    process.env.RAZORPAY_KEY_SECRET &&
    process.env.RAZORPAY_KEY_SECRET !== 'mocksecretkey123'
  );
};

const isPhonePeConfigured = () => {
  return (
    process.env.PHONEPE_MERCHANT_ID &&
    process.env.PHONEPE_SALT_KEY &&
    process.env.PHONEPE_SALT_KEY !== 'mock_salt_key'
  );
};

/**
 * Initiate Payment
 * POST /api/v1/payments/initiate
 */
export const initiatePayment = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    const { orderId, gateway } = req.body;

    if (!userId) {
      return res.status(401).json({ success: false, message: 'Authentication required.' });
    }

    if (!orderId || !gateway) {
      return res.status(400).json({ success: false, message: 'OrderId and gateway (RAZORPAY | PHONEPE) are required.' });
    }

    if (gateway !== 'RAZORPAY' && gateway !== 'PHONEPE') {
      return res.status(400).json({ success: false, message: 'Invalid payment gateway.' });
    }

    // Fetch order
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: { customer: true },
    });

    if (!order) {
      return res.status(404).json({ success: false, message: 'Order record not found.' });
    }

    if (order.customerId !== userId && req.user?.role !== 'ADMIN' && req.user?.role !== 'SUPER_ADMIN') {
      return res.status(403).json({ success: false, message: 'Forbidden: Access denied.' });
    }

    if (order.status !== 'PENDING') {
      return res.status(400).json({ success: false, message: `Payment cannot be processed for order in ${order.status} state.` });
    }

    const payableAmount = parseFloat(order.payableAmount.toString());

    // 1. Razorpay Flow
    if (gateway === 'RAZORPAY') {
      // Check if we are in mock mode
      if (!isRazorpayConfigured()) {
        const mockTxnId = `MOCK-RZP-${Date.now()}`;
        const mockGatewayOrderId = `order_mock_${Math.floor(Math.random() * 100000)}`;

        const payment = await prisma.payment.create({
          data: {
            orderId: order.id,
            gateway: PaymentGateway.RAZORPAY,
            transactionId: mockTxnId,
            gatewayOrderId: mockGatewayOrderId,
            amount: payableAmount,
            status: PaymentStatus.PENDING,
            rawResponse: { note: 'Mock mode initiated' },
          },
        });

        return res.status(200).json({
          success: true,
          data: {
            gateway: 'RAZORPAY',
            mockMode: true,
            paymentId: payment.id,
            orderId: order.id,
            orderNumber: order.orderNumber,
            payableAmount,
            gatewayOrderId: mockGatewayOrderId,
            keyId: 'rzp_test_mockkeyid123',
          },
        });
      }

      // Live Razorpay order initiation
      const rzp = getRazorpayInstance();
      const options = {
        amount: Math.round(payableAmount * 100), // in paise
        currency: 'INR',
        receipt: order.orderNumber,
      };

      const rzpOrder = await rzp.orders.create(options);

      const payment = await prisma.payment.create({
        data: {
          orderId: order.id,
          gateway: PaymentGateway.RAZORPAY,
          transactionId: rzpOrder.id, // we map to razorpay order ID initially
          gatewayOrderId: rzpOrder.id,
          amount: payableAmount,
          status: PaymentStatus.PENDING,
          rawResponse: JSON.parse(JSON.stringify(rzpOrder)),
        },
      });

      return res.status(200).json({
        success: true,
        data: {
          gateway: 'RAZORPAY',
          mockMode: false,
          paymentId: payment.id,
          orderId: order.id,
          orderNumber: order.orderNumber,
          payableAmount,
          gatewayOrderId: rzpOrder.id,
          keyId: process.env.RAZORPAY_KEY_ID,
        },
      });
    }

    // 2. PhonePe Flow
    if (gateway === 'PHONEPE') {
      const merchantId = process.env.PHONEPE_MERCHANT_ID || 'PGTESTPAYUAT';
      const saltKey = process.env.PHONEPE_SALT_KEY || 'mock_salt_key';
      const saltIndex = process.env.PHONEPE_SALT_INDEX || '1';
      const hostUrl = process.env.PHONEPE_HOST_URL || 'https://api-preprod.phonepe.com/apis/hermes';
      const webAppUrl = process.env.WEB_APP_URL || 'http://localhost:3000';
      const apiAppUrl = process.env.API_APP_URL || 'http://localhost:5000';

      const merchantTransactionId = `TXN-${order.orderNumber}-${Date.now()}`;

      // Check if we are in mock mode
      if (!isPhonePeConfigured()) {
        const payment = await prisma.payment.create({
          data: {
            orderId: order.id,
            gateway: PaymentGateway.PHONEPE,
            transactionId: merchantTransactionId,
            amount: payableAmount,
            status: PaymentStatus.PENDING,
            rawResponse: { note: 'Mock mode initiated' },
          },
        });

        // Return a mock redirect URL that will let the client simulate PhonePe payment callback
        const mockRedirect = `${apiAppUrl}/api/v1/payments/phonepe/callback?transactionId=${merchantTransactionId}&amount=${payableAmount}&status=SUCCESS`;
        return res.status(200).json({
          success: true,
          data: {
            gateway: 'PHONEPE',
            mockMode: true,
            paymentId: payment.id,
            redirectUrl: mockRedirect,
          },
        });
      }

      // Live PhonePe transaction initiation
      const payload = {
        merchantId,
        merchantTransactionId,
        merchantUserId: order.customerId,
        amount: Math.round(payableAmount * 100), // in paise
        redirectUrl: `${apiAppUrl}/api/v1/payments/phonepe/callback`,
        redirectMode: 'POST',
        callbackUrl: `${apiAppUrl}/api/v1/payments/phonepe/webhook`,
        paymentInstrument: {
          type: 'PAY_PAGE',
        },
      };

      const buffer = Buffer.from(JSON.stringify(payload));
      const base64Payload = buffer.toString('base64');
      const verifyString = base64Payload + '/pg/v1/pay' + saltKey;
      const sha256Checksum = crypto.createHash('sha256').update(verifyString).digest('hex');
      const xVerifyHeader = `${sha256Checksum}###${saltIndex}`;

      const response = await fetch(`${hostUrl}/pg/v1/pay`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-VERIFY': xVerifyHeader,
        },
        body: JSON.stringify({ request: base64Payload }),
      });

      const resData: any = await response.json();

      if (response.ok && resData.success) {
        await prisma.payment.create({
          data: {
            orderId: order.id,
            gateway: PaymentGateway.PHONEPE,
            transactionId: merchantTransactionId,
            amount: payableAmount,
            status: PaymentStatus.PENDING,
            rawResponse: JSON.parse(JSON.stringify(resData)),
          },
        });

        const redirectUrl = resData.data.instrumentResponse.redirectInfo.url;
        return res.status(200).json({
          success: true,
          data: {
            gateway: 'PHONEPE',
            mockMode: false,
            redirectUrl,
          },
        });
      } else {
        console.error('PhonePe API Error:', resData);
        return res.status(502).json({ success: false, message: resData.message || 'PhonePe payment integration failure.' });
      }
    }

    return res.status(400).json({ success: false, message: 'Invalid gateway.' });
  } catch (error: any) {
    console.error('Initiate payment error:', error);
    return res.status(500).json({ success: false, message: error.message || 'Internal server error.' });
  }
};

/**
 * Verify Razorpay Payment
 * POST /api/v1/payments/verify
 */
export const verifyRazorpayPayment = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    const { orderId, razorpayPaymentId, razorpayOrderId, razorpaySignature } = req.body;

    if (!userId) {
      return res.status(401).json({ success: false, message: 'Authentication required.' });
    }

    if (!orderId || !razorpayPaymentId || !razorpayOrderId || !razorpaySignature) {
      return res.status(400).json({ success: false, message: 'Missing required Razorpay payload params.' });
    }

    // Verify signature
    let isValid = false;

    if (!isRazorpayConfigured() && razorpayPaymentId.startsWith('pay_mock_')) {
      isValid = true;
    } else {
      const keySecret = process.env.RAZORPAY_KEY_SECRET || 'mocksecretkey123';
      const hmac = crypto.createHmac('sha256', keySecret);
      hmac.update(razorpayOrderId + '|' + razorpayPaymentId);
      const generatedSignature = hmac.digest('hex');
      isValid = generatedSignature === razorpaySignature;
    }

    if (!isValid) {
      return res.status(400).json({ success: false, message: 'Payment signature verification failed.' });
    }

    // Fetch local payment record
    const payment = await prisma.payment.findFirst({
      where: { orderId, gatewayOrderId: razorpayOrderId },
    });

    if (!payment) {
      return res.status(404).json({ success: false, message: 'Payment transaction record not found.' });
    }

    if (payment.status === PaymentStatus.COMPLETED) {
      return res.status(200).json({ success: true, message: 'Payment already verified.', data: payment });
    }

    // Update transaction state in database
    const updatedPayment = await prisma.$transaction(async (tx) => {
      const p = await tx.payment.update({
        where: { id: payment.id },
        data: {
          status: PaymentStatus.COMPLETED,
          gatewayPaymentId: razorpayPaymentId,
          gatewaySignature: razorpaySignature,
          rawResponse: {
            ...((payment.rawResponse as Record<string, any>) || {}),
            razorpayPaymentId,
            razorpaySignature,
            verifiedAt: new Date().toISOString(),
          },
        },
      });

      await tx.order.update({
        where: { id: orderId },
        data: {
          status: OrderStatus.PAID,
        },
      });

      return p;
    });

    await logAuditEvent(
      userId,
      'PAYMENT_COMPLETED',
      'Payment',
      updatedPayment.id,
      { status: 'PENDING' },
      { status: 'COMPLETED' },
      req
    );

    try {
      await createInvoiceForOrder(orderId);
    } catch (invErr) {
      console.error('Failed to create invoice upon Razorpay payment verify:', invErr);
    }

    return res.status(200).json({ success: true, message: 'Payment completed successfully.', data: updatedPayment });
  } catch (error: any) {
    console.error('Verify Razorpay payment error:', error);
    return res.status(500).json({ success: false, message: error.message || 'Internal server error.' });
  }
};

/**
 * PhonePe Redirect Callback Landing (POST/GET)
 * Handles redirection from PhonePe checkout page
 */
export const phonepeRedirectCallback = async (req: Request, res: Response) => {
  const webAppUrl = process.env.WEB_APP_URL || 'http://localhost:3000';
  try {
    // PhonePe callback may POST response parameters (base64 encoded response payload)
    // Or we fall back to reading URL parameters in mock mode
    let transactionId = '';
    let status = '';

    if (req.method === 'POST' && req.body.response) {
      const responseBody = req.body.response;
      const decodedBody = JSON.parse(Buffer.from(responseBody, 'base64').toString('utf-8'));
      transactionId = decodedBody.data?.merchantTransactionId;
      status = decodedBody.success ? 'SUCCESS' : 'FAILED';
    } else {
      transactionId = (req.query.transactionId || req.body.transactionId) as string;
      status = (req.query.status || req.body.status) as string;
    }

    if (!transactionId) {
      return res.redirect(`${webAppUrl}/cart?error=Missing+transaction+parameters`);
    }

    // Fetch matching payment
    const payment = await prisma.payment.findUnique({
      where: { transactionId },
      include: { order: true },
    });

    if (!payment) {
      return res.redirect(`${webAppUrl}/cart?error=Payment+record+not+found`);
    }

    if (payment.status === PaymentStatus.COMPLETED) {
      return res.redirect(`${webAppUrl}/orders/${payment.order.orderNumber}`);
    }

    // Verify PhonePe status directly via Server-to-Server endpoint if sandbox is configured
    if (isPhonePeConfigured()) {
      const merchantId = process.env.PHONEPE_MERCHANT_ID;
      const saltKey = process.env.PHONEPE_SALT_KEY || '';
      const saltIndex = process.env.PHONEPE_SALT_INDEX || '1';
      const hostUrl = process.env.PHONEPE_HOST_URL || '';

      const checkString = `/pg/v1/status/${merchantId}/${transactionId}${saltKey}`;
      const sha256 = crypto.createHash('sha256').update(checkString).digest('hex');
      const header = `${sha256}###${saltIndex}`;

      const response = await fetch(`${hostUrl}/pg/v1/status/${merchantId}/${transactionId}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'X-VERIFY': header,
          'X-MERCHANT-ID': merchantId || '',
        },
      });

      const resData: any = await response.json();
      if (response.ok && resData.success && resData.data.state === 'COMPLETED') {
        status = 'SUCCESS';
      } else {
        status = 'FAILED';
      }
    }

    if (status === 'SUCCESS') {
      await prisma.$transaction(async (tx) => {
        await tx.payment.update({
          where: { id: payment.id },
          data: {
            status: PaymentStatus.COMPLETED,
            rawResponse: {
              ...((payment.rawResponse as Record<string, any>) || {}),
              redirectCallback: 'SUCCESS',
              updatedAt: new Date().toISOString(),
            },
          },
        });

        await tx.order.update({
          where: { id: payment.orderId },
          data: {
            status: OrderStatus.PAID,
          },
        });
      });

      await logAuditEvent(
        null,
        'PAYMENT_COMPLETED',
        'Payment',
        payment.id,
        { status: 'PENDING' },
        { status: 'COMPLETED' }
      );

      try {
        await createInvoiceForOrder(payment.orderId);
      } catch (invErr) {
        console.error('Failed to create invoice on PhonePe callback:', invErr);
      }

      return res.redirect(`${webAppUrl}/orders/${payment.order.orderNumber}?status=success`);
    } else {
      await prisma.payment.update({
        where: { id: payment.id },
        data: {
          status: PaymentStatus.FAILED,
          rawResponse: {
            ...((payment.rawResponse as Record<string, any>) || {}),
            redirectCallback: 'FAILED',
            updatedAt: new Date().toISOString(),
          },
        },
      });

      return res.redirect(`${webAppUrl}/orders/${payment.order.orderNumber}?status=failed`);
    }
  } catch (error: any) {
    console.error('PhonePe callback handler error:', error);
    return res.redirect(`${webAppUrl}/cart?error=Payment+callback+processing+failure`);
  }
};

/**
 * Razorpay Webhook Callback
 * POST /api/v1/payments/razorpay/webhook
 */
export const razorpayWebhook = async (req: Request, res: Response) => {
  try {
    const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET || 'mockwebhooksecret123';
    const signature = req.headers['x-razorpay-signature'] as string;

    if (!signature) {
      return res.status(400).json({ success: false, message: 'Signature missing' });
    }

    // Verify webhook signature (using raw body)
    let isValid = false;
    if (isRazorpayConfigured()) {
      const shasum = crypto.createHmac('sha256', webhookSecret);
      const rawBody = (req as any).rawBody ? (req as any).rawBody.toString() : JSON.stringify(req.body);
      shasum.update(rawBody);
      const digest = shasum.digest('hex');
      isValid = digest === signature;
    } else {
      // Mock mode passes instantly
      isValid = true;
    }

    if (!isValid) {
      return res.status(400).json({ success: false, message: 'Invalid webhook signature.' });
    }

    const event = req.body.event;
    const payload = req.body.payload;

    if (event === 'payment.captured' || event === 'order.paid') {
      const rzpOrderId = payload.payment.entity.order_id || payload.order.entity.id;
      const rzpPaymentId = payload.payment.entity.id;

      const payment = await prisma.payment.findFirst({
        where: { gatewayOrderId: rzpOrderId },
        include: { order: true },
      });

      if (payment && payment.status !== PaymentStatus.COMPLETED) {
        await prisma.$transaction(async (tx) => {
          await tx.payment.update({
            where: { id: payment.id },
            data: {
              status: PaymentStatus.COMPLETED,
              gatewayPaymentId: rzpPaymentId,
              rawResponse: {
                ...((payment.rawResponse as Record<string, any>) || {}),
                webhook: payload,
              },
            },
          });

          await tx.order.update({
            where: { id: payment.orderId },
            data: {
              status: OrderStatus.PAID,
            },
          });
        });

        await logAuditEvent(
          null,
          'PAYMENT_COMPLETED_WEBHOOK',
          'Payment',
          payment.id,
          { status: 'PENDING' },
          { status: 'COMPLETED' }
        );

        try {
          await createInvoiceForOrder(payment.orderId);
        } catch (invErr) {
          console.error('Failed to create invoice on Razorpay webhook:', invErr);
        }
      }
    }

    return res.status(200).json({ success: true, message: 'Webhook processed.' });
  } catch (error: any) {
    console.error('Razorpay Webhook Error:', error);
    return res.status(500).json({ success: false, message: error.message || 'Internal webhook error.' });
  }
};

/**
 * PhonePe Webhook Callback
 * POST /api/v1/payments/phonepe/webhook
 */
export const phonepeWebhook = async (req: Request, res: Response) => {
  try {
    const xVerify = req.headers['x-verify'] as string;
    if (!xVerify) {
      return res.status(400).json({ success: false, message: 'Verify header missing.' });
    }

    const responsePayload = req.body.response;
    if (!responsePayload) {
      return res.status(400).json({ success: false, message: 'Payload missing.' });
    }

    let isValid = false;
    if (isPhonePeConfigured()) {
      const saltKey = process.env.PHONEPE_SALT_KEY || '';
      const saltIndex = process.env.PHONEPE_SALT_INDEX || '1';
      const checkString = responsePayload + saltKey;
      const sha256 = crypto.createHash('sha256').update(checkString).digest('hex');
      isValid = `${sha256}###${saltIndex}` === xVerify;
    } else {
      isValid = true;
    }

    if (!isValid) {
      return res.status(400).json({ success: false, message: 'Invalid checksum verification.' });
    }

    const decoded = JSON.parse(Buffer.from(responsePayload, 'base64').toString('utf-8'));
    const success = decoded.success;
    const data = decoded.data;
    const transactionId = data.merchantTransactionId;

    const payment = await prisma.payment.findUnique({
      where: { transactionId },
      include: { order: true },
    });

    if (payment && payment.status !== PaymentStatus.COMPLETED) {
      if (success) {
        await prisma.$transaction(async (tx) => {
          await tx.payment.update({
            where: { id: payment.id },
            data: {
              status: PaymentStatus.COMPLETED,
              rawResponse: {
                ...((payment.rawResponse as Record<string, any>) || {}),
                webhook: decoded,
              },
            },
          });

          await tx.order.update({
            where: { id: payment.orderId },
            data: {
              status: OrderStatus.PAID,
            },
          });
        });

        await logAuditEvent(
          null,
          'PAYMENT_COMPLETED_WEBHOOK',
          'Payment',
          payment.id,
          { status: 'PENDING' },
          { status: 'COMPLETED' }
        );

        try {
          await createInvoiceForOrder(payment.orderId);
        } catch (invErr) {
          console.error('Failed to create invoice on PhonePe webhook:', invErr);
        }
      } else {
        await prisma.payment.update({
          where: { id: payment.id },
          data: {
            status: PaymentStatus.FAILED,
            rawResponse: {
              ...((payment.rawResponse as Record<string, any>) || {}),
              webhook: decoded,
            },
          },
        });
      }
    }

    return res.status(200).json({ success: true, message: 'Webhook processed.' });
  } catch (error: any) {
    console.error('PhonePe Webhook Error:', error);
    return res.status(500).json({ success: false, message: error.message || 'Internal webhook error.' });
  }
};

/**
 * Retry Payment
 * POST /api/v1/payments/retry
 */
export const retryPayment = async (req: Request, res: Response) => {
  // We can just redirect to initiatePayment since it has the identical lookup, verification, and database state creation.
  return initiatePayment(req, res);
};

/**
 * Refund Support (Admin/Super Admin only)
 * POST /api/v1/payments/admin/:paymentId/refund
 */
export const initiateRefund = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    const { paymentId } = req.params;
    const { reason, amount } = req.body;

    if (!userId) {
      return res.status(401).json({ success: false, message: 'Authentication required.' });
    }

    if (!reason) {
      return res.status(400).json({ success: false, message: 'Refund reason is required.' });
    }

    const payment = await prisma.payment.findUnique({
      where: { id: paymentId },
      include: { order: true },
    });

    if (!payment) {
      return res.status(404).json({ success: false, message: 'Payment record not found.' });
    }

    if (payment.status !== PaymentStatus.COMPLETED) {
      return res.status(400).json({ success: false, message: 'Only fully completed payments can be refunded.' });
    }

    const refundAmount = amount ? parseFloat(amount) : parseFloat(payment.amount.toString());

    if (refundAmount <= 0 || refundAmount > parseFloat(payment.amount.toString())) {
      return res.status(400).json({ success: false, message: 'Invalid refund amount.' });
    }

    // Call Gateway Refund endpoint or Mock verification
    let gatewayRefundId = `REFUND-MOCK-${Date.now()}`;
    let rawResponse: any = { note: 'Mock refund successful' };

    if (payment.gateway === PaymentGateway.RAZORPAY && isRazorpayConfigured()) {
      const rzp = getRazorpayInstance();
      const rzpRefund = await rzp.payments.refund(payment.gatewayPaymentId!, {
        amount: Math.round(refundAmount * 100),
        notes: { reason },
      });
      gatewayRefundId = rzpRefund.id;
      rawResponse = JSON.parse(JSON.stringify(rzpRefund));
    } else if (payment.gateway === PaymentGateway.PHONEPE && isPhonePeConfigured()) {
      const merchantId = process.env.PHONEPE_MERCHANT_ID || '';
      const saltKey = process.env.PHONEPE_SALT_KEY || '';
      const saltIndex = process.env.PHONEPE_SALT_INDEX || '1';
      const hostUrl = process.env.PHONEPE_HOST_URL || '';

      const merchantRefundId = `REF-${Date.now()}`;
      const payload = {
        merchantId,
        merchantTransactionId: merchantRefundId,
        originalTransactionId: payment.transactionId,
        amount: Math.round(refundAmount * 100),
        callbackUrl: `${process.env.API_APP_URL}/api/v1/payments/phonepe/webhook`,
      };

      const buffer = Buffer.from(JSON.stringify(payload));
      const base64Payload = buffer.toString('base64');
      const verifyString = base64Payload + '/pg/v1/refund' + saltKey;
      const sha256Checksum = crypto.createHash('sha256').update(verifyString).digest('hex');
      const xVerifyHeader = `${sha256Checksum}###${saltIndex}`;

      const response = await fetch(`${hostUrl}/pg/v1/refund`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-VERIFY': xVerifyHeader,
        },
        body: JSON.stringify({ request: base64Payload }),
      });

      const resData: any = await response.json();
      if (response.ok && resData.success) {
        gatewayRefundId = merchantRefundId;
        rawResponse = JSON.parse(JSON.stringify(resData));
      } else {
        console.error('PhonePe Refund Error:', resData);
        return res.status(502).json({ success: false, message: resData.message || 'PhonePe refund failed.' });
      }
    }

    // Database Update
    const refund = await prisma.$transaction(async (tx) => {
      const ref = await tx.refund.create({
        data: {
          orderId: payment.orderId,
          paymentId: payment.id,
          amount: refundAmount,
          reason,
          status: RefundStatus.COMPLETED,
          gatewayRefundId,
          rawResponse,
          initiatedBy: userId,
        },
      });

      // Update payment state
      await tx.payment.update({
        where: { id: payment.id },
        data: {
          status: PaymentStatus.REFUNDED,
        },
      });

      // Update order state
      await tx.order.update({
        where: { id: payment.orderId },
        data: {
          status: OrderStatus.REFUNDED,
        },
      });

      // Release stock items (increment stock back up on refund)
      const orderItems = await tx.orderItem.findMany({
        where: { orderId: payment.orderId },
      });

      for (const item of orderItems) {
        await tx.productVariant.update({
          where: { id: item.productVariantId },
          data: {
            stock: { increment: item.quantity },
          },
        });
      }

      return ref;
    });

    await logAuditEvent(
      userId,
      'ORDER_REFUNDED',
      'Refund',
      refund.id,
      { status: 'COMPLETED' },
      { status: 'REFUNDED' },
      req
    );

    return res.status(200).json({ success: true, message: 'Refund processed successfully.', data: refund });
  } catch (error: any) {
    console.error('Refund integration failure:', error);
    return res.status(500).json({ success: false, message: error.message || 'Internal server error.' });
  }
};

/**
 * Get Admin Payments
 * GET /api/v1/payments/admin/logs
 */
export const getAdminPayments = async (req: Request, res: Response) => {
  try {
    const payments = await prisma.payment.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        order: {
          select: {
            orderNumber: true,
            customer: {
              select: { name: true, email: true },
            },
          },
        },
        refunds: true,
      },
    });

    return res.status(200).json({ success: true, data: payments });
  } catch (error: any) {
    console.error('Admin logs retrieval error:', error);
    return res.status(500).json({ success: false, message: error.message || 'Internal server error.' });
  }
};
