import { Router } from 'express';
import { GoldRateController } from '../controllers/goldrate.controller';

const router = Router();
const goldRateController = new GoldRateController();

/**
 * @openapi
 * /gold-rates/today:
 *   get:
 *     summary: Get today's gold rate(s)
 *     tags: [GoldRates]
 *     responses:
 *       200:
 *         description: Today's gold rates
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   id:
 *                     type: string
 *                   date:
 *                     type: string
 *                     format: date
 *                   rateDate:
 *                     type: string
 *                     format: date
 *                   purity:
 *                     type: string
 *                   ratePerGram:
 *                     type: number
 *                   ratePerKg:
 *                     type: number
 *                   updatedBy:
 *                     type: string
 */
router.get('/today', goldRateController.getTodayRates);

/**
 * @openapi
 * /gold-rates/history:
 *   get:
 *     summary: Get historical gold rates
 *     tags: [GoldRates]
 *     parameters:
 *       - in: query
 *         name: days
 *         schema:
 *           type: integer
 *         description: Number of days of history (default 30)
 *     responses:
 *       200:
 *         description: Historical gold rates
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   id:
 *                     type: string
 *                   date:
 *                     type: string
 *                     format: date
 *                   rateDate:
 *                     type: string
 *                     format: date
 *                   purity:
 *                     type: string
 *                   ratePerGram:
 *                     type: number
 *                   ratePerKg:
 *                     type: number
 *                   updatedBy:
 *                     type: string
 */
router.get('/history', goldRateController.getHistory);

export default router;
