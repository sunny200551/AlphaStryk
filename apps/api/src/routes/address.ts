import { Router } from 'express';
import { getAddresses, createAddress, deleteAddress } from '../controllers/address';
import { authMiddleware } from '../middleware/auth';

const router = Router();

// Secure all address endpoints
router.use(authMiddleware);

router.get('/', getAddresses);
router.post('/', createAddress);
router.delete('/:id', deleteAddress);

export default router;
