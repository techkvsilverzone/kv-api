import { Request, Response, NextFunction } from 'express';
import { GiftVoucherService } from '../services/giftVoucher.service';

export class GiftVoucherController {
  private giftVoucherService: GiftVoucherService;

  constructor() {
    this.giftVoucherService = new GiftVoucherService();
  }

  // ── Public ───────────────────────────────────────────────────────────
  public getVouchers = async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const vouchers = await this.giftVoucherService.getActiveVouchers();
      res.status(200).json({ status: 'success', data: vouchers });
    } catch (error) {
      next(error);
    }
  };

  // ── Admin ────────────────────────────────────────────────────────────
  public getAllVouchers = async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const vouchers = await this.giftVoucherService.getAllVouchers();
      res.status(200).json({ status: 'success', data: vouchers });
    } catch (error) {
      next(error);
    }
  };

  public createVoucher = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const voucher = await this.giftVoucherService.createVoucher(req.body);
      res.status(201).json({ status: 'success', data: voucher });
    } catch (error) {
      next(error);
    }
  };

  public updateVoucher = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const voucher = await this.giftVoucherService.updateVoucher(req.params.id as string, req.body);
      res.status(200).json({ status: 'success', data: voucher });
    } catch (error) {
      next(error);
    }
  };

  public deleteVoucher = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      await this.giftVoucherService.deleteVoucher(req.params.id as string);
      res.status(204).send();
    } catch (error) {
      next(error);
    }
  };
}
