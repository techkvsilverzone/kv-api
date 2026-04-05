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
 */
router.get('/', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const config = await storeConfigRepository.get();
    res.status(200).json({
      status: 'success',
      data: config ?? { theme: 'icy-silver', isDark: false },
    });
  } catch (error) {
    next(error);
  }
});

export default router;