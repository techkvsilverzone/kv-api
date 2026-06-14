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
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 available:
 *                   type: boolean
 *                   example: true
 *                 reason:
 *                   type: string
 *                   description: Present when not serviceable to a standard courier
 *                   example: Remote area — serviceable via manual arrangement
 *                 estimatedDays:
 *                   type: string
 *                   description: Present when serviceable
 *                   example: 5-7
 *                 courierPartner:
 *                   type: string
 *                   description: Present when serviceable
 *                   example: BlueDart
 *                 cod:
 *                   type: boolean
 *                   description: Cash-on-delivery availability (present when serviceable)
 *                   example: true
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 */
router.get('/check', deliveryController.checkPincode);

export default router;
