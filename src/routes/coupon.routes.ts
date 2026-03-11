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
 */
router.post('/apply', protect, couponController.applyCoupon);

export default router;
