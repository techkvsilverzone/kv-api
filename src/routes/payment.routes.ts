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
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CreatePaymentOrderInput'
 *     responses:
 *       201:
 *         description: Razorpay order created (amount computed server-side)
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/CreatePaymentOrderResponse'
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       409:
 *         $ref: '#/components/responses/Conflict'
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
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/VerifyPaymentInput'
 *     responses:
 *       200:
 *         description: Payment verified and order created
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/VerifyPaymentResponse'
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       409:
 *         $ref: '#/components/responses/Conflict'
 */
router.post('/verify', protect, paymentController.verifyPayment);

export default router;
