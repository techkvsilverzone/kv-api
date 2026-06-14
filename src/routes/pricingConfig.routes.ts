import { Router, Request, Response, NextFunction } from 'express';
import { PricingConfigRepository, DEFAULT_GST_PERCENT } from '../repositories/pricingConfig.repository';

const router = Router();
const pricingConfigRepository = new PricingConfigRepository();

/**
 * @openapi
 * /pricing-config:
 *   get:
 *     summary: Get public pricing configuration (GST rate)
 *     tags: [Pricing]
 *     responses:
 *       200:
 *         description: Public pricing configuration
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: success
 *                 data:
 *                   $ref: '#/components/schemas/PricingConfig'
 */
router.get('/', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const config = await pricingConfigRepository.get();
    res.status(200).json({
      status: 'success',
      data: { gstPercent: config?.gstPercent ?? DEFAULT_GST_PERCENT },
    });
  } catch (error) {
    next(error);
  }
});

export default router;
