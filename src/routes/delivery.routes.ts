import { Router } from 'express';
import { DeliveryController } from '../controllers/delivery.controller';

const router = Router();
const deliveryController = new DeliveryController();

/**
 * @openapi
 * /delivery/check:
 *   get:
 *     summary: Check pincode delivery serviceability
 *     description: >
 *       Confirms the pincode exists in India Post's directory, resolves its district/state to a
 *       delivery zone and returns that zone's charge from delivery-config. Remote areas
 *       (Andaman & Nicobar, Lakshadweep) are not serviceable. If the directory is unreachable the
 *       result is `available: true, verified: false` so a sale is never blocked by the outage.
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
 *                 pincode: { type: string, example: '600040' }
 *                 available: { type: boolean, example: true }
 *                 verified: { type: boolean, example: true }
 *                 city: { type: string, example: Chennai }
 *                 state: { type: string, example: Tamil Nadu }
 *                 deliveryZone: { type: string, enum: [chennai, otherDistrict, otherState], nullable: true }
 *                 deliveryFee: { type: number, nullable: true, example: 150 }
 *                 estimatedDays: { type: string, example: 5-7 }
 *                 reason: { type: string, description: Present when not serviceable, example: This pincode does not exist }
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 */
router.get('/check', deliveryController.checkPincode);

export default router;
