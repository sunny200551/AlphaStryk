import { Router } from 'express';
import {
  shipOrder,
  createTrackingCheckpoint,
  getTrackingLogs,
  getAdminFulfillments,
  carrierWebhook,
} from '../controllers/shipping';
import { authMiddleware, restrictTo } from '../middleware/auth';
import { UserRole } from '@alphastryk/common';

const router = Router();

// Admin Fulfillments & Checkpoint Controls
router.post('/admin/fulfill', authMiddleware, restrictTo(UserRole.ADMIN, UserRole.SUPER_ADMIN), shipOrder);
router.post('/admin/checkpoint', authMiddleware, restrictTo(UserRole.ADMIN, UserRole.SUPER_ADMIN), createTrackingCheckpoint);
router.get('/admin/fulfillments', authMiddleware, restrictTo(UserRole.ADMIN, UserRole.SUPER_ADMIN), getAdminFulfillments);

// Customer Timeline & Tracking logs
router.get('/track/:orderNumber', authMiddleware, getTrackingLogs);

// Webhook endpoint for Carrier status webhooks
router.post('/webhook', carrierWebhook);

export default router;
