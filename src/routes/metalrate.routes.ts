import { Router } from 'express';
import { MetalRateController } from '../controllers/metalrate.controller';

const router = Router();
const metalRateController = new MetalRateController();

/**
 * @openapi
 * /metal-rates/today:
 *   get:
 *     summary: Get today's metal rates (Silver + Gold 22K)
 *     tags: [MetalRates]
 *     responses:
 *       200:
 *         description: Today's metal rates
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/MetalRate'
 */
router.get('/today', metalRateController.getTodayRates);

/**
 * @openapi
 * /metal-rates/history:
 *   get:
 *     summary: Get historical metal rates
 *     tags: [MetalRates]
 *     parameters:
 *       - in: query
 *         name: days
 *         schema:
 *           type: integer
 *         description: Number of days of history (default 30)
 *     responses:
 *       200:
 *         description: Historical metal rates
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/MetalRate'
 */
router.get('/history', metalRateController.getHistory);

export default router;
