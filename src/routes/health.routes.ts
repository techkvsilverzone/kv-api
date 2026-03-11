import { Router } from 'express';
import { HealthController } from '../controllers/health.controller';

const router = Router();
const healthController = new HealthController();

/**
 * @openapi
 * /health:
 *   get:
 *     summary: Check system health
 *     tags: [Health]
 *     responses:
 *       200:
 *         description: System is up and running
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: UP
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 */
router.get('/', healthController.getHealth);

export default router;
