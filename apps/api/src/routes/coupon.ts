import { Router } from 'express';
import {
  validateAndApplyCoupon,
  createCoupon,
  getAdminCoupons,
  getCouponAnalytics,
  deleteCoupon,
} from '../controllers/coupon';
import { authMiddleware, restrictTo } from '../middleware/auth';
import { UserRole } from '@alphastryk/common';

const router = Router();

// Validate and apply coupon for user checkout (Authenticated customer)
router.post('/validate', authMiddleware, validateAndApplyCoupon);

// Administrative coupon management routes
router.get('/admin/all', authMiddleware, restrictTo(UserRole.ADMIN, UserRole.SUPER_ADMIN), getAdminCoupons);
router.post('/admin/create', authMiddleware, restrictTo(UserRole.ADMIN, UserRole.SUPER_ADMIN), createCoupon);
router.get('/admin/analytics', authMiddleware, restrictTo(UserRole.ADMIN, UserRole.SUPER_ADMIN), getCouponAnalytics);
router.delete('/admin/:id', authMiddleware, restrictTo(UserRole.ADMIN, UserRole.SUPER_ADMIN), deleteCoupon);

export default router;
