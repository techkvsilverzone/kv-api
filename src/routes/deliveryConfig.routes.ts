import { Router, Request, Response, NextFunction } from 'express';
import { DeliveryConfigRepository } from '../repositories/deliveryConfig.repository';

const router = Router();
const deliveryConfigRepository = new DeliveryConfigRepository();

/**
 * @openapi
 * /delivery-config:
 *   get:
 *     summary: Get public zone-based delivery charges
 *     tags: [Delivery]
 *     responses:
 *       200:
 *         description: Public delivery charge configuration
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: success
 *                 data:
 *                   $ref: '#/components/schemas/DeliveryConfig'
 */
router.get('/', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await deliveryConfigRepository.getConfig();
    res.status(200).json({ status: 'success', data });
  } catch (error) {
    next(error);
  }
});

export default router;
