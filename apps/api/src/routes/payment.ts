import { Router } from 'express';
import {
  initiatePayment,
  verifyRazorpayPayment,
  phonepeRedirectCallback,
  razorpayWebhook,
  phonepeWebhook,
  retryPayment,
  initiateRefund,
  getAdminPayments,
} from '../controllers/payment';
import { authMiddleware, restrictTo } from '../middleware/auth';
import { UserRole } from '@alphastryk/common';

const router = Router();

// User Initiated Transactions (Requires Auth)
router.post('/initiate', authMiddleware, initiatePayment);
router.post('/verify', authMiddleware, verifyRazorpayPayment);
router.post('/retry', authMiddleware, retryPayment);

// Public Redirect & Webhooks (Verify inside controllers)
router.get('/phonepe/callback', phonepeRedirectCallback);
router.post('/phonepe/callback', phonepeRedirectCallback);
router.post('/razorpay/webhook', razorpayWebhook);
router.post('/phonepe/webhook', phonepeWebhook);

// Admin Control Panel Endpoints (Admin & Super Admin only)
router.get('/admin/logs', authMiddleware, restrictTo(UserRole.ADMIN, UserRole.SUPER_ADMIN), getAdminPayments);
router.post('/admin/:paymentId/refund', authMiddleware, restrictTo(UserRole.ADMIN, UserRole.SUPER_ADMIN), initiateRefund);

export default router;
