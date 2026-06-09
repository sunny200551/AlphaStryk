import { Request, Response } from 'express';
import { prisma } from '@alphastryk/db';
import { UserRole } from '@alphastryk/common';
import bcrypt from 'bcryptjs';

// Helpers to extract and parse filters
const getDateRange = (req: Request) => {
  const now = new Date();
  const defaultStart = new Date();
  defaultStart.setDate(now.getDate() - 30);

  const startDate = req.query.startDate ? new Date(req.query.startDate as string) : defaultStart;
  const endDate = req.query.endDate ? new Date(req.query.endDate as string) : now;

  return { startDate, endDate };
};

// 1. Dashboard Widget KPIs
export const getDashboardWidgets = async (req: Request, res: Response) => {
  try {
    const { startDate, endDate } = getDateRange(req);

    // Total completed orders & revenue
    const orders = await prisma.order.findMany({
      where: {
        createdAt: { gte: startDate, lte: endDate },
        status: { not: 'CANCELLED' },
      },
      select: {
        id: true,
        payableAmount: true,
        customerId: true,
        status: true,
      },
    });

    const totalRevenue = orders.reduce((sum, o) => sum + parseFloat(o.payableAmount.toString()), 0);
    const totalOrders = orders.length;
    const aov = totalOrders > 0 ? totalRevenue / totalOrders : 0;

    const uniqueCustomers = new Set(orders.map((o) => o.customerId)).size;

    // Low stock count (stock < 10)
    const lowStockCount = await prisma.productVariant.count({
      where: { stock: { lt: 10 }, isActive: true },
    });

    // Active coupons
    const activeCouponsCount = await prisma.coupon.count({
      where: { isActive: true, expiresAt: { gte: new Date() } },
    });

    return res.status(200).json({
      success: true,
      data: {
        totalRevenue,
        totalOrders,
        aov,
        uniqueCustomers,
        lowStockCount,
        activeCouponsCount,
      },
    });
  } catch (error: any) {
    console.error('Widgets retrieval error:', error);
    return res.status(500).json({ success: false, message: error.message || 'Internal server error.' });
  }
};

// 2. Revenue Analytics (trends over time + categories)
export const getRevenueAnalytics = async (req: Request, res: Response) => {
  try {
    const { startDate, endDate } = getDateRange(req);

    const orders = await prisma.order.findMany({
      where: {
        createdAt: { gte: startDate, lte: endDate },
        status: { not: 'CANCELLED' },
      },
      orderBy: { createdAt: 'asc' },
      select: {
        payableAmount: true,
        createdAt: true,
      },
    });

    // Group revenue by date (YYYY-MM-DD)
    const trendMap: Record<string, number> = {};
    orders.forEach((o) => {
      const day = o.createdAt.toISOString().split('T')[0];
      trendMap[day] = (trendMap[day] || 0) + parseFloat(o.payableAmount.toString());
    });

    const chartData = Object.keys(trendMap).map((date) => ({
      label: date,
      value: trendMap[date],
    }));

    // Category revenue breakdown (join orderItems -> variants -> products -> categories)
    const items = await prisma.orderItem.findMany({
      where: {
        order: {
          createdAt: { gte: startDate, lte: endDate },
          status: { not: 'CANCELLED' },
        },
      },
      select: {
        priceAtPurchase: true,
        quantity: true,
        variant: {
          select: {
            product: {
              select: {
                category: {
                  select: { name: true },
                },
              },
            },
          },
        },
      },
    });

    const categoryMap: Record<string, number> = {};
    items.forEach((item) => {
      const catName = item.variant?.product?.category?.name || 'Uncategorized';
      const itemRev = parseFloat(item.priceAtPurchase.toString()) * item.quantity;
      categoryMap[catName] = (categoryMap[catName] || 0) + itemRev;
    });

    const categoryBreakdown = Object.keys(categoryMap).map((cat) => ({
      category: cat,
      revenue: categoryMap[cat],
    }));

    return res.status(200).json({
      success: true,
      data: {
        revenueTimeline: chartData,
        categoryBreakdown,
      },
    });
  } catch (error: any) {
    console.error('Revenue analytics error:', error);
    return res.status(500).json({ success: false, message: error.message || 'Internal server error.' });
  }
};

// 3. Order Analytics (status & trends)
export const getOrderAnalytics = async (req: Request, res: Response) => {
  try {
    const { startDate, endDate } = getDateRange(req);

    const orders = await prisma.order.findMany({
      where: {
        createdAt: { gte: startDate, lte: endDate },
      },
      select: {
        status: true,
        createdAt: true,
      },
    });

    // Count statuses
    const statusMap: Record<string, number> = {};
    orders.forEach((o) => {
      statusMap[o.status] = (statusMap[o.status] || 0) + 1;
    });

    const statusCounts = Object.keys(statusMap).map((status) => ({
      status,
      count: statusMap[status],
    }));

    // Orders trend over time
    const trendMap: Record<string, number> = {};
    orders.forEach((o) => {
      const day = o.createdAt.toISOString().split('T')[0];
      trendMap[day] = (trendMap[day] || 0) + 1;
    });

    const orderTimeline = Object.keys(trendMap).map((date) => ({
      label: date,
      value: trendMap[date],
    }));

    return res.status(200).json({
      success: true,
      data: {
        statusBreakdown: statusCounts,
        orderTimeline,
      },
    });
  } catch (error: any) {
    console.error('Order analytics error:', error);
    return res.status(500).json({ success: false, message: error.message || 'Internal server error.' });
  }
};

// 4. Customer Analytics (new cohorts & CLV bands)
export const getCustomerAnalytics = async (req: Request, res: Response) => {
  try {
    const { startDate, endDate } = getDateRange(req);

    // New customers registered in date range
    const newCustomers = await prisma.user.findMany({
      where: {
        role: 'CUSTOMER',
        createdAt: { gte: startDate, lte: endDate },
      },
      select: { createdAt: true },
    });

    const trendMap: Record<string, number> = {};
    newCustomers.forEach((c) => {
      const day = c.createdAt.toISOString().split('T')[0];
      trendMap[day] = (trendMap[day] || 0) + 1;
    });

    const registrationTimeline = Object.keys(trendMap).map((date) => ({
      label: date,
      value: trendMap[date],
    }));

    // Customer Lifetime Value (CLV) cohorts
    const customerOrders = await prisma.order.findMany({
      where: { status: { not: 'CANCELLED' } },
      select: {
        customerId: true,
        payableAmount: true,
        customer: {
          select: { name: true, email: true },
        },
      },
    });

    const clvMap: Record<string, { name: string; email: string; totalSpend: number; ordersCount: number }> = {};
    customerOrders.forEach((o) => {
      if (!clvMap[o.customerId]) {
        clvMap[o.customerId] = {
          name: o.customer.name || 'Anonymous',
          email: o.customer.email,
          totalSpend: 0,
          ordersCount: 0,
        };
      }
      clvMap[o.customerId].totalSpend += parseFloat(o.payableAmount.toString());
      clvMap[o.customerId].ordersCount += 1;
    });

    const customersCLV = Object.keys(clvMap).map((id) => ({
      id,
      ...clvMap[id],
    })).sort((a, b) => b.totalSpend - a.totalSpend).slice(0, 20); // Top 20 customers

    return res.status(200).json({
      success: true,
      data: {
        registrationTimeline,
        topCustomers: customersCLV,
      },
    });
  } catch (error: any) {
    console.error('Customer analytics error:', error);
    return res.status(500).json({ success: false, message: error.message || 'Internal server error.' });
  }
};

// 5. Inventory Analytics
export const getInventoryAnalytics = async (req: Request, res: Response) => {
  try {
    const lowStockItems = await prisma.productVariant.findMany({
      where: { stock: { lt: 10 }, isActive: true },
      include: {
        product: {
          select: { name: true },
        },
      },
      orderBy: { stock: 'asc' },
    });

    const allVariants = await prisma.productVariant.findMany({
      where: { isActive: true },
      include: {
        product: {
          select: {
            basePrice: true,
            category: { select: { name: true } },
          },
        },
      },
    });

    let totalValuation = 0;
    const categoryStock: Record<string, { totalStock: number; count: number }> = {};

    allVariants.forEach((v) => {
      const price = parseFloat(v.product.basePrice.toString()) + parseFloat(v.priceOffset.toString());
      totalValuation += price * v.stock;

      const catName = v.product.category?.name || 'Uncategorized';
      if (!categoryStock[catName]) {
        categoryStock[catName] = { totalStock: 0, count: 0 };
      }
      categoryStock[catName].totalStock += v.stock;
      categoryStock[catName].count += 1;
    });

    const categoryDistribution = Object.keys(categoryStock).map((cat) => ({
      category: cat,
      totalStock: categoryStock[cat].totalStock,
      averageStock: categoryStock[cat].totalStock / categoryStock[cat].count,
    }));

    return res.status(200).json({
      success: true,
      data: {
        totalValuation,
        lowStockItems: lowStockItems.map((item) => ({
          id: item.id,
          sku: item.sku,
          name: `${item.product.name} (${item.name})`,
          stock: item.stock,
        })),
        categoryDistribution,
      },
    });
  } catch (error: any) {
    console.error('Inventory analytics error:', error);
    return res.status(500).json({ success: false, message: error.message || 'Internal server error.' });
  }
};

// 6. Refund Analytics
export const getRefundAnalytics = async (req: Request, res: Response) => {
  try {
    const { startDate, endDate } = getDateRange(req);

    const refunds = await prisma.refund.findMany({
      where: {
        createdAt: { gte: startDate, lte: endDate },
      },
      select: {
        amount: true,
        status: true,
        reason: true,
      },
    });

    const totalRefunded = refunds.reduce((sum, r) => sum + parseFloat(r.amount.toString()), 0);

    const statusMap: Record<string, number> = {};
    const reasonMap: Record<string, number> = {};

    refunds.forEach((r) => {
      statusMap[r.status] = (statusMap[r.status] || 0) + 1;
      reasonMap[r.reason] = (reasonMap[r.reason] || 0) + 1;
    });

    const statusBreakdown = Object.keys(statusMap).map((status) => ({ status, count: statusMap[status] }));
    const reasonBreakdown = Object.keys(reasonMap).map((reason) => ({ reason, count: reasonMap[reason] }));

    return res.status(200).json({
      success: true,
      data: {
        totalRefunded,
        statusBreakdown,
        reasonBreakdown,
      },
    });
  } catch (error: any) {
    console.error('Refund analytics error:', error);
    return res.status(500).json({ success: false, message: error.message || 'Internal server error.' });
  }
};

// 7. Coupon Analytics
export const getCouponAnalytics = async (req: Request, res: Response) => {
  try {
    const { startDate, endDate } = getDateRange(req);

    const couponUsages = await prisma.couponUsage.findMany({
      where: {
        usedAt: { gte: startDate, lte: endDate },
      },
      include: {
        coupon: {
          select: { code: true, value: true, type: true },
        },
        order: {
          select: { totalAmount: true, payableAmount: true, discountAmount: true },
        },
      },
    });

    const performanceMap: Record<string, { count: number; totalDiscount: number; revenueGenerated: number }> = {};

    couponUsages.forEach((usage) => {
      const code = usage.coupon.code;
      const discount = parseFloat(usage.order.discountAmount.toString());
      const revenue = parseFloat(usage.order.payableAmount.toString());

      if (!performanceMap[code]) {
        performanceMap[code] = { count: 0, totalDiscount: 0, revenueGenerated: 0 };
      }

      performanceMap[code].count += 1;
      performanceMap[code].totalDiscount += discount;
      performanceMap[code].revenueGenerated += revenue;
    });

    const couponMetrics = Object.keys(performanceMap).map((code) => ({
      code,
      count: performanceMap[code].count,
      totalDiscount: performanceMap[code].totalDiscount,
      revenueGenerated: performanceMap[code].revenueGenerated,
    }));

    return res.status(200).json({
      success: true,
      data: couponMetrics,
    });
  } catch (error: any) {
    console.error('Coupon analytics error:', error);
    return res.status(500).json({ success: false, message: error.message || 'Internal server error.' });
  }
};

// 8. Audit Logs (with search filters & pagination)
export const getAuditLogsFiltered = async (req: Request, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 15;
    const search = (req.query.search as string) || '';
    const action = (req.query.action as string) || '';
    const entityType = (req.query.entityType as string) || '';
    const skip = (page - 1) * limit;

    const whereClause: any = {};

    if (search) {
      whereClause.actor = {
        email: { contains: search, mode: 'insensitive' },
      };
    }

    if (action) {
      whereClause.action = action;
    }

    if (entityType) {
      whereClause.entityType = entityType;
    }

    if (req.query.startDate && req.query.endDate) {
      whereClause.createdAt = {
        gte: new Date(req.query.startDate as string),
        lte: new Date(req.query.endDate as string),
      };
    }

    const total = await prisma.auditLog.count({ where: whereClause });
    const logs = await prisma.auditLog.findMany({
      where: whereClause,
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
      include: {
        actor: {
          select: {
            email: true,
            name: true,
            role: true,
          },
        },
      },
    });

    return res.status(200).json({
      success: true,
      data: {
        logs,
        pagination: {
          total,
          page,
          pages: Math.ceil(total / limit),
          limit,
        },
      },
    });
  } catch (error: any) {
    console.error('Audit logs retrieval error:', error);
    return res.status(500).json({ success: false, message: error.message || 'Internal server error.' });
  }
};

// 9. Exports CSV Handler
export const exportCSV = async (req: Request, res: Response) => {
  try {
    const type = req.params.type; // 'revenue' | 'orders' | 'customers' | 'inventory'
    let csvContent = '';
    let filename = `export_${type}_${Date.now()}.csv`;

    if (type === 'revenue') {
      const payments = await prisma.payment.findMany({
        where: { status: 'COMPLETED' },
        include: { order: { select: { orderNumber: true } } },
      });
      csvContent = 'Payment ID,Order Number,Transaction ID,Amount,Timestamp\n';
      payments.forEach((p) => {
        csvContent += `"${p.id}","${p.order?.orderNumber || 'N/A'}","${p.transactionId}","${p.amount}","${p.createdAt.toISOString()}"\n`;
      });
    } else if (type === 'orders') {
      const orders = await prisma.order.findMany({
        include: { customer: { select: { email: true } } },
      });
      csvContent = 'Order Number,Customer Email,Status,Payable Amount,Tax,Shipping,Date\n';
      orders.forEach((o) => {
        csvContent += `"${o.orderNumber}","${o.customer?.email || 'N/A'}","${o.status}","${o.payableAmount}","${o.taxAmount}","${o.shippingCost}","${o.createdAt.toISOString()}"\n`;
      });
    } else if (type === 'customers') {
      const customers = await prisma.user.findMany({ where: { role: 'CUSTOMER' } });
      csvContent = 'User ID,Email,Name,Created At,Verified\n';
      customers.forEach((c) => {
        csvContent += `"${c.id}","${c.email}","${c.name || 'N/A'}","${c.createdAt.toISOString()}","${c.isEmailVerified}"\n`;
      });
    } else if (type === 'inventory') {
      const variants = await prisma.productVariant.findMany({
        include: { product: { select: { name: true, basePrice: true } } },
      });
      csvContent = 'SKU,Product Name,Variant Name,Price,Stock\n';
      variants.forEach((v) => {
        const price = parseFloat(v.product.basePrice.toString()) + parseFloat(v.priceOffset.toString());
        csvContent += `"${v.sku}","${v.product.name}","${v.name}","${price}","${v.stock}"\n`;
      });
    } else {
      return res.status(400).json({ success: false, message: 'Invalid export type specification.' });
    }

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    return res.status(200).send(csvContent);
  } catch (error: any) {
    console.error('Export CSV error:', error);
    return res.status(500).json({ success: false, message: error.message || 'Internal server error.' });
  }
};

// 10. List admins
export const getAdminsList = async (req: Request, res: Response) => {
  try {
    const admins = await prisma.user.findMany({
      where: {
        role: { in: ['ADMIN', 'SUPER_ADMIN'] },
        deletedAt: null,
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    return res.status(200).json({
      success: true,
      data: admins,
    });
  } catch (error: any) {
    console.error('Admins retrieval error:', error);
    return res.status(500).json({ success: false, message: error.message || 'Internal server error.' });
  }
};

// 11. Promote customer to Admin role
export const promoteUserToAdmin = async (req: Request, res: Response) => {
  try {
    const { userId } = req.body;

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }

    const originalRole = user.role;
    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: { role: 'ADMIN' },
    });

    // Write audit log
    await prisma.auditLog.create({
      data: {
        actorId: req.user?.id || null,
        action: 'USER_PROMOTE_ADMIN',
        entityType: 'User',
        entityId: userId,
        oldValues: { role: originalRole },
        newValues: { role: 'ADMIN' },
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
      },
    });

    return res.status(200).json({
      success: true,
      message: `${user.email} promoted to ADMIN role successfully.`,
      data: updatedUser,
    });
  } catch (error: any) {
    console.error('Admin promotion error:', error);
    return res.status(500).json({ success: false, message: error.message || 'Internal server error.' });
  }
};

// 12. Demote Admin user
export const demoteAdminToCustomer = async (req: Request, res: Response) => {
  try {
    const { userId } = req.body;

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }

    if (user.role === 'SUPER_ADMIN') {
      return res.status(400).json({ success: false, message: 'Cannot demote a SUPER_ADMIN account.' });
    }

    const originalRole = user.role;
    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: { role: 'CUSTOMER' },
    });

    // Write audit log
    await prisma.auditLog.create({
      data: {
        actorId: req.user?.id || null,
        action: 'USER_DEMOTE_CUSTOMER',
        entityType: 'User',
        entityId: userId,
        oldValues: { role: originalRole },
        newValues: { role: 'CUSTOMER' },
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
      },
    });

    return res.status(200).json({
      success: true,
      message: `${user.email} demoted to CUSTOMER role successfully.`,
      data: updatedUser,
    });
  } catch (error: any) {
    console.error('Admin demotion error:', error);
    return res.status(500).json({ success: false, message: error.message || 'Internal server error.' });
  }
};

// 13. Create new Admin directly
export const createNewAdmin = async (req: Request, res: Response) => {
  try {
    const { email, password, name } = req.body;

    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'Email and password are required.' });
    }

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return res.status(400).json({ success: false, message: 'User with this email already exists.' });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const newAdmin = await prisma.user.create({
      data: {
        email,
        passwordHash,
        name: name || null,
        role: 'ADMIN',
        isEmailVerified: true,
      },
    });

    // Write audit log
    await prisma.auditLog.create({
      data: {
        actorId: req.user?.id || null,
        action: 'ADMIN_ACCOUNT_CREATE',
        entityType: 'User',
        entityId: newAdmin.id,
        oldValues: null as any,
        newValues: { email, role: 'ADMIN', name },
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
      },
    });

    return res.status(201).json({
      success: true,
      message: 'New administrative account created successfully.',
      data: {
        id: newAdmin.id,
        email: newAdmin.email,
        name: newAdmin.name,
        role: newAdmin.role,
      },
    });
  } catch (error: any) {
    console.error('Create admin error:', error);
    return res.status(500).json({ success: false, message: error.message || 'Internal server error.' });
  }
};
