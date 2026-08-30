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
 *             required: [schemeType, monthlyAmount]
 *             properties:
 *               schemeType:
 *                 type: string
 *                 enum: [GOLD_11_1, SILVER_11_1, DIWALI]
 *                 description: Which catalog plan (see GET /scheme-plans) to enroll under.
 *               monthlyAmount:
 *                 type: integer
 *                 description: Must be one of the chosen plan's monthlyAmounts.
 *                 example: 5000
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
 *                   nullable: true
 *                   description: Absent until this scheme's first payment is recorded.
 *                   example: null
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
 * /savings/passbook/{passbookNumber}:
 *   get:
 *     summary: Track a savings scheme by its passbook number
 *     description: Customers may only look up their own passbook; admin/staff can look up any.
 *     tags: [Savings]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: passbookNumber
 *         required: true
 *         schema:
 *           type: string
 *         example: PB-00000042
 *     responses:
 *       200:
 *         description: The matching savings scheme
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
router.get('/passbook/:passbookNumber', protect, savingsController.getByPassbookNumber);

/**
 * @openapi
 * /savings/{schemeId}/pay/create-order:
 *   post:
 *     summary: Create a Razorpay order for this scheme's next installment
 *     description: >
 *       For a FIXED-mode scheme (Gold/Silver 11+1, Diwali) the amount is always the scheme's own
 *       `monthlyAmount` — server-computed, request body ignored. For a FLEXIBLE-mode scheme (item
 *       4, KV Smart Purchase Plan) `amount` is REQUIRED and must be >= the plan's minimum. Step 1
 *       of the customer self-pay flow; step 2 is `/pay/verify`.
 *     tags: [Savings]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: schemeId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               amount:
 *                 type: number
 *                 description: Required for FLEXIBLE-mode schemes only; ignored for FIXED-mode schemes.
 *     responses:
 *       201:
 *         description: Razorpay order
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id:
 *                   type: string
 *                 amount:
 *                   type: integer
 *                   description: Paise
 *                 currency:
 *                   type: string
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
router.post('/:schemeId/pay/create-order', protect, savingsController.createInstallmentOrder);

/**
 * @openapi
 * /savings/{schemeId}/pay/verify:
 *   post:
 *     summary: Verify a Razorpay installment payment and record it on the ledger
 *     description: >
 *       Verifies the payment signature, re-confirms the amount Razorpay actually captured
 *       matches the scheme's monthly amount, converts the collection to silver grams at
 *       the live rate, and mints the passbook if this was the scheme's first payment.
 *     tags: [Savings]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: schemeId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [razorpayOrderId, razorpayPaymentId, razorpaySignature]
 *             properties:
 *               razorpayOrderId:
 *                 type: string
 *               razorpayPaymentId:
 *                 type: string
 *               razorpaySignature:
 *                 type: string
 *     responses:
 *       200:
 *         description: Updated scheme with payment history
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
router.post('/:schemeId/pay/verify', protect, savingsController.verifyInstallmentPayment);

export default router;
