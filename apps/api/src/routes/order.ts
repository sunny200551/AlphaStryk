import { Router } from 'express';
import {
  createOrder,
  getOrderHistory,
  getOrderDetail,
  getAdminOrders,
  updateOrderStatus,
} from '../controllers/order';
import { authMiddleware, restrictTo } from '../middleware/auth';
import { UserRole } from '@alphastryk/common';

const router = Router();

// Ensure authentication for all order-related operations
router.use(authMiddleware);

router.post('/', createOrder);
router.get('/history', getOrderHistory);
router.get('/detail/:orderNumber', getOrderDetail);

// Administrative order endpoints
router.get('/admin/all', restrictTo(UserRole.ADMIN, UserRole.SUPER_ADMIN), getAdminOrders);
router.put('/admin/:id/status', restrictTo(UserRole.ADMIN, UserRole.SUPER_ADMIN), updateOrderStatus);

export default router;
