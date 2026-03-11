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
      const { amount, currency } = req.body;
      if (!amount || isNaN(Number(amount))) {
        throw new AppError('Valid amount is required', 400);
      }
      const order = await this.paymentService.createRazorpayOrder(Number(amount), currency);
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
