import { Router } from 'express';
import multer from 'multer';
import {
  getCategories,
  createCategory,
  getProducts,
  getProductBySlug,
  getAdminProducts,
  createProduct,
  updateProduct,
  deleteProduct,
  getLowStockAlerts,
  uploadProductImage,
} from '../controllers/product';
import { authMiddleware, restrictTo } from '../middleware/auth';
import { UserRole } from '@alphastryk/common';

const router = Router();

// Multer memory buffer stream configuration
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
});

// ==========================================
// 1. PUBLIC CATALOG ROUTINGS
// ==========================================
router.get('/', getProducts);
router.get('/categories', getCategories);
router.get('/detail/:slug', getProductBySlug);

// ==========================================
// 2. ADMINISTRATIVE CONTROL ROUTINGS
// ==========================================
router.get('/admin/all', authMiddleware, restrictTo(UserRole.ADMIN, UserRole.SUPER_ADMIN), getAdminProducts);
router.get('/admin/low-stock', authMiddleware, restrictTo(UserRole.ADMIN, UserRole.SUPER_ADMIN), getLowStockAlerts);
router.post('/admin/upload', authMiddleware, restrictTo(UserRole.ADMIN, UserRole.SUPER_ADMIN), upload.single('image'), uploadProductImage);

router.post('/', authMiddleware, restrictTo(UserRole.ADMIN, UserRole.SUPER_ADMIN), createProduct);
router.put('/:id', authMiddleware, restrictTo(UserRole.ADMIN, UserRole.SUPER_ADMIN), updateProduct);
router.delete('/:id', authMiddleware, restrictTo(UserRole.ADMIN, UserRole.SUPER_ADMIN), deleteProduct);

router.post('/categories', authMiddleware, restrictTo(UserRole.ADMIN, UserRole.SUPER_ADMIN), createCategory);

export default router;
