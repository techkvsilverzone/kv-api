import { Response, NextFunction } from 'express';
import { IdProofService } from '../services/idProof.service';
import { AuthRequest } from '../middlewares/auth.middleware';

export class IdProofController {
  private idProofService: IdProofService;

  constructor() {
    this.idProofService = new IdProofService();
  }

  public submitMine = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const result = await this.idProofService.submit(req.user!._id.toString(), req.body);
      res.status(201).json(result);
    } catch (error) {
      next(error);
    }
  };

  public getMine = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const result = await this.idProofService.getMine(req.user!._id.toString());
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  };

  public listForAdmin = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const status = typeof req.query.status === 'string' ? req.query.status : undefined;
      const result = await this.idProofService.listForAdmin(status);
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  };

  public verify = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const result = await this.idProofService.verify(
        req.params.id as string,
        req.user!._id.toString(),
        req.body,
      );
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  };
}
