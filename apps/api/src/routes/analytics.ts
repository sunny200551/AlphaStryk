import { Router } from 'express';
import {
  getDashboardWidgets,
  getRevenueAnalytics,
  getOrderAnalytics,
  getCustomerAnalytics,
  getInventoryAnalytics,
  getRefundAnalytics,
  getCouponAnalytics,
  getAuditLogsFiltered,
  exportCSV,
  getAdminsList,
  promoteUserToAdmin,
  demoteAdminToCustomer,
  createNewAdmin,
} from '../controllers/analytics';
import { authMiddleware, restrictTo } from '../middleware/auth';
import { UserRole } from '@alphastryk/common';

const router = Router();

// Secure all endpoints with auth token verification
router.use(authMiddleware);

// Admin-level queries
router.get('/dashboard', restrictTo(UserRole.ADMIN, UserRole.SUPER_ADMIN), getDashboardWidgets);
router.get('/revenue', restrictTo(UserRole.ADMIN, UserRole.SUPER_ADMIN), getRevenueAnalytics);
router.get('/orders', restrictTo(UserRole.ADMIN, UserRole.SUPER_ADMIN), getOrderAnalytics);
router.get('/customers', restrictTo(UserRole.ADMIN, UserRole.SUPER_ADMIN), getCustomerAnalytics);
router.get('/inventory', restrictTo(UserRole.ADMIN, UserRole.SUPER_ADMIN), getInventoryAnalytics);
router.get('/refunds', restrictTo(UserRole.ADMIN, UserRole.SUPER_ADMIN), getRefundAnalytics);
router.get('/coupons', restrictTo(UserRole.ADMIN, UserRole.SUPER_ADMIN), getCouponAnalytics);
router.get('/export/:type', restrictTo(UserRole.ADMIN, UserRole.SUPER_ADMIN), exportCSV);

// Super-admin-only system control endpoints
router.get('/audit-logs', restrictTo(UserRole.SUPER_ADMIN), getAuditLogsFiltered);
router.get('/admin/list', restrictTo(UserRole.SUPER_ADMIN), getAdminsList);
router.post('/admin/promote', restrictTo(UserRole.SUPER_ADMIN), promoteUserToAdmin);
router.post('/admin/demote', restrictTo(UserRole.SUPER_ADMIN), demoteAdminToCustomer);
router.post('/admin/create', restrictTo(UserRole.SUPER_ADMIN), createNewAdmin);

export default router;
