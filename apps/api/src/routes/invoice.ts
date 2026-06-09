import { Router } from 'express';
import {
  getUserInvoices,
  downloadInvoicePdf,
  emailInvoice,
  getAdminInvoices,
} from '../controllers/invoice';
import { authMiddleware, restrictTo } from '../middleware/auth';
import { UserRole } from '@alphastryk/common';

const router = Router();

// Customer Endpoints (Authenticated)
router.get('/history', authMiddleware, getUserInvoices);
router.get('/download/:invoiceNumber', authMiddleware, downloadInvoicePdf);
router.post('/email/:invoiceNumber', authMiddleware, emailInvoice);

// Admin Dashboard Analytics (Admin & Super Admin only)
router.get('/admin/all', authMiddleware, restrictTo(UserRole.ADMIN, UserRole.SUPER_ADMIN), getAdminInvoices);

export default router;
