import { Router } from 'express';
import multer from 'multer';
import {
  saveDesign,
  getDesignDetail,
  getUserDesigns,
  getAdminDesigns,
  uploadDesignAsset,
} from '../controllers/design';
import { authMiddleware, restrictTo } from '../middleware/auth';
import { UserRole } from '@alphastryk/common';

const router = Router();

// Multer in-memory storage configuration
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit for high-res team logos
  },
});

// Customer-facing Customizer routes
router.post('/', authMiddleware, saveDesign);
router.get('/my-designs', authMiddleware, getUserDesigns);
router.get('/detail/:id', authMiddleware, getDesignDetail);
router.post('/upload', authMiddleware, upload.single('file'), uploadDesignAsset);

// Administrative route to list custom order graphics
router.get('/admin/all', authMiddleware, restrictTo(UserRole.ADMIN, UserRole.SUPER_ADMIN), getAdminDesigns);

export default router;
