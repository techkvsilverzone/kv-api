import mongoose from 'mongoose';
import { Return, IReturn, ReturnFaultType } from '../models/return.model';

export { IReturn };

const generateVideoReferenceCode = (id: mongoose.Types.ObjectId): string =>
  `RET-${id.toString().slice(-6).toUpperCase()}`;

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

    const faultType: ReturnFaultType = data.faultType === 'customer_preference' ? 'customer_preference' : 'kv_fault';
    const _id = new mongoose.Types.ObjectId();

    const ret = new Return({
      _id,
      orderId: new mongoose.Types.ObjectId(String(data.orderId)),
      userId: new mongoose.Types.ObjectId(String(data.userId)),
      reason: String(data.reason || ''),
      description: data.description || undefined,
      refundAmount: Number(data.refundAmount || 0),
      items,
      faultType,
      videoStatus: faultType === 'kv_fault' ? 'awaiting' : 'not_required',
      videoReferenceCode: faultType === 'kv_fault' ? generateVideoReferenceCode(_id) : undefined,
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

  public async findByVideoReferenceCode(code: string): Promise<IReturn | null> {
    return Return.findOne({ videoReferenceCode: code.trim().toUpperCase() }).exec();
  }

  /** Returns still awaiting a video whose ORDER's shipping-address phone matches
   * the given WhatsApp sender number — the fallback match when no/garbled
   * reference code is in the caption. Matches on the last 10 digits only, so
   * formatting (+91, spaces, leading 0) doesn't cause a false miss. */
  public async findAwaitingVideoByPhone(phone: string): Promise<IReturn[]> {
    const normalized = phone.replace(/\D/g, '').slice(-10);
    if (!normalized) return [];
    const candidates = await Return.find({ videoStatus: 'awaiting' }).populate('orderId').exec();
    return candidates.filter((r) => {
      const orderPhone = (r.orderId as any)?.shippingAddress?.phone;
      return !!orderPhone && String(orderPhone).replace(/\D/g, '').slice(-10) === normalized;
    });
  }

  public async attachVideo(
    id: string,
    data: { filePath: string; mimeType: string; senderPhone: string },
  ): Promise<IReturn | null> {
    return Return.findByIdAndUpdate(
      id,
      {
        videoStatus: 'received',
        videoFilePath: data.filePath,
        videoMimeType: data.mimeType,
        videoSenderPhone: data.senderPhone,
        videoReceivedAt: new Date(),
      },
      { new: true },
    ).exec();
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
