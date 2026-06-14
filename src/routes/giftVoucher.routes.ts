import { Router } from 'express';
import { GiftVoucherController } from '../controllers/giftVoucher.controller';

const router = Router();
const giftVoucherController = new GiftVoucherController();

/**
 * @openapi
 * /gift-vouchers:
 *   get:
 *     summary: List active gift voucher denominations
 *     tags: [Gift Vouchers]
 *     responses:
 *       200:
 *         description: Active gift voucher denominations
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: success
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/GiftVoucher'
 */
router.get('/', giftVoucherController.getVouchers);

export default router;
