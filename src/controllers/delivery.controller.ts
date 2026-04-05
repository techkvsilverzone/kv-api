import { Request, Response, NextFunction } from 'express';
import { AppError } from '../utils/appError';

// Non-serviceable pincode prefixes (remote areas: Andaman & Nicobar, Lakshadweep)
const NON_SERVICEABLE_PREFIXES = ['744', '682559', '682553'];

export class DeliveryController {
  public checkPincode = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { pincode } = req.query as { pincode?: string };

      if (!pincode || !/^\d{6}$/.test(pincode)) {
        throw new AppError('A valid 6-digit pincode is required', 400);
      }

      const unavailable = NON_SERVICEABLE_PREFIXES.some((prefix) => pincode.startsWith(prefix));

      if (unavailable) {
        res.status(200).json({
          available: false,
          reason: 'Remote area — serviceable via manual arrangement',
        });
        return;
      }

      res.status(200).json({
        available: true,
        estimatedDays: '5-7',
        courierPartner: 'BlueDart',
        cod: true,
      });
    } catch (error) {
      next(error);
    }
  };
}
