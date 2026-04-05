import { Router } from 'express';
import { DeliveryController } from '../controllers/delivery.controller';

const router = Router();
const deliveryController = new DeliveryController();

/**
 * @openapi
 * /delivery/check:
 *   get:
 *     summary: Check pincode delivery serviceability
 *     tags: [Delivery]
 *     parameters:
 *       - in: query
 *         name: pincode
 *         required: true
 *         schema:
 *           type: string
 *           pattern: '^\d{6}$'
 *     responses:
 *       200:
 *         description: Serviceability result
 */
router.get('/check', deliveryController.checkPincode);

export default router;
