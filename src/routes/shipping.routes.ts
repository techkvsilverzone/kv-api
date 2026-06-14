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
 *     responses:
 *       200:
 *         description: List of pincode rates
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: success
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/PincodeRate'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
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
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [pincode, label, rate]
 *             properties:
 *               pincode:
 *                 type: string
 *                 example: "600001"
 *               label:
 *                 type: string
 *                 example: Chennai Central
 *               rate:
 *                 type: number
 *                 example: 50
 *     responses:
 *       201:
 *         description: Pincode rate created
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: success
 *                 data:
 *                   $ref: '#/components/schemas/PincodeRate'
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
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
 *     responses:
 *       200:
 *         description: Pincode rate removed
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: success
 *                 message:
 *                   type: string
 *                   example: Pincode rate removed
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
router.delete('/pincode-rates/:pincode', protect, admin, shippingController.deletePincodeRate);

export default router;
