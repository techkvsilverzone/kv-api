import { Router } from 'express';
import { WishlistController } from '../controllers/wishlist.controller';
import { protect } from '../middlewares/auth.middleware';

const router = Router();
const wishlistController = new WishlistController();

router.use(protect);

/**
 * @openapi
 * /wishlist:
 *   get:
 *     summary: Get the user's wishlist
 *     tags: [Wishlist]
 *     security:
 *       - bearerAuth: []
 */
router.get('/', wishlistController.getWishlist);

/**
 * @openapi
 * /wishlist/items:
 *   post:
 *     summary: Add a product to the wishlist
 *     tags: [Wishlist]
 *     security:
 *       - bearerAuth: []
 */
router.post('/items', wishlistController.addItem);

/**
 * @openapi
 * /wishlist/items/{productId}:
 *   delete:
 *     summary: Remove a product from the wishlist
 *     tags: [Wishlist]
 *     security:
 *       - bearerAuth: []
 */
router.delete('/items/:productId', wishlistController.removeItem);

export default router;
