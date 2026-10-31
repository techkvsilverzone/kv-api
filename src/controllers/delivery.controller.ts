import { Request, Response, NextFunction } from 'express';
import { AppError } from '../utils/appError';
import { DeliveryService } from '../services/delivery.service';

export class DeliveryController {
  constructor(private deliveryService = new DeliveryService()) {}

  public checkPincode = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const pincode = String((req.query as { pincode?: string }).pincode ?? '').trim();
      if (!/^\d{6}$/.test(pincode)) {
        throw new AppError('A valid 6-digit pincode is required', 400);
      }
      res.status(200).json(await this.deliveryService.checkPincode(pincode));
    } catch (error) {
      next(error);
    }
  };
}
