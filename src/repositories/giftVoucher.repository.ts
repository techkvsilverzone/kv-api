import mongoose from 'mongoose';
import { GiftVoucher, IGiftVoucher } from '../models/giftVoucher.model';

export class GiftVoucherRepository {
  public async findActive(): Promise<IGiftVoucher[]> {
    return GiftVoucher.find({ isActive: true }).sort({ sortOrder: 1, amount: 1 }).exec();
  }

  public async findAll(): Promise<IGiftVoucher[]> {
    return GiftVoucher.find().sort({ sortOrder: 1, amount: 1 }).exec();
  }

  public async findById(id: string): Promise<IGiftVoucher | null> {
    if (!mongoose.Types.ObjectId.isValid(id)) return null;
    return GiftVoucher.findById(id).exec();
  }

  public async create(data: Partial<IGiftVoucher>): Promise<IGiftVoucher> {
    const voucher = new GiftVoucher({
      label: String(data.label || '').trim(),
      amount: Number(data.amount || 0),
      description: data.description,
      imageBase64: data.imageBase64,
      isActive: data.isActive !== false,
      sortOrder: Number(data.sortOrder ?? 1),
    });
    return voucher.save();
  }

  public async update(id: string, data: Partial<IGiftVoucher>): Promise<IGiftVoucher | null> {
    if (!mongoose.Types.ObjectId.isValid(id)) return null;
    const updateData: any = {};
    if (data.label !== undefined) updateData.label = String(data.label).trim();
    if (data.amount !== undefined) updateData.amount = Number(data.amount);
    if (data.description !== undefined) updateData.description = data.description;
    if (data.imageBase64 !== undefined) updateData.imageBase64 = data.imageBase64;
    if (data.isActive !== undefined) updateData.isActive = Boolean(data.isActive);
    if (data.sortOrder !== undefined) updateData.sortOrder = Number(data.sortOrder);
    return GiftVoucher.findByIdAndUpdate(id, updateData, { new: true }).exec();
  }

  public async delete(id: string): Promise<boolean> {
    if (!mongoose.Types.ObjectId.isValid(id)) return false;
    const result = await GiftVoucher.findByIdAndDelete(id).exec();
    return result !== null;
  }
}
