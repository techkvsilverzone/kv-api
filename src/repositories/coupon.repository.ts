import mongoose from 'mongoose';
import { Coupon, ICoupon } from '../models/coupon.model';

export { ICoupon };

export class CouponRepository {
  public async findAll(): Promise<ICoupon[]> {
    return Coupon.find().sort({ createdAt: -1 }).exec();
  }

  public async findByCode(code: string): Promise<ICoupon | null> {
    return Coupon.findOne({ code: code.toUpperCase().trim() }).exec();
  }

  public async findById(id: string): Promise<ICoupon | null> {
    if (!mongoose.Types.ObjectId.isValid(id)) return null;
    return Coupon.findById(id).exec();
  }

  public async create(data: Partial<ICoupon>): Promise<ICoupon> {
    const coupon = new Coupon({
      code: String(data.code || '').toUpperCase().trim(),
      discountType: data.discountType || 'fixed',
      discountValue: Number(data.discountValue || 0),
      minOrderAmount: Number(data.minOrderAmount || 0),
      maxUses: Number(data.maxUses ?? (data as any).usageLimit ?? 0),
      expiryDate: data.expiryDate ?? (data as any).validTo ?? new Date(),
      isActive: data.isActive !== false,
    });
    return coupon.save();
  }

  public async update(id: string, data: Partial<ICoupon>): Promise<ICoupon | null> {
    if (!mongoose.Types.ObjectId.isValid(id)) return null;

    const updateData: any = { ...data };
    if (data.code) updateData.code = data.code.toUpperCase().trim();

    return Coupon.findByIdAndUpdate(id, updateData, { new: true }).exec();
  }

  public async delete(id: string): Promise<boolean> {
    if (!mongoose.Types.ObjectId.isValid(id)) return false;
    const result = await Coupon.findByIdAndDelete(id).exec();
    return result !== null;
  }

  public async incrementUsedCount(id: string | mongoose.Types.ObjectId): Promise<void> {
    await Coupon.findByIdAndUpdate(id, { $inc: { usedCount: 1 } }).exec();
  }
}
