import { CouponRepository } from '../repositories/coupon.repository';
import { AppError } from '../utils/appError';

export class CouponService {
  private couponRepository: CouponRepository;

  constructor() {
    this.couponRepository = new CouponRepository();
  }

  public async applyCoupon(code: string, orderAmount: number) {
    const coupon = await this.couponRepository.findByCode(code);

    if (!coupon) {
      return { valid: false, discount: 0, message: 'Coupon not found' };
    }

    if (!coupon.isActive) {
      return { valid: false, discount: 0, message: 'Coupon is inactive' };
    }

    const now = new Date();
    const expiryDate = new Date(coupon.expiryDate);
    expiryDate.setHours(23, 59, 59, 999);

    if (now > expiryDate) {
      return { valid: false, discount: 0, message: 'Coupon has expired' };
    }

    if (coupon.maxUses > 0 && coupon.usedCount >= coupon.maxUses) {
      return { valid: false, discount: 0, message: 'Coupon usage limit reached' };
    }

    if (orderAmount < coupon.minOrderAmount) {
      return {
        valid: false,
        discount: 0,
        message: `Minimum order amount of ₹${coupon.minOrderAmount} required`,
      };
    }

    let discount = 0;
    if (coupon.discountType === 'percentage') {
      discount = Math.round((orderAmount * coupon.discountValue) / 100);
      // no maxDiscount cap in current schema
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
