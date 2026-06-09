import { Request, Response } from 'express';
import { prisma, CouponType, OrderStatus } from '@alphastryk/db';

const logAuditEvent = async (
  actorId: string | null,
  action: string,
  entityType: string,
  entityId: string | null,
  oldValues: any,
  newValues: any,
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
        ipAddress: req?.ip || null,
        userAgent: req?.headers['user-agent'] || null,
      },
    });
  } catch (error) {
    console.error('Audit logger failure:', error);
  }
};

/**
 * Core validation routine for a Coupon code against a user's cart
 */
export const validateCouponLogic = async (code: string, userId?: string, bodyCartItems?: any[]) => {
  // 1. Fetch Coupon
  const coupon = await prisma.coupon.findUnique({
    where: { code: code.trim().toUpperCase() },
    include: { referrer: true },
  });

  if (!coupon) {
    throw new Error('Invalid coupon code.');
  }

  if (!coupon.isActive) {
    throw new Error('This coupon is no longer active.');
  }

  const now = new Date();
  if (now < coupon.startsAt) {
    throw new Error('This coupon code is not yet active.');
  }
  if (now > coupon.expiresAt) {
    throw new Error('This coupon code has expired.');
  }

  // 2. Check global usage limit
  if (coupon.usageLimit !== null && coupon.usageCount >= coupon.usageLimit) {
    throw new Error('This coupon code has reached its maximum usage limit.');
  }

  // 3. User usage limit checks
  if (userId) {
    const userUsageCount = await prisma.couponUsage.count({
      where: { couponId: coupon.id, userId },
    });
    if (userUsageCount >= coupon.userUsageLimit) {
      throw new Error(`You have already redeemed this coupon code. Limit: ${coupon.userUsageLimit} per user.`);
    }
  }

  // 4. Referral coupon checks
  if (coupon.referrerId) {
    if (userId && coupon.referrerId === userId) {
      throw new Error('You cannot redeem your own referral coupon code.');
    }
    if (coupon.isFirstOrderOnly && userId) {
      const userOrders = await prisma.order.count({
        where: {
          customerId: userId,
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
      });
      if (userOrders > 0) {
        throw new Error('This referral code is only valid for your first order.');
      }
    }
  }

  // 5. Gather Cart Items
  let items: Array<{ price: number; quantity: number; categoryId: string }> = [];

  if (userId) {
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

    if (cart && cart.items.length > 0) {
      items = cart.items.map((i) => {
        const price =
          parseFloat(i.variant.product.basePrice.toString()) +
          parseFloat(i.variant.priceOffset.toString());
        return {
          price,
          quantity: i.quantity,
          categoryId: i.variant.product.categoryId,
        };
      });
    }
  } else if (bodyCartItems && bodyCartItems.length > 0) {
    items = bodyCartItems.map((i) => ({
      price: parseFloat(i.price.toString()),
      quantity: parseInt(i.quantity.toString(), 10),
      categoryId: i.categoryId,
    }));
  }

  if (items.length === 0) {
    throw new Error('Your cart is empty.');
  }

  // 6. Calculate Subtotals
  let eligibleSubtotal = 0;
  let overallSubtotal = 0;

  for (const item of items) {
    const itemTotal = item.price * item.quantity;
    overallSubtotal += itemTotal;

    // Check category restrictions (direct match or inheritance checks if categoryId set)
    if (coupon.categoryId) {
      if (item.categoryId === coupon.categoryId) {
        eligibleSubtotal += itemTotal;
      }
    } else {
      eligibleSubtotal += itemTotal;
    }
  }

  if (coupon.categoryId && eligibleSubtotal === 0) {
    throw new Error('This coupon is only valid for products in the specified category.');
  }

  // 7. Check Minimum Order Value
  const checkValue = coupon.categoryId ? eligibleSubtotal : overallSubtotal;
  if (checkValue < parseFloat(coupon.minOrderValue.toString())) {
    throw new Error(
      `Minimum order value of $${parseFloat(coupon.minOrderValue.toString()).toFixed(
        2
      )} is required for this coupon.`
    );
  }

  // 8. Calculate Discount
  let discount = 0;
  if (coupon.type === CouponType.PERCENTAGE) {
    discount = eligibleSubtotal * (parseFloat(coupon.value.toString()) / 100);
    if (coupon.maxDiscount) {
      discount = Math.min(discount, parseFloat(coupon.maxDiscount.toString()));
    }
  } else if (coupon.type === CouponType.FIXED_AMOUNT) {
    discount = Math.min(parseFloat(coupon.value.toString()), eligibleSubtotal);
  }

  return {
    coupon,
    discount,
    overallSubtotal,
    eligibleSubtotal,
  };
};

/**
 * Validate Coupon Endpoint
 * POST /api/v1/coupons/validate
 */
export const validateAndApplyCoupon = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    const { code, cartItems } = req.body;

    if (!code) {
      return res.status(400).json({ success: false, message: 'Coupon code is required.' });
    }

    const result = await validateCouponLogic(code, userId, cartItems);

    return res.status(200).json({
      success: true,
      message: 'Coupon validated successfully.',
      data: {
        code: result.coupon.code,
        type: result.coupon.type,
        value: result.coupon.value,
        discount: result.discount,
        overallSubtotal: result.overallSubtotal,
        eligibleSubtotal: result.eligibleSubtotal,
      },
    });
  } catch (error: any) {
    return res.status(400).json({ success: false, message: error.message || 'Validation failed.' });
  }
};

/**
 * Admin: Create New Coupon
 * POST /api/v1/coupons/admin/create
 */
export const createCoupon = async (req: Request, res: Response) => {
  try {
    const {
      code,
      type,
      value,
      minOrderValue,
      maxDiscount,
      startsAt,
      expiresAt,
      usageLimit,
      userUsageLimit,
      categoryId,
      referrerEmail,
      isFirstOrderOnly,
    } = req.body;

    if (!code || !type || value === undefined || !startsAt || !expiresAt) {
      return res.status(400).json({
        success: false,
        message: 'Required fields: code, type, value, startsAt, expiresAt.',
      });
    }

    if (type !== 'PERCENTAGE' && type !== 'FIXED_AMOUNT') {
      return res.status(400).json({ success: false, message: 'Type must be PERCENTAGE or FIXED_AMOUNT.' });
    }

    // Check if code already exists
    const codeUpper = code.trim().toUpperCase();
    const existing = await prisma.coupon.findUnique({ where: { code: codeUpper } });
    if (existing) {
      return res.status(400).json({ success: false, message: `Coupon with code "${codeUpper}" already exists.` });
    }

    // Resolve referrer email to ID if provided
    let referrerId: string | null = null;
    if (referrerEmail) {
      const user = await prisma.user.findUnique({ where: { email: referrerEmail.trim() } });
      if (!user) {
        return res.status(400).json({ success: false, message: `No user found with email "${referrerEmail}".` });
      }
      referrerId = user.id;
    }

    // Validate dates
    const start = new Date(startsAt);
    const expire = new Date(expiresAt);
    if (expire <= start) {
      return res.status(400).json({ success: false, message: 'Expiration date must be after startsAt date.' });
    }

    const coupon = await prisma.coupon.create({
      data: {
        code: codeUpper,
        type: type as CouponType,
        value,
        minOrderValue: minOrderValue || 0.0,
        maxDiscount: maxDiscount || null,
        startsAt: start,
        expiresAt: expire,
        usageLimit: usageLimit !== undefined ? usageLimit : null,
        userUsageLimit: userUsageLimit !== undefined ? userUsageLimit : 1,
        categoryId: categoryId || null,
        referrerId,
        isFirstOrderOnly: !!isFirstOrderOnly,
      },
    });

    await logAuditEvent(
      req.user?.id || null,
      'COUPON_CREATE',
      'Coupon',
      coupon.id,
      null,
      coupon,
      req
    );

    return res.status(201).json({
      success: true,
      message: 'Coupon created successfully.',
      coupon,
    });
  } catch (error: any) {
    console.error('Create coupon error:', error);
    return res.status(550).json({ success: false, message: error.message || 'Failed to create coupon.' });
  }
};

/**
 * Admin: List All Coupons
 * GET /api/v1/coupons/admin/all
 */
export const getAdminCoupons = async (req: Request, res: Response) => {
  try {
    const coupons = await prisma.coupon.findMany({
      include: {
        category: { select: { name: true } },
        referrer: { select: { email: true, name: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    return res.status(200).json({
      success: true,
      coupons,
    });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Admin: Fetch Coupon Analytics
 * GET /api/v1/coupons/admin/analytics
 */
export const getCouponAnalytics = async (req: Request, res: Response) => {
  try {
    const coupons = await prisma.coupon.findMany({
      include: {
        orders: {
          select: {
            payableAmount: true,
            discountAmount: true,
          },
        },
        category: {
          select: { name: true },
        },
        referrer: {
          select: { name: true, email: true },
        },
      },
      orderBy: { usageCount: 'desc' },
    });

    const analytics = coupons.map((c) => {
      const ordersCount = c.orders.length;
      const totalDiscount = c.orders.reduce((sum, o) => sum + parseFloat(o.discountAmount.toString()), 0);
      const totalRevenue = c.orders.reduce((sum, o) => sum + parseFloat(o.payableAmount.toString()), 0);

      return {
        id: c.id,
        code: c.code,
        type: c.type,
        value: c.value,
        usageCount: c.usageCount,
        usageLimit: c.usageLimit,
        userUsageLimit: c.userUsageLimit,
        isActive: c.isActive,
        expiresAt: c.expiresAt,
        categoryName: c.category?.name || 'All Categories',
        referrerName: c.referrer?.name || c.referrer?.email || null,
        totalDiscount,
        totalRevenue,
        ordersCount,
      };
    });

    return res.status(200).json({
      success: true,
      analytics,
    });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Admin: Toggle Active or Delete Coupon
 * DELETE /api/v1/coupons/admin/:id
 */
export const deleteCoupon = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const coupon = await prisma.coupon.findUnique({
      where: { id },
      include: { _count: { select: { orders: true } } },
    });

    if (!coupon) {
      return res.status(404).json({ success: false, message: 'Coupon not found.' });
    }

    // Safe deletion check: if coupon has already been used in orders, soft delete (set inactive)
    if (coupon._count.orders > 0) {
      await prisma.coupon.update({
        where: { id },
        data: { isActive: false },
      });
      await logAuditEvent(
        req.user?.id || null,
        'COUPON_DEACTIVATE',
        'Coupon',
        id,
        { isActive: coupon.isActive },
        { isActive: false },
        req
      );
      return res.status(200).json({
        success: true,
        message: 'Coupon is linked to order histories. Deactivated/disabled successfully.',
      });
    }

    // Else delete completely
    await prisma.coupon.delete({ where: { id } });
    await logAuditEvent(
      req.user?.id || null,
      'COUPON_DELETE',
      'Coupon',
      id,
      coupon,
      null,
      req
    );

    return res.status(200).json({
      success: true,
      message: 'Coupon deleted successfully from platform database.',
    });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
};
