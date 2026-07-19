import { Router, Request, Response, NextFunction } from 'express';
import { InvoiceConfigRepository } from '../repositories/invoiceConfig.repository';

const router = Router();
const invoiceConfigRepository = new InvoiceConfigRepository();

/**
 * @openapi
 * /invoice-config:
 *   get:
 *     summary: Get public invoice/company details (GSTIN, address) shown on customer invoices
 *     tags: [InvoiceConfig]
 *     responses:
 *       200:
 *         description: Public invoice config
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
 *                     companyName:
 *                       type: string
 *                     gstin:
 *                       type: string
 *                     companyAddress:
 *                       type: string
 *                     companyPhone:
 *                       type: string
 *                     companyEmail:
 *                       type: string
 */
router.get('/', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await invoiceConfigRepository.getConfig();
    res.status(200).json({ status: 'success', data });
  } catch (error) {
    next(error);
  }
});

export default router;
