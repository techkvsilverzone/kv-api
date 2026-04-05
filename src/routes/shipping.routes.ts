import { Router } from 'express';
import { ShippingController } from '../controllers/shipping.controller';
import { protect, admin } from '../middlewares/auth.middleware';

const router = Router();
const shippingController = new ShippingController();

/**
 * @openapi
 * /shipping/pincode-rates:
 *   get:
 *     summary: Get all pincode delivery rates
 *     tags: [Shipping]
 *     security:
 *       - bearerAuth: []
 */
router.get('/pincode-rates', protect, admin, shippingController.getPincodeRates);

/**
 * @openapi
 * /shipping/pincode-rates:
 *   post:
 *     summary: Add a pincode delivery rate
 *     tags: [Shipping]
 *     security:
 *       - bearerAuth: []
 */
router.post('/pincode-rates', protect, admin, shippingController.addPincodeRate);

/**
 * @openapi
 * /shipping/pincode-rates/{pincode}:
 *   delete:
 *     summary: Remove a pincode delivery rate
 *     tags: [Shipping]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: pincode
 *         required: true
 *         schema:
 *           type: string
 */
router.delete('/pincode-rates/:pincode', protect, admin, shippingController.deletePincodeRate);

export default router;
