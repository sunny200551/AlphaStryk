import { Request, Response } from 'express';
import { prisma } from '@alphastryk/db';
import { generateInvoicePdf } from '../services/pdf';
import { sendInvoiceEmailWithAttachment } from '../services/email';

/**
 * Helper to calculate GST splits
 */
export const calculateGstBreakdown = (subtotal: number, billingState: string) => {
  const taxRate = 18.00; // Standard 18% GST for sports/athletic wear
  const isMaharashtra = billingState.trim().toLowerCase() === 'maharashtra';
  
  let cgst = 0;
  let sgst = 0;
  let igst = 0;

  if (isMaharashtra) {
    cgst = subtotal * 0.09; // 9% Central GST
    sgst = subtotal * 0.09; // 9% State GST
  } else {
    igst = subtotal * 0.18; // 18% Integrated GST
  }

  return { cgst, sgst, igst, taxRate };
};

/**
 * Create Invoice for Order
 * Typically triggered automatically inside the payment callback transaction
 */
export const createInvoiceForOrder = async (orderId: string) => {
  // Check if invoice already exists
  const existing = await prisma.invoice.findUnique({ where: { orderId } });
  if (existing) return existing;

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { customer: true },
  });

  if (!order) {
    throw new Error('Order not found for invoice creation.');
  }

  const billingAddress: any = order.billingAddress;
  const billingState = billingAddress?.state || 'Maharashtra'; // Default if missing
  const subtotal = parseFloat(order.totalAmount.toString());

  const { cgst, sgst, igst, taxRate } = calculateGstBreakdown(subtotal, billingState);

  // Generate unique invoice number: INV-YYYYMMDD-HEX
  const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const randomHex = Math.floor(Math.random() * 0xFFFF).toString(16).padEnd(4, '0').toUpperCase();
  const invoiceNumber = `INV-${dateStr}-${randomHex}`;

  const invoice = await prisma.invoice.create({
    data: {
      invoiceNumber,
      orderId,
      customerId: order.customerId,
      gstin: order.gstin || null,
      cgst,
      sgst,
      igst,
      taxRate,
      amount: order.payableAmount,
    },
  });

  return invoice;
};

/**
 * Download Invoice PDF
 * GET /api/v1/invoices/download/:invoiceNumber
 */
export const downloadInvoicePdf = async (req: Request, res: Response) => {
  try {
    const { invoiceNumber } = req.params;

    const invoice = await prisma.invoice.findUnique({
      where: { invoiceNumber },
      include: {
        customer: true,
        order: {
          include: {
            items: {
              include: {
                variant: {
                  include: { product: true },
                },
              },
            },
          },
        },
      },
    });

    if (!invoice) {
      return res.status(404).json({ success: false, message: 'Invoice record not found.' });
    }

    // Auth gate check: user owner or admin
    const authUser = (req as any).user;
    if (invoice.customerId !== authUser?.id && authUser?.role !== 'ADMIN' && authUser?.role !== 'SUPER_ADMIN') {
      return res.status(403).json({ success: false, message: 'Forbidden: Access denied.' });
    }

    const order = invoice.order;
    const itemsData = order.items.map((item) => ({
      name: item.variant.product.name,
      sku: item.variant.sku,
      style: item.variant.name,
      quantity: item.quantity,
      price: parseFloat(item.priceAtPurchase.toString()),
    }));

    const pdfBuffer = await generateInvoicePdf({
      invoiceNumber: invoice.invoiceNumber,
      orderNumber: order.orderNumber,
      customerName: invoice.customer.name || 'Athlete',
      customerEmail: invoice.customer.email,
      gstin: invoice.gstin,
      cgst: parseFloat(invoice.cgst.toString()),
      sgst: parseFloat(invoice.sgst.toString()),
      igst: parseFloat(invoice.igst.toString()),
      taxRate: parseFloat(invoice.taxRate.toString()),
      amount: parseFloat(invoice.amount.toString()),
      createdAt: invoice.createdAt,
      shippingAddress: order.shippingAddress as any,
      billingAddress: order.billingAddress as any,
      items: itemsData,
      shippingCost: parseFloat(order.shippingCost.toString()),
      totalAmount: parseFloat(order.totalAmount.toString()),
    });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=invoice-${invoice.invoiceNumber}.pdf`);
    return res.end(pdfBuffer);
  } catch (error: any) {
    console.error('Error generating PDF invoice:', error);
    return res.status(500).json({ success: false, message: error.message || 'Internal server error.' });
  }
};

/**
 * Email Invoice
 * POST /api/v1/invoices/email/:invoiceNumber
 */
export const emailInvoice = async (req: Request, res: Response) => {
  try {
    const { invoiceNumber } = req.params;

    const invoice = await prisma.invoice.findUnique({
      where: { invoiceNumber },
      include: {
        customer: true,
        order: {
          include: {
            items: {
              include: {
                variant: {
                  include: { product: true },
                },
              },
            },
          },
        },
      },
    });

    if (!invoice) {
      return res.status(404).json({ success: false, message: 'Invoice record not found.' });
    }

    const authUser = (req as any).user;
    if (invoice.customerId !== authUser?.id && authUser?.role !== 'ADMIN' && authUser?.role !== 'SUPER_ADMIN') {
      return res.status(403).json({ success: false, message: 'Forbidden: Access denied.' });
    }

    const order = invoice.order;
    const itemsData = order.items.map((item) => ({
      name: item.variant.product.name,
      sku: item.variant.sku,
      style: item.variant.name,
      quantity: item.quantity,
      price: parseFloat(item.priceAtPurchase.toString()),
    }));

    const pdfBuffer = await generateInvoicePdf({
      invoiceNumber: invoice.invoiceNumber,
      orderNumber: order.orderNumber,
      customerName: invoice.customer.name || 'Athlete',
      customerEmail: invoice.customer.email,
      gstin: invoice.gstin,
      cgst: parseFloat(invoice.cgst.toString()),
      sgst: parseFloat(invoice.sgst.toString()),
      igst: parseFloat(invoice.igst.toString()),
      taxRate: parseFloat(invoice.taxRate.toString()),
      amount: parseFloat(invoice.amount.toString()),
      createdAt: invoice.createdAt,
      shippingAddress: order.shippingAddress as any,
      billingAddress: order.billingAddress as any,
      items: itemsData,
      shippingCost: parseFloat(order.shippingCost.toString()),
      totalAmount: parseFloat(order.totalAmount.toString()),
    });

    await sendInvoiceEmailWithAttachment(
      invoice.customer.email,
      invoice.invoiceNumber,
      pdfBuffer
    );

    return res.status(200).json({ success: true, message: 'Invoice dispatched to customer email.' });
  } catch (error: any) {
    console.error('Error mailing PDF invoice:', error);
    return res.status(500).json({ success: false, message: error.message || 'Internal server error.' });
  }
};

/**
 * Get User Invoices History
 * GET /api/v1/invoices/history
 */
export const getUserInvoices = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, message: 'Authentication required.' });
    }

    const invoices = await prisma.invoice.findMany({
      where: { customerId: userId },
      orderBy: { createdAt: 'desc' },
      include: {
        order: {
          select: { orderNumber: true },
        },
      },
    });

    return res.status(200).json({ success: true, data: invoices });
  } catch (error: any) {
    console.error('Error fetching user invoices:', error);
    return res.status(500).json({ success: false, message: error.message || 'Internal server error.' });
  }
};

/**
 * Get Admin Invoices (Includes metrics aggregation)
 * GET /api/v1/invoices/admin/all
 */
export const getAdminInvoices = async (req: Request, res: Response) => {
  try {
    const invoices = await prisma.invoice.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        customer: {
          select: { name: true, email: true },
        },
        order: {
          select: { orderNumber: true, billingAddress: true },
        },
      },
    });

    // Aggregate values
    let totalCgst = 0.0;
    let totalSgst = 0.0;
    let totalIgst = 0.0;
    let totalAmount = 0.0;
    const stateSales: Record<string, number> = {};

    invoices.forEach((inv) => {
      totalCgst += parseFloat(inv.cgst.toString());
      totalSgst += parseFloat(inv.sgst.toString());
      totalIgst += parseFloat(inv.igst.toString());
      totalAmount += parseFloat(inv.amount.toString());

      const billingAddr: any = inv.order?.billingAddress;
      const state = billingAddr?.state || 'Unknown';
      stateSales[state] = (stateSales[state] || 0.0) + parseFloat(inv.amount.toString());
    });

    return res.status(200).json({
      success: true,
      data: {
        invoices,
        aggregates: {
          totalCgst,
          totalSgst,
          totalIgst,
          totalGst: totalCgst + totalSgst + totalIgst,
          totalAmount,
          stateDistribution: stateSales,
        },
      },
    });
  } catch (error: any) {
    console.error('Admin invoices query failure:', error);
    return res.status(500).json({ success: false, message: error.message || 'Internal server error.' });
  }
};
