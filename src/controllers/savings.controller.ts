import { Request, Response, NextFunction } from 'express';
// Request is used for admin endpoints that don't need user context
import { SavingsService } from '../services/savings.service';
import { AuthRequest } from '../middlewares/auth.middleware';
import { AppError } from '../utils/appError';

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

  public createInstallmentOrder = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      // Item 4: only meaningful for FLEXIBLE plans (KV Smart Purchase Plan) — FIXED plans
      // ignore this and always use the scheme's own monthly amount.
      const amount = req.body?.amount !== undefined ? Number(req.body.amount) : undefined;
      const order = await this.savingsService.createInstallmentOrder(
        req.user!._id.toString(),
        req.params.schemeId as string,
        amount,
      );
      res.status(201).json(order);
    } catch (error) {
      next(error);
    }
  };

  public verifyInstallmentPayment = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { razorpayOrderId, razorpayPaymentId, razorpaySignature } = req.body;
      if (!razorpayOrderId || !razorpayPaymentId || !razorpaySignature) {
        throw new AppError('razorpayOrderId, razorpayPaymentId and razorpaySignature are required', 400);
      }
      const scheme = await this.savingsService.verifyAndRecordInstallment(
        req.user!._id.toString(),
        req.params.schemeId as string,
        { orderId: razorpayOrderId, paymentId: razorpayPaymentId, signature: razorpaySignature },
      );
      res.status(200).json({ success: true, scheme });
    } catch (error) {
      next(error);
    }
  };

  /** Staff and admin can both record a manual/offline collection — see admin.routes.ts. */
  public adminRecordPayment = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const amount = Number(req.body.amount);
      const materialRate = req.body.materialRate !== undefined ? Number(req.body.materialRate) : undefined;
      const scheme = await this.savingsService.recordPaymentAsAdmin(
        req.params.id as string,
        amount,
        materialRate,
        req.user!._id.toString(),
      );
      res.status(200).json(scheme);
    } catch (error) {
      next(error);
    }
  };

  /** Admin-only early-exit cancellation — see savings.model.ts ICancellation. */
  public adminCancelScheme = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const scheme = await this.savingsService.cancelScheme(req.params.id as string, req.user!._id.toString(), {
        giftsValueDeducted: req.body.giftsValueDeducted,
        note: req.body.note,
      });
      res.status(200).json(scheme);
    } catch (error) {
      next(error);
    }
  };

  /** Admin-only: compute a Diwali scheme's redemption payout (gold value/grams, silver
   * value, gifts value) from today's gold/silver rates, once all installments are in. */
  public adminComputeRedemption = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const scheme = await this.savingsService.computeDiwaliRedemption(req.params.id as string);
      res.status(200).json(scheme);
    } catch (error) {
      next(error);
    }
  };

  public adminUpdatePaymentRow = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const scheme = await this.savingsService.adminUpdatePaymentRow(
        req.params.id as string,
        Number(req.params.index),
        req.body,
      );
      res.status(200).json(scheme);
    } catch (error) {
      next(error);
    }
  };

  public adminDeletePaymentRow = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const scheme = await this.savingsService.adminDeletePaymentRow(req.params.id as string, Number(req.params.index));
      res.status(200).json(scheme);
    } catch (error) {
      next(error);
    }
  };

  public getByPassbookNumber = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const isStaffOrAdmin = !!req.user!.isAdmin || req.user!.role === 'staff';
      const scheme = await this.savingsService.getByPassbookNumber(
        req.user!._id.toString(),
        isStaffOrAdmin,
        req.params.passbookNumber as string,
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

  public adminUpdate = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const scheme = await this.savingsService.adminUpdateScheme(req.params.id as string, req.body);
      res.status(200).json(scheme);
    } catch (error) {
      next(error);
    }
  };

  public adminDelete = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      await this.savingsService.adminDeleteScheme(req.params.id as string);
      res.status(204).send();
    } catch (error) {
      next(error);
    }
  };
}
