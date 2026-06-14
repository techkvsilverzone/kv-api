import { Router } from 'express';
import { SilverRateController } from '../controllers/silverrate.controller';

const router = Router();
const silverRateController = new SilverRateController();

/**
 * @openapi
 * /silver-rates/today:
 *   get:
 *     summary: Get today's silver rates for all purities
 *     tags: [SilverRates]
 *     deprecated: true
 *     responses:
 *       200:
 *         description: Today's silver rates
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   _id:
 *                     type: string
 *                   rateDate:
 *                     type: string
 *                     format: date-time
 *                   purity:
 *                     type: string
 *                     enum: ['999', '925', '916']
 *                   ratePerGram:
 *                     type: number
 *                   ratePerKg:
 *                     type: number
 *                   updatedBy:
 *                     type: string
 */
router.get('/today', silverRateController.getTodayRates);

/**
 * @openapi
 * /silver-rates/history:
 *   get:
 *     summary: Get historical silver rates
 *     tags: [SilverRates]
 *     deprecated: true
 *     parameters:
 *       - in: query
 *         name: days
 *         schema:
 *           type: integer
 *         description: Number of days of history (default 30)
 *     responses:
 *       200:
 *         description: Historical silver rates
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   _id:
 *                     type: string
 *                   rateDate:
 *                     type: string
 *                     format: date-time
 *                   purity:
 *                     type: string
 *                     enum: ['999', '925', '916']
 *                   ratePerGram:
 *                     type: number
 *                   ratePerKg:
 *                     type: number
 *                   updatedBy:
 *                     type: string
 */
router.get('/history', silverRateController.getHistory);

export default router;
