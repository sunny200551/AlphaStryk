import { Request, Response } from 'express';
import { prisma, OrderStatus } from '@alphastryk/db';
import { validateCouponLogic } from './coupon';


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

export const createOrder = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    const { shippingAddressId, billingAddressId, gstin, couponCode } = req.body;


    if (!userId) {
      return res.status(401).json({ success: false, message: 'Authentication required.' });
    }

    if (!shippingAddressId || !billingAddressId) {
      return res.status(400).json({ success: false, message: 'Shipping and billing addresses are required.' });
    }

    // 1. Fetch addresses
    const shippingAddress = await prisma.address.findFirst({ where: { id: shippingAddressId, userId } });
    const billingAddress = await prisma.address.findFirst({ where: { id: billingAddressId, userId } });

    if (!shippingAddress || !billingAddress) {
      return res.status(404).json({ success: false, message: 'Address records not found or unauthorized.' });
    }

    // 2. Fetch cart items
    const cart = await prisma.cart.findUnique({
      where: { userId },
      include: {
        items: {
          include: {
            variant: {
              include: { product: true },
            },
          },
        },
      },
    });

    if (!cart || cart.items.length === 0) {
      return res.status(400).json({ success: false, message: 'Shopping cart is empty.' });
    }

    // 3. Verify stock levels
    for (const item of cart.items) {
      if (item.variant.stock < item.quantity) {
        return res.status(400).json({
          success: false,
          message: `Insufficient stock for variant "${item.variant.name}". Only ${item.variant.stock} left.`,
        });
      }
    }

    // 4. Calculate prices
    let totalAmount = 0.0;
    const itemsData = cart.items.map((item) => {
      const price = parseFloat(item.variant.product.basePrice.toString()) + parseFloat(item.variant.priceOffset.toString());
      totalAmount += price * item.quantity;

      return {
        productVariantId: item.productVariantId,
        quantity: item.quantity,
        priceAtPurchase: price,
        customDesignId: item.customDesignId,
      };
    });

    let discountAmount = 0.0;
    let couponId: string | null = null;

    if (couponCode) {
      try {
        const validatedCouponResult = await validateCouponLogic(couponCode, userId);
        discountAmount = validatedCouponResult.discount;
        couponId = validatedCouponResult.coupon.id;
      } catch (err: any) {
        return res.status(400).json({ success: false, message: `Coupon validation error: ${err.message}` });
      }
    }

    const shippingCost = 15.0; // Flat-rate shipping
    const taxAmount = (totalAmount - discountAmount) * 0.18; // 18% GST tax rate
    const payableAmount = (totalAmount - discountAmount) + shippingCost + taxAmount;

    // Generate unique order number (e.g., AS-YYYYMMDD-HEX)
    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const randomHex = Math.floor(Math.random() * 0xFFFFFF).toString(16).padEnd(6, '0').toUpperCase();
    const orderNumber = `AS-${dateStr}-${randomHex}`;

    // Execute order creation and stock decrement transactionally
    const order = await prisma.$transaction(async (tx) => {
      // Create Order
      const ord = await tx.order.create({
        data: {
          orderNumber,
          customerId: userId,
          status: 'PENDING',
          totalAmount,
          discountAmount,
          payableAmount,
          taxAmount,
          shippingCost,
          shippingAddress: JSON.parse(JSON.stringify(shippingAddress)),
          billingAddress: JSON.parse(JSON.stringify(billingAddress)),
          gstin: gstin || null,
          couponId: couponId || null,
        },
      });

      if (couponId) {
        // Record coupon usage
        await tx.couponUsage.create({
          data: {
            couponId,
            userId: userId!,
            orderId: ord.id,
          },
        });

        // Increment coupon usage count
        await tx.coupon.update({
          where: { id: couponId },
          data: {
            usageCount: { increment: 1 },
          },
        });
      }


      // Create Order Items & decrement variant stock
      for (const item of itemsData) {
        await tx.orderItem.create({
          data: {
            orderId: ord.id,
            productVariantId: item.productVariantId,
            quantity: item.quantity,
            priceAtPurchase: item.priceAtPurchase,
            customDesignId: item.customDesignId,
          },
        });

        // Decrement stock levels
        await tx.productVariant.update({
          where: { id: item.productVariantId },
          data: {
            stock: { decrement: item.quantity },
          },
        });
      }

      // Empty shopping cart items
      await tx.cartItem.deleteMany({
        where: { cartId: cart.id },
      });

      return ord;
    });

    const populatedOrder = await prisma.order.findUnique({
      where: { id: order.id },
      include: {
        items: {
          include: {
            variant: {
              include: { product: true },
            },
          },
        },
      },
    });

    // Write audit logging
    await logAuditEvent(userId, 'ORDER_CREATE', 'Order', order.id, null, populatedOrder, req);

    return res.status(201).json({ success: true, message: 'Order created successfully.', data: populatedOrder });
  } catch (error: any) {
    console.error('Error during checkout order creation:', error);
    return res.status(500).json({ success: false, message: error.message || 'Internal server error.' });
  }
};

export const getOrderHistory = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, message: 'Authentication required.' });
    }

    const orders = await prisma.order.findMany({
      where: { customerId: userId },
      orderBy: { createdAt: 'desc' },
      include: {
        items: {
          include: {
            variant: {
              include: { product: { select: { name: true, images: true } } },
            },
          },
        },
      },
    });

    return res.status(200).json({ success: true, data: orders });
  } catch (error: any) {
    console.error('Error fetching order history:', error);
    return res.status(500).json({ success: false, message: error.message || 'Internal server error.' });
  }
};

export const getOrderDetail = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    const { orderNumber } = req.params;

    if (!userId) {
      return res.status(401).json({ success: false, message: 'Authentication required.' });
    }

    const order = await prisma.order.findUnique({
      where: { orderNumber },
      include: {
        invoice: true,
        trackingUpdates: {
          orderBy: { createdAt: 'desc' },
        },
        items: {
          include: {
            variant: {
              include: { product: true },
            },
          },
        },
      },
    });

    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found.' });
    }

    // Owner check or Admin check
    if (order.customerId !== userId && req.user?.role !== 'ADMIN' && req.user?.role !== 'SUPER_ADMIN') {
      return res.status(403).json({ success: false, message: 'Forbidden: Access denied.' });
    }

    return res.status(200).json({ success: true, data: order });
  } catch (error: any) {
    console.error('Error fetching order detail:', error);
    return res.status(500).json({ success: false, message: error.message || 'Internal server error.' });
  }
};

export const getAdminOrders = async (req: Request, res: Response) => {
  try {
    const orders = await prisma.order.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        customer: {
          select: { email: true, name: true },
        },
        items: {
          include: {
            variant: {
              include: { product: true },
            },
          },
        },
      },
    });

    return res.status(200).json({ success: true, data: orders });
  } catch (error: any) {
    console.error('Admin fetching orders error:', error);
    return res.status(500).json({ success: false, message: error.message || 'Internal server error.' });
  }
};

export const updateOrderStatus = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!status) {
      return res.status(400).json({ success: false, message: 'Order status is required.' });
    }

    const oldOrder = await prisma.order.findUnique({ where: { id } });
    if (!oldOrder) {
      return res.status(404).json({ success: false, message: 'Order not found.' });
    }

    const updated = await prisma.order.update({
      where: { id },
      data: { status },
    });

    await logAuditEvent(
      req.user?.id || null,
      'ORDER_STATUS_UPDATE',
      'Order',
      id,
      { status: oldOrder.status },
      { status: updated.status },
      req
    );

    return res.status(200).json({ success: true, message: `Order status updated to ${status}.`, data: updated });
  } catch (error: any) {
    console.error('Error updating order status:', error);
    return res.status(500).json({ success: false, message: error.message || 'Internal server error.' });
  }
};
