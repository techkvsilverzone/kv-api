import { Router } from 'express';
import { CouponController } from '../controllers/coupon.controller';
import { protect } from '../middlewares/auth.middleware';

const router = Router();
const couponController = new CouponController();

/**
 * @openapi
 * /coupons/apply:
 *   post:
 *     summary: Validate and apply a coupon
 *     tags: [Coupons]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/ApplyCouponInput'
 *     responses:
 *       200:
 *         description: Coupon validation result
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApplyCouponResponse'
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 */
router.post('/apply', protect, couponController.applyCoupon);

export default router;
