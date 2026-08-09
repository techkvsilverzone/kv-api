import { Router } from 'express';
import { SchemePlanController } from '../controllers/schemePlan.controller';

const router = Router();
const schemePlanController = new SchemePlanController();

/**
 * @openapi
 * /scheme-plans:
 *   get:
 *     summary: List active savings scheme plans (Gold 11+1, Silver 11+1, Diwali, etc.)
 *     tags: [Savings]
 *     responses:
 *       200:
 *         description: Active scheme plans
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
 *                     $ref: '#/components/schemas/SchemePlan'
 */
router.get('/', schemePlanController.getPlans);

export default router;
