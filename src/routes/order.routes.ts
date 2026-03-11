import { Router } from 'express';
import { OrderController } from '../controllers/order.controller';
import { protect } from '../middlewares/auth.middleware';

const router = Router();
const orderController = new OrderController();

/**
 * @openapi
 * /orders:
 *   post:
 *     summary: Create a new order
 *     tags: [Orders]
 *     security:
 *       - bearerAuth: []
 */
router.post('/', protect, orderController.createOrder);

/**
 * @openapi
 * /orders/me:
 *   get:
 *     summary: Get my orders history
 *     tags: [Orders]
 *     security:
 *       - bearerAuth: []
 */
router.get('/me', protect, orderController.getMyOrders);

export default router;
