import { Router } from 'express';
import { ReturnController } from '../controllers/return.controller';
import { protect } from '../middlewares/auth.middleware';

const router = Router();
const returnController = new ReturnController();

/**
 * @openapi
 * /returns:
 *   post:
 *     summary: Create a return request
 *     tags: [Returns]
 *     security:
 *       - bearerAuth: []
 */
router.post('/', protect, returnController.createReturn);

/**
 * @openapi
 * /returns/me:
 *   get:
 *     summary: Get my return requests
 *     tags: [Returns]
 *     security:
 *       - bearerAuth: []
 */
router.get('/me', protect, returnController.getMyReturns);

export default router;
