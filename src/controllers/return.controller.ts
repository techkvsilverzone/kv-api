import { Request, Response, NextFunction } from 'express';
import { ReturnService } from '../services/return.service';
import { AuthRequest } from '../middlewares/auth.middleware';

export class ReturnController {
  private returnService: ReturnService;

  constructor() {
    this.returnService = new ReturnService();
  }

  public createReturn = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const returnRequest = await this.returnService.createReturn(req.user!._id.toString(), req.body);
      res.status(201).json(returnRequest);
    } catch (error) {
      next(error);
    }
  };

  public getMyReturns = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const returns = await this.returnService.getMyReturns(req.user!._id.toString());
      res.status(200).json(returns);
    } catch (error) {
      next(error);
    }
  };

  public getAllReturns = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const returns = await this.returnService.getAllReturns();
      res.status(200).json(returns);
    } catch (error) {
      next(error);
    }
  };

  public updateReturnStatus = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { status, refundAmount } = req.body;
      const updated = await this.returnService.updateReturnStatus(
        req.params.id as string,
        status,
        Number(refundAmount || 0),
      );
      res.status(200).json(updated);
    } catch (error) {
      next(error);
    }
  };
}
