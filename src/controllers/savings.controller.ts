import { Request, Response, NextFunction } from 'express';
// Request is used for admin endpoints that don't need user context
import { SavingsService } from '../services/savings.service';
import { AuthRequest } from '../middlewares/auth.middleware';

export class SavingsController {
  private savingsService: SavingsService;

  constructor() {
    this.savingsService = new SavingsService();
  }

  public enroll = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const enrollment = await this.savingsService.enroll(req.user!._id.toString(), req.body);
      res.status(201).json(enrollment);
    } catch (error) {
      next(error);
    }
  };

  public getMySchemes = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const schemes = await this.savingsService.getMySchemes(req.user!._id.toString());
      res.status(200).json(schemes);
    } catch (error) {
      next(error);
    }
  };

  public recordPayment = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const scheme = await this.savingsService.recordPayment(
        req.user!._id.toString(),
        req.params.schemeId as string,
        Number(req.body.amount),
        Number(req.body.month),
      );
      res.status(200).json(scheme);
    } catch (error) {
      next(error);
    }
  };

  public getAllSchemes = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const schemes = await this.savingsService.getAllSchemes();
      res.status(200).json(schemes);
    } catch (error) {
      next(error);
    }
  };
}
