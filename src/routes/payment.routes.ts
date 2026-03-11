import { Router } from 'express';
import { PaymentController } from '../controllers/payment.controller';
import { protect } from '../middlewares/auth.middleware';

const router = Router();
const paymentController = new PaymentController();

/**
 * @openapi
 * /payments/create-order:
 *   post:
 *     summary: Create a Razorpay order
 *     tags: [Payments]
 *     security:
 *       - bearerAuth: []
 */
router.post('/create-order', protect, paymentController.createOrder);

/**
 * @openapi
 * /payments/verify:
 *   post:
 *     summary: Verify Razorpay payment and create order
 *     tags: [Payments]
 *     security:
 *       - bearerAuth: []
 */
router.post('/verify', protect, paymentController.verifyPayment);

export default router;
