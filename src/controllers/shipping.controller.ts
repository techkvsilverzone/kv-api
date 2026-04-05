import { Request, Response, NextFunction } from 'express';
import { PincodeRateRepository } from '../repositories/pincodeRate.repository';
import { AppError } from '../utils/appError';

const pincodeRateRepository = new PincodeRateRepository();

export class ShippingController {
  public getPincodeRates = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const rates = await pincodeRateRepository.findAll();
      res.status(200).json({ status: 'success', data: rates });
    } catch (error) {
      next(error);
    }
  };

  public addPincodeRate = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { pincode, label, rate } = req.body;
      if (!pincode || !label || rate === undefined) {
        throw new AppError('pincode, label, and rate are required', 400);
      }
      const entry = await pincodeRateRepository.create({ pincode: String(pincode), label: String(label), rate: Number(rate) });
      res.status(201).json({ status: 'success', data: entry });
    } catch (error) {
      next(error);
    }
  };

  public deletePincodeRate = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const deleted = await pincodeRateRepository.deleteByPincode(req.params.pincode as string);
      if (!deleted) throw new AppError('Pincode rate not found', 404);
      res.status(200).json({ status: 'success', message: 'Pincode rate removed' });
    } catch (error) {
      next(error);
    }
  };
}
