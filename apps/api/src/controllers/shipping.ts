import { Request, Response } from 'express';
import { prisma, OrderStatus } from '@alphastryk/db';
import { dispatchShiprocket, dispatchDelhivery, dispatchBlueDart } from '../services/shipping';
import { sendShipmentNotification, sendDeliveryNotification } from '../services/email';

// Helper to write audit logs
const logAuditEvent = async (
  actorId: string | null,
  action: string,
  entityType: string,
  entityId: string | null,
  oldValues: any = null,
  newValues: any = null,
  req: Request
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
        ipAddress: req.ip || req.socket.remoteAddress || null,
        userAgent: req.headers['user-agent'] || null,
      },
    });
  } catch (error) {
    console.error('Failed to write audit log:', error);
  }
};

/**
 * Fulfill and Ship Order
 * POST /api/v1/shipping/admin/fulfill
 */
export const shipOrder = async (req: Request, res: Response) => {
  try {
    const actorId = req.user?.id || null;
    const { orderId, carrier, trackingNumber: customTracking, estimatedDeliveryDays } = req.body;

    if (!orderId || !carrier) {
      return res.status(400).json({ success: false, message: 'Order ID and Carrier are required.' });
    }

    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: { customer: { include: { profile: true } } },
    });

    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found.' });
    }

    if (order.status === OrderStatus.SHIPPED || order.status === OrderStatus.DELIVERED) {
      return res.status(400).json({ success: false, message: `Order already ${order.status.toLowerCase()}` });
    }

    const shippingAddress: any = order.shippingAddress;
    const customerName = shippingAddress?.name || order.customer.name || 'Valued Customer';
    const customerPhone = shippingAddress?.phone || order.customer.profile?.phone || '9999999999';

    const dispatchPayload = {
      orderNumber: order.orderNumber,
      customerName,
      customerPhone,
      address: {
        street: `${shippingAddress?.street || ''}`,
        city: `${shippingAddress?.city || ''}`,
        state: `${shippingAddress?.state || ''}`,
        country: `${shippingAddress?.country || ''}`,
        postalCode: `${shippingAddress?.postalCode || ''}`,
      },
      weightKg: 1.5,
    };

    let trackingNumber = '';
    let estimatedDays = estimatedDeliveryDays || 5;
    let apiResponse: any = null;

    if (carrier === 'SHIPROCKET') {
      const result = await dispatchShiprocket(dispatchPayload);
      trackingNumber = result.trackingNumber;
      estimatedDays = result.estimatedDays;
      apiResponse = result.rawResponse;
    } else if (carrier === 'DELHIVERY') {
      const result = await dispatchDelhivery(dispatchPayload);
      trackingNumber = result.trackingNumber;
      estimatedDays = result.estimatedDays;
      apiResponse = result.rawResponse;
    } else if (carrier === 'BLUEDART') {
      const result = await dispatchBlueDart(dispatchPayload);
      trackingNumber = result.trackingNumber;
      estimatedDays = result.estimatedDays;
      apiResponse = result.rawResponse;
    } else if (carrier === 'CUSTOM') {
      trackingNumber = customTracking || `AS-CUST-${Math.floor(100000 + Math.random() * 900000)}`;
      apiResponse = { note: 'Manual/Custom tracking generated' };
    } else {
      return res.status(400).json({ success: false, message: 'Invalid carrier code. Choose Shiprocket, Delhivery, Blue Dart or Custom.' });
    }

    const estimatedDelivery = new Date();
    estimatedDelivery.setDate(estimatedDelivery.getDate() + estimatedDays);

    const oldValues = { status: order.status, trackingNumber: order.trackingNumber, carrier: order.carrier };
    const newValues = {
      status: OrderStatus.SHIPPED,
      trackingNumber,
      carrier,
      estimatedDelivery,
      shippedAt: new Date(),
    };

    // Update Order & Create Tracking Checkpoint in transaction
    const [updatedOrder] = await prisma.$transaction([
      prisma.order.update({
        where: { id: orderId },
        data: newValues,
      }),
      prisma.trackingUpdate.create({
        data: {
          orderId,
          status: 'SHIPPED',
          location: 'Origin Warehouse',
          details: `Shipment manifested via ${carrier}. Tracking Reference: ${trackingNumber}`,
        },
      }),
    ]);

    // Send dispatch email notification
    await sendShipmentNotification(order.customer.email, order.orderNumber, carrier, trackingNumber);

    // Audit log
    await logAuditEvent(actorId, 'ORDER_SHIPPED', 'Order', order.id, oldValues, newValues, req);

    return res.status(200).json({
      success: true,
      message: 'Order status updated to SHIPPED successfully.',
      order: updatedOrder,
      apiResponse,
    });
  } catch (error: any) {
    console.error('Ship order error:', error);
    return res.status(500).json({ success: false, message: error.message || 'Fulfillment request failed.' });
  }
};

/**
 * Append manual tracking checkpoint
 * POST /api/v1/shipping/admin/checkpoint
 */
export const createTrackingCheckpoint = async (req: Request, res: Response) => {
  try {
    const actorId = req.user?.id || null;
    const { orderId, status, location, details } = req.body;

    if (!orderId || !status || !location || !details) {
      return res.status(400).json({ success: false, message: 'OrderId, status, location, and details are required.' });
    }

    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: { customer: true },
    });

    if (!order) {
      return res.status(404).json({ success: false, message: 'Order record not found.' });
    }

    // Status map validation / sanity
    const validStatuses = ['SHIPPED', 'IN_TRANSIT', 'OUT_FOR_DELIVERY', 'DELIVERED', 'FAILED_ATTEMPT', 'RETURNED'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ success: false, message: `Invalid tracking status. Choose from: ${validStatuses.join(', ')}` });
    }

    // Add Checkpoint
    const checkpoint = await prisma.trackingUpdate.create({
      data: {
        orderId,
        status,
        location,
        details,
      },
    });

    // Update order level if delivered
    if (status === 'DELIVERED' && order.status !== OrderStatus.DELIVERED) {
      await prisma.order.update({
        where: { id: orderId },
        data: {
          status: OrderStatus.DELIVERED,
          deliveredAt: new Date(),
        },
      });

      // Send delivery confirmation email
      await sendDeliveryNotification(order.customer.email, order.orderNumber);

      // Audit Log
      await logAuditEvent(actorId, 'ORDER_DELIVERED', 'Order', order.id, { status: order.status }, { status: OrderStatus.DELIVERED }, req);
    } else {
      // Just log checkpoint audit event
      await logAuditEvent(actorId, 'TRACKING_CHECKPOINT_ADDED', 'TrackingUpdate', checkpoint.id, null, checkpoint, req);
    }

    return res.status(201).json({
      success: true,
      message: 'Tracking checkpoint registered successfully.',
      checkpoint,
    });
  } catch (error: any) {
    console.error('Create checkpoint error:', error);
    return res.status(500).json({ success: false, message: error.message || 'Failed to append checkpoint.' });
  }
};

/**
 * Get chronological tracking timeline for a specific order
 * GET /api/v1/shipping/track/:orderNumber
 */
export const getTrackingLogs = async (req: Request, res: Response) => {
  try {
    const { orderNumber } = req.params;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ success: false, message: 'Authentication required.' });
    }

    const order = await prisma.order.findUnique({
      where: { orderNumber },
      include: {
        trackingUpdates: {
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found.' });
    }

    // Guard: Customer can only view their own tracking logs unless admin
    if (req.user?.role === 'CUSTOMER' && order.customerId !== userId) {
      return res.status(403).json({ success: false, message: 'Access denied: You do not own this order.' });
    }

    return res.status(200).json({
      success: true,
      order: {
        orderNumber: order.orderNumber,
        status: order.status,
        carrier: order.carrier,
        trackingNumber: order.trackingNumber,
        estimatedDelivery: order.estimatedDelivery,
        shippedAt: order.shippedAt,
        deliveredAt: order.deliveredAt,
      },
      trackingUpdates: order.trackingUpdates,
    });
  } catch (error: any) {
    console.error('Get tracking logs error:', error);
    return res.status(500).json({ success: false, message: error.message || 'Failed to retrieve checkpoints.' });
  }
};

/**
 * Get fulfillment list for administrative screens
 * GET /api/v1/shipping/admin/fulfillments
 */
export const getAdminFulfillments = async (req: Request, res: Response) => {
  try {
    const orders = await prisma.order.findMany({
      where: {
        status: {
          in: [
            OrderStatus.PAID,
            OrderStatus.CONFIRMED,
            OrderStatus.PROCESSING,
            OrderStatus.SHIPPED,
            OrderStatus.DELIVERED,
          ],
        },
      },
      include: {
        customer: {
          select: {
            name: true,
            email: true,
          },
        },
        trackingUpdates: {
          orderBy: { createdAt: 'desc' },
        },
      },
      orderBy: { updatedAt: 'desc' },
    });

    return res.status(200).json({
      success: true,
      fulfillments: orders,
    });
  } catch (error: any) {
    console.error('Get admin fulfillments error:', error);
    return res.status(500).json({ success: false, message: error.message || 'Failed to fetch fulfillments.' });
  }
};

/**
 * Webhook callback for tracking progress from carrier integrations
 * POST /api/v1/shipping/webhook
 */
export const carrierWebhook = async (req: Request, res: Response) => {
  try {
    const payload = req.body;
    console.log('[Carrier Webhook Callback Received]:', JSON.stringify(payload, null, 2));

    // Support flexible mapping for Shiprocket or Delhivery webhook payloads
    const trackingNumber = payload.awb || payload.awb_code || payload.waybill || payload.tracking_number;
    if (!trackingNumber) {
      return res.status(200).json({ success: true, message: 'Ignored: Missing tracking identifier (awb/waybill).' });
    }

    const order = await prisma.order.findFirst({
      where: { trackingNumber },
      include: { customer: true },
    });

    if (!order) {
      return res.status(200).json({ success: true, message: `Ignored: No matching order found for AWB ${trackingNumber}` });
    }

    const rawStatus = (payload.current_status || payload.status || 'IN_TRANSIT').toUpperCase();
    const location = payload.location || payload.city || 'Transit Hub';
    const details = payload.details || payload.remark || `Status update received: ${rawStatus}`;

    // Normalize webhook status into valid tracking checkpoints
    let mappedStatus = 'IN_TRANSIT';
    if (rawStatus.includes('DELIVERED') || rawStatus === 'DL' || rawStatus === 'DELIVERED') {
      mappedStatus = 'DELIVERED';
    } else if (rawStatus.includes('PICK') || rawStatus.includes('MANIFEST') || rawStatus.includes('SHIP')) {
      mappedStatus = 'SHIPPED';
    } else if (rawStatus.includes('OUT FOR DELIV') || rawStatus === 'OD' || rawStatus === 'OUT_FOR_DELIVERY') {
      mappedStatus = 'OUT_FOR_DELIVERY';
    } else if (rawStatus.includes('UNDELIV') || rawStatus.includes('FAIL')) {
      mappedStatus = 'FAILED_ATTEMPT';
    }

    const checkpoint = await prisma.trackingUpdate.create({
      data: {
        orderId: order.id,
        status: mappedStatus,
        location,
        details,
      },
    });

    // Update order-level status if delivered
    if (mappedStatus === 'DELIVERED' && order.status !== OrderStatus.DELIVERED) {
      await prisma.order.update({
        where: { id: order.id },
        data: {
          status: OrderStatus.DELIVERED,
          deliveredAt: new Date(),
        },
      });

      // Send email alert
      await sendDeliveryNotification(order.customer.email, order.orderNumber);

      // Audit Log (system actor)
      await prisma.auditLog.create({
        data: {
          actorId: null,
          action: 'ORDER_DELIVERED_VIA_WEBHOOK',
          entityType: 'Order',
          entityId: order.id,
          oldValues: { status: order.status },
          newValues: { status: OrderStatus.DELIVERED },
          ipAddress: req.ip || req.socket.remoteAddress || null,
          userAgent: req.headers['user-agent'] || null,
        },
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Tracking webhook recorded.',
      checkpointId: checkpoint.id,
    });
  } catch (error: any) {
    console.error('Carrier webhook processing error:', error);
    return res.status(500).json({ success: false, message: error.message || 'Internal webhook error.' });
  }
};
