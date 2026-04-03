import { CouponRepository } from '../repositories/coupon.repository';
import { AppError } from '../utils/appError';

export class CouponService {
  private couponRepository: CouponRepository;

  constructor() {
    this.couponRepository = new CouponRepository();
  }

  public async applyCoupon(code: string, orderAmount: number) {
    if (!code || typeof code !== 'string' || !code.trim()) {
      throw new AppError('Coupon code is required', 400);
    }

    const coupon = await this.couponRepository.findByCode(code.trim().toUpperCase());

    if (!coupon) {
      throw new AppError('Coupon code is invalid', 400);
    }

    if (!coupon.isActive) {
      throw new AppError('Coupon is inactive', 400);
    }

    const now = new Date();
    const expiryDate = new Date(coupon.expiryDate);
    expiryDate.setHours(23, 59, 59, 999);

    if (now > expiryDate) {
      throw new AppError('Coupon has expired', 400);
    }

    if (coupon.maxUses > 0 && coupon.usedCount >= coupon.maxUses) {
      throw new AppError('Coupon usage limit reached', 400);
    }

    if (orderAmount < coupon.minOrderAmount) {
      throw new AppError(`Minimum order amount of ₹${coupon.minOrderAmount} required`, 400);
    }

    let discount = 0;
    if (coupon.discountType === 'percentage') {
      discount = Math.round((orderAmount * coupon.discountValue) / 100);
    } else {
      discount = coupon.discountValue;
    }

    discount = Math.min(discount, orderAmount);

    return {
      valid: true,
      discount,
      message: `Coupon applied! You save ₹${discount.toLocaleString('en-IN')}`,
    };
  }

  public async getAllCoupons() {
    return await this.couponRepository.findAll();
  }

  public async createCoupon(data: any) {
    return await this.couponRepository.create(data);
  }

  public async updateCoupon(id: string, data: any) {
    const coupon = await this.couponRepository.update(id, data);
    if (!coupon) throw new AppError('Coupon not found', 404);
    return coupon;
  }

  public async deleteCoupon(id: string) {
    const deleted = await this.couponRepository.delete(id);
    if (!deleted) throw new AppError('Coupon not found', 404);
  }
}
