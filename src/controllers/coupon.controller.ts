import { Request, Response, NextFunction } from 'express';
import { CouponService } from '../services/coupon.service';

export class CouponController {
  private couponService: CouponService;

  constructor() {
    this.couponService = new CouponService();
  }

  public applyCoupon = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const result = await this.couponService.applyCoupon(req.body.code, Number(req.body.orderAmount));
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  };

  public getAllCoupons = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const coupons = await this.couponService.getAllCoupons();
      res.status(200).json(coupons);
    } catch (error) {
      next(error);
    }
  };

  public createCoupon = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const coupon = await this.couponService.createCoupon(req.body);
      res.status(201).json(coupon);
    } catch (error) {
      next(error);
    }
  };

  public updateCoupon = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const coupon = await this.couponService.updateCoupon(req.params.id as string, req.body);
      res.status(200).json(coupon);
    } catch (error) {
      next(error);
    }
  };

  public deleteCoupon = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      await this.couponService.deleteCoupon(req.params.id as string);
      res.status(204).send();
    } catch (error) {
      next(error);
    }
  };
}
