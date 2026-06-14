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
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [planName, monthlyAmount, duration]
 *             properties:
 *               planName:
 *                 type: string
 *                 example: Silver Saver
 *               monthlyAmount:
 *                 type: integer
 *                 minimum: 1000
 *                 description: Whole number, at least 1000
 *                 example: 2000
 *               duration:
 *                 type: integer
 *                 enum: [6, 11, 12]
 *                 description: Scheme duration in months
 *                 example: 11
 *     responses:
 *       201:
 *         description: Enrollment created
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 _id:
 *                   type: string
 *                 userId:
 *                   type: string
 *                 passbookNumber:
 *                   type: string
 *                   example: PB-00000042
 *                 planName:
 *                   type: string
 *                 monthlyAmount:
 *                   type: integer
 *                 duration:
 *                   type: integer
 *                 bonusAmount:
 *                   type: number
 *                 totalPaid:
 *                   type: number
 *                 status:
 *                   type: string
 *                   enum: [Active, Completed, Cancelled]
 *                 payments:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       month:
 *                         type: integer
 *                       amount:
 *                         type: number
 *                       paidAt:
 *                         type: string
 *                         format: date-time
 *                 startDate:
 *                   type: string
 *                   format: date-time
 *                 createdAt:
 *                   type: string
 *                   format: date-time
 *                 updatedAt:
 *                   type: string
 *                   format: date-time
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
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
 *     responses:
 *       200:
 *         description: List of the user's savings schemes
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   _id:
 *                     type: string
 *                   userId:
 *                     type: string
 *                   passbookNumber:
 *                     type: string
 *                   planName:
 *                     type: string
 *                   monthlyAmount:
 *                     type: integer
 *                   duration:
 *                     type: integer
 *                   bonusAmount:
 *                     type: number
 *                   totalPaid:
 *                     type: number
 *                   status:
 *                     type: string
 *                     enum: [Active, Completed, Cancelled]
 *                   payments:
 *                     type: array
 *                     items:
 *                       type: object
 *                       properties:
 *                         month:
 *                           type: integer
 *                         amount:
 *                           type: number
 *                         paidAt:
 *                           type: string
 *                           format: date-time
 *                   startDate:
 *                     type: string
 *                     format: date-time
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
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
 *     parameters:
 *       - in: path
 *         name: schemeId
 *         required: true
 *         schema:
 *           type: string
 *         description: Savings scheme id
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [amount, month]
 *             properties:
 *               amount:
 *                 type: number
 *                 example: 2000
 *               month:
 *                 type: integer
 *                 description: Installment month number
 *                 example: 1
 *     responses:
 *       200:
 *         description: Updated scheme with payment history
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 _id:
 *                   type: string
 *                 totalPaid:
 *                   type: number
 *                 status:
 *                   type: string
 *                   enum: [Active, Completed, Cancelled]
 *                 payments:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       month:
 *                         type: integer
 *                       amount:
 *                         type: number
 *                       paidAt:
 *                         type: string
 *                         format: date-time
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
router.post('/:schemeId/pay', protect, savingsController.recordPayment);

export default router;
