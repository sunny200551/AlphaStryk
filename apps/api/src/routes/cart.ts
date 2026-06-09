import { Router } from 'express';
import { getCart, addToCart, updateCartItem, removeFromCart, syncCart } from '../controllers/cart';
import { authMiddleware } from '../middleware/auth';

const router = Router();

// Secure all cart endpoints
router.use(authMiddleware);

router.get('/', getCart);
router.post('/', addToCart);
router.put('/:itemId', updateCartItem);
router.delete('/:itemId', removeFromCart);
router.post('/sync', syncCart);

export default router;
