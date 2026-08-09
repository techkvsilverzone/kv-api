import { Request, Response, NextFunction } from 'express';
import { SchemePlanService } from '../services/schemePlan.service';

export class SchemePlanController {
  private schemePlanService: SchemePlanService;

  constructor() {
    this.schemePlanService = new SchemePlanService();
  }

  // ── Public ───────────────────────────────────────────────────────────
  public getPlans = async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const plans = await this.schemePlanService.getActivePlans();
      res.status(200).json({ status: 'success', data: plans });
    } catch (error) {
      next(error);
    }
  };

  // ── Admin ────────────────────────────────────────────────────────────
  public getAllPlans = async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const plans = await this.schemePlanService.getAllPlans();
      res.status(200).json({ status: 'success', data: plans });
    } catch (error) {
      next(error);
    }
  };

  public createPlan = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const plan = await this.schemePlanService.createPlan(req.body);
      res.status(201).json({ status: 'success', data: plan });
    } catch (error) {
      next(error);
    }
  };

  public updatePlan = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const plan = await this.schemePlanService.updatePlan(req.params.id as string, req.body);
      res.status(200).json({ status: 'success', data: plan });
    } catch (error) {
      next(error);
    }
  };

  public deletePlan = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      await this.schemePlanService.deletePlan(req.params.id as string);
      res.status(204).send();
    } catch (error) {
      next(error);
    }
  };
}
