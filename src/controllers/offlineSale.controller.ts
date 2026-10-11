import { Response, NextFunction } from 'express';
import { AuthRequest } from '../middlewares/auth.middleware';
import { OfflineSaleService } from '../services/offlineSale.service';

export class OfflineSaleController {
  private offlineSaleService = new OfflineSaleService();

  public quote = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      res.status(200).json(await this.offlineSaleService.quote(req.body ?? {}));
    } catch (error) {
      next(error);
    }
  };

  public create = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      res.status(201).json(await this.offlineSaleService.create(String(req.user!._id), req.body ?? {}));
    } catch (error) {
      next(error);
    }
  };
}
