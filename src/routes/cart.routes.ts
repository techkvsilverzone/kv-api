import { Router } from 'express';
import { CartController } from '../controllers/cart.controller';
import { protect } from '../middlewares/auth.middleware';

const router = Router();
const cartController = new CartController();

/**
 * @openapi
 * /cart:
 *   get:
 *     summary: Get my cart
 *     tags: [Cart]
 *     security:
 *       - bearerAuth: []
 */
router.get('/', protect, cartController.getCart);

/**
 * @openapi
 * /cart/items:
 *   post:
 *     summary: Add/Update cart item
 *     tags: [Cart]
 *     security:
 *       - bearerAuth: []
 */
router.post('/items', protect, cartController.updateCartItem);

/**
 * @openapi
 * /cart/items/{id}:
 *   delete:
 *     summary: Remove item from cart
 *     tags: [Cart]
 *     security:
 *       - bearerAuth: []
 */
router.delete('/items/:id', protect, cartController.removeCartItem);

export default router;
