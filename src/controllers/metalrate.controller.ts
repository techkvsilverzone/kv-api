import { Request, Response, NextFunction } from 'express';
import { AuthRequest } from '../middlewares/auth.middleware';
import { MetalRateService } from '../services/metalrate.service';

export class MetalRateController {
  private readonly metalRateService: MetalRateService;

  constructor() {
    this.metalRateService = new MetalRateService();
  }

  public getTodayRates = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const rates = await this.metalRateService.getTodayRates();
      res.status(200).json(rates);
    } catch (error) {
      next(error);
    }
  };

  public getHistory = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const days = Number(req.query.days) || 30;
      const rates = await this.metalRateService.getHistory(days);
      res.status(200).json(rates);
    } catch (error) {
      next(error);
    }
  };

  public getAllRates = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const rates = await this.metalRateService.getAllRates();
      res.status(200).json(rates);
    } catch (error) {
      next(error);
    }
  };

  public upsertRate = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { date, metal, karat, ratePerGram } = req.body as {
        date: string;
        metal: 'SILVER' | 'GOLD';
        karat: number | null;
        ratePerGram: number;
      };
      const updatedBy = req.user?.name;
      const rate = await this.metalRateService.upsertRate(
        {
          date,
          metal,
          karat,
          ratePerGram: Number(ratePerGram),
        },
        updatedBy,
      );
      res.status(201).json(rate);
    } catch (error) {
      next(error);
    }
  };
}
