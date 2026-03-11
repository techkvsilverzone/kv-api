import mongoose from 'mongoose';
import { Return, IReturn } from '../models/return.model';

export { IReturn };

export class ReturnRepository {
  public async create(data: any): Promise<IReturn> {
    const items = (data.items || []).map((item: any) => {
      const rawId = item?.product?._id ?? item?.product?.id ?? item?.productId ?? item?.product;
      return {
        orderItemId: mongoose.Types.ObjectId.isValid(rawId)
          ? new mongoose.Types.ObjectId(rawId)
          : new mongoose.Types.ObjectId(),
        productName: String(item?.name || item?.productName || ''),
        quantity: Number(item?.quantity || 1),
        reason: item?.reason || undefined,
      };
    });

    const ret = new Return({
      orderId: new mongoose.Types.ObjectId(String(data.orderId)),
      userId: new mongoose.Types.ObjectId(String(data.userId)),
      reason: String(data.reason || ''),
      refundAmount: Number(data.refundAmount || 0),
      items,
    });

    return ret.save();
  }

  public async findByUserId(userId: string): Promise<IReturn[]> {
    return Return.find({ userId: new mongoose.Types.ObjectId(userId) })
      .sort({ createdAt: -1 })
      .exec();
  }

  public async findAll(): Promise<IReturn[]> {
    return Return.find()
      .populate('userId', 'name email')
      .populate('orderId')
      .sort({ createdAt: -1 })
      .exec();
  }

  public async findById(id: string): Promise<IReturn | null> {
    if (!mongoose.Types.ObjectId.isValid(id)) return null;
    return Return.findById(id)
      .populate('userId', 'name email')
      .populate('orderId')
      .exec();
  }

  public async updateStatus(id: string, status: string, refundAmount: number): Promise<IReturn | null> {
    if (!mongoose.Types.ObjectId.isValid(id)) return null;
    return Return.findByIdAndUpdate(
      id,
      { status, refundAmount: Number(refundAmount || 0) },
      { new: true },
    )
      .populate('userId', 'name email')
      .exec();
  }
}
