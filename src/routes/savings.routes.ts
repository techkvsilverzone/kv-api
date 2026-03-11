import { Router } from 'express';
import { SavingsController } from '../controllers/savings.controller';
import { protect } from '../middlewares/auth.middleware';

const router = Router();
const savingsController = new SavingsController();

/**
 * @openapi
 * /savings/enroll:
 *   post:
 *     summary: Enroll in a savings scheme
 *     tags: [Savings]
 *     security:
 *       - bearerAuth: []
 */
router.post('/enroll', protect, savingsController.enroll);

/**
 * @openapi
 * /savings/my-schemes:
 *   get:
 *     summary: Get my savings schemes
 *     tags: [Savings]
 *     security:
 *       - bearerAuth: []
 */
router.get('/my-schemes', protect, savingsController.getMySchemes);

/**
 * @openapi
 * /savings/{schemeId}/pay:
 *   post:
 *     summary: Record a monthly payment for a savings scheme
 *     tags: [Savings]
 *     security:
 *       - bearerAuth: []
 */
router.post('/:schemeId/pay', protect, savingsController.recordPayment);

export default router;
