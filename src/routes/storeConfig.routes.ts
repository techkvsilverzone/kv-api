import { Router, Request, Response, NextFunction } from 'express';
import { StoreConfigRepository } from '../repositories/storeConfig.repository';

const router = Router();
const storeConfigRepository = new StoreConfigRepository();

/**
 * @openapi
 * /store-config:
 *   get:
 *     summary: Get public store theme configuration
 *     tags: [Store Config]
 *     responses:
 *       200:
 *         description: Store configuration
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/StoreConfig'
 */
// Response is the config object itself (not the {status, data} envelope some other
// routes use) — the frontend's storeConfigService types this as a plain StoreConfig
// and reads `.theme`/`.marqueeMessages` directly off the response body.
router.get('/', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const config = await storeConfigRepository.get();
    res.status(200).json(config ?? { theme: 'icy-silver', isDark: false, marqueeMessages: [] });
  } catch (error) {
    next(error);
  }
});

export default router;