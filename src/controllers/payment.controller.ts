import { Response, NextFunction } from 'express';
import { PaymentService } from '../services/payment.service';
import { AuthRequest } from '../middlewares/auth.middleware';
import { AppError } from '../utils/appError';

export class PaymentController {
  private paymentService: PaymentService;

  constructor() {
    this.paymentService = new PaymentService();
  }

  public createOrder = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { items, couponCode, pincode, currency } = req.body;
      if (!Array.isArray(items) || items.length === 0) {
        throw new AppError('items (array of { product, quantity }) is required', 400);
      }
      // Amount is computed server-side from the cart; any client amount is ignored.
      const order = await this.paymentService.createRazorpayOrder({ items, couponCode, pincode, currency });
      res.status(201).json(order);
    } catch (error) {
      next(error);
    }
  };

  public verifyPayment = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const order = await this.paymentService.verifyAndCreateOrder(req.user!._id.toString(), req.body);
      res.status(200).json({
        success: true,
        orderId: order._id,
        message: 'Payment verified and order created successfully',
      });
    } catch (error) {
      if (error instanceof AppError && error.statusCode === 400) {
        res.status(400).json({ success: false, orderId: '', message: error.message });
        return;
      }
      next(error);
    }
  };
}
