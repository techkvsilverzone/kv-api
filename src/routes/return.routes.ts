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
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [orderId, reason, items, faultType]
 *             properties:
 *               orderId:
 *                 type: string
 *                 description: Id of the order being returned
 *               faultType:
 *                 type: string
 *                 enum: [kv_fault, customer_preference]
 *                 description: kv_fault (wrong/damaged/defective item) is refund/replacement-eligible and requires an unboxing video sent via WhatsApp; customer_preference is exchange/store-credit only.
 *               reason:
 *                 type: string
 *                 example: Damaged item
 *               description:
 *                 type: string
 *               items:
 *                 type: array
 *                 items:
 *                   type: object
 *                   required: [orderItemId, productName, quantity]
 *                   properties:
 *                     orderItemId:
 *                       type: string
 *                     productName:
 *                       type: string
 *                     quantity:
 *                       type: integer
 *                     reason:
 *                       type: string
 *     responses:
 *       201:
 *         description: Return request created
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 _id:
 *                   type: string
 *                 orderId:
 *                   type: string
 *                 userId:
 *                   type: string
 *                 reason:
 *                   type: string
 *                 status:
 *                   type: string
 *                   enum: [Pending, Approved, Rejected, Completed]
 *                 refundAmount:
 *                   type: number
 *                 items:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       orderItemId:
 *                         type: string
 *                       productName:
 *                         type: string
 *                       quantity:
 *                         type: integer
 *                       reason:
 *                         type: string
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
router.post('/', protect, returnController.createReturn);

/**
 * @openapi
 * /returns/policy:
 *   get:
 *     summary: Public returns policy info (WhatsApp number for unboxing videos, claim window)
 *     tags: [Returns]
 *     responses:
 *       200:
 *         description: Policy info
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 whatsappNumber:
 *                   type: string
 *                 claimWindowHours:
 *                   type: integer
 */
router.get('/policy', returnController.getReturnPolicy);

/**
 * @openapi
 * /returns/me:
 *   get:
 *     summary: Get my return requests
 *     tags: [Returns]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of the user's return requests
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   _id:
 *                     type: string
 *                   orderId:
 *                     type: string
 *                   userId:
 *                     type: string
 *                   reason:
 *                     type: string
 *                   status:
 *                     type: string
 *                     enum: [Pending, Approved, Rejected, Completed]
 *                   refundAmount:
 *                     type: number
 *                   items:
 *                     type: array
 *                     items:
 *                       type: object
 *                       properties:
 *                         orderItemId:
 *                           type: string
 *                         productName:
 *                           type: string
 *                         quantity:
 *                           type: integer
 *                         reason:
 *                           type: string
 *                   createdAt:
 *                     type: string
 *                     format: date-time
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 */
router.get('/me', protect, returnController.getMyReturns);

export default router;
