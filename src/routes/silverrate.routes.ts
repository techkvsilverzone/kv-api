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
 */
router.get('/history', silverRateController.getHistory);

export default router;
