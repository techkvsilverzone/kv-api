import { Router, Request, Response, NextFunction } from 'express';
import { StallConfigRepository } from '../repositories/stallConfig.repository';

const router = Router();
const stallConfigRepository = new StallConfigRepository();

/**
 * @openapi
 * /stall-config:
 *   get:
 *     summary: Get public offline-stall registration mode status
 *     tags: [StallConfig]
 *     responses:
 *       200:
 *         description: Public stall config
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: success
 *                 data:
 *                   type: object
 *                   properties:
 *                     active:
 *                       type: boolean
 */
router.get('/', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await stallConfigRepository.getConfig();
    res.status(200).json({ status: 'success', data });
  } catch (error) {
    next(error);
  }
});

export default router;
