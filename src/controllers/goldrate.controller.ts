import { Request, Response, NextFunction } from 'express';
import { GoldRateService } from '../services/goldrate.service';
import { AuthRequest } from '../middlewares/auth.middleware';

export class GoldRateController {
  private goldRateService: GoldRateService;

  constructor() {
    this.goldRateService = new GoldRateService();
  }

  public getTodayRates = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const rates = await this.goldRateService.getTodayRates();
      res.status(200).json(rates);
    } catch (error) {
      next(error);
    }
  };

  public getHistory = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const days = Number(req.query.days) || 30;
      const rates = await this.goldRateService.getHistory(days);
      res.status(200).json(rates);
    } catch (error) {
      next(error);
    }
  };

  public getAllRates = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const rates = await this.goldRateService.getAllRates();
      res.status(200).json(rates);
    } catch (error) {
      next(error);
    }
  };

  public upsertRate = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { ratePerGram, purity } = req.body;
      const updatedBy = req.user?.name;
      const rate = await this.goldRateService.upsertRate(Number(ratePerGram), String(purity), updatedBy);
      res.status(201).json(rate);
    } catch (error) {
      next(error);
    }
  };
}
