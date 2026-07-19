import mongoose from 'mongoose';
import { Order, IOrder } from '../models/order.model';

export class OrderRepository {
  /** Sequential per-calendar-year tax invoice number, e.g. "INV-2026-000123". */
  private async generateInvoiceNumber(): Promise<string> {
    const year = new Date().getFullYear();
    const start = new Date(year, 0, 1);
    const end = new Date(year + 1, 0, 1);
    const count = await Order.countDocuments({ createdAt: { $gte: start, $lt: end } });
    const seq = (count + 1).toString().padStart(6, '0');
    return `INV-${year}-${seq}`;
  }

  public async create(data: any): Promise<IOrder> {
    const shippingAddress = data.shippingAddress || {};
    const invoiceNumber = await this.generateInvoiceNumber();
    const items = (data.items || []).map((item: any) => {
      const rawId = item?.product?._id ?? item?.product?.id ?? item?.productId ?? item?.product;
      return {
        productId: mongoose.Types.ObjectId.isValid(rawId)
          ? new mongoose.Types.ObjectId(rawId)
          : new mongoose.Types.ObjectId(),
        productGroupCode: String(item?.productGroupCode || item?.productGroup || ''),
        productName: String(item?.name || item?.productName || ''),
        quantity: Number(item?.quantity || 1),
        weight: Number(item?.weight || item?.weightGm || 0),
        unitPrice: Number(item?.price || item?.unitPrice || 0),
        totalPrice: Number(item?.price || item?.unitPrice || 0) * Number(item?.quantity || 1),
        isGiftVoucher: Boolean(item?.isGiftVoucher || false),
      };
    });

    const order = new Order({
      userId: new mongoose.Types.ObjectId(String(data.user)),
      invoiceNumber,
      status: data.status || 'Pending',
      paymentMethod: data.paymentMethod || 'cod',
      paymentStatus: data.razorpayPaymentId ? 'Paid' : 'Pending',
      razorpayPaymentId: data.razorpayPaymentId || undefined,
      couponCode: data.couponCode || undefined,
      couponDiscount: Number(data.couponDiscount || 0),
      giftWrap: Boolean(data.giftWrap || false),
      giftMessage: data.giftMessage || undefined,
      giftWrapFee: Number(data.giftWrapFee || 0),
      subtotal: Number(data.subtotal || 0),
      taxAmount: Number(data.taxAmount || 0),
      totalWithTax: Number(data.totalWithTax || 0),
      deliveryFee: Number(data.deliveryFee || 0),
      grandTotal: Number(data.grandTotal || 0),
      totalAmount: Number(data.totalAmount || 0),
      tax: Number(data.tax || 0),
      shippingAddress: {
        name: String(shippingAddress.name || `${shippingAddress.firstName || ''} ${shippingAddress.lastName || ''}`.trim()),
        phone: String(shippingAddress.phone || ''),
        line1: String(shippingAddress.line1 || shippingAddress.address || ''),
        line2: shippingAddress.line2 || undefined,
        city: String(shippingAddress.city || ''),
        state: String(shippingAddress.state || ''),
        pincode: String(shippingAddress.pincode || ''),
        country: String(shippingAddress.country || 'India'),
      },
      items,
    });

    return order.save();
  }

  public async findByUserId(userId: string): Promise<IOrder[]> {
    return Order.find({ userId: new mongoose.Types.ObjectId(userId) })
      .sort({ createdAt: -1 })
      .exec();
  }

  public async findAll(): Promise<IOrder[]> {
    return Order.find()
      .populate('userId', 'name email')
      .sort({ createdAt: -1 })
      .exec();
  }

  public async findById(id: string): Promise<IOrder | null> {
    if (!mongoose.Types.ObjectId.isValid(id)) return null;
    return Order.findById(id)
      .populate('userId', 'name email')
      .exec();
  }

  public async updateStatus(id: string, status: string): Promise<IOrder | null> {
    if (!mongoose.Types.ObjectId.isValid(id)) return null;

    const update: Record<string, unknown> = { status };
    // Stamp deliveredAt the FIRST time an order reaches 'Delivered' — this anchors
    // the return claim window, so it must never be overwritten by a later re-save.
    if (status === 'Delivered') {
      const existing = await Order.findById(id).select('deliveredAt').exec();
      if (existing && !existing.deliveredAt) {
        update.deliveredAt = new Date();
      }
    }

    return Order.findByIdAndUpdate(id, update, { new: true })
      .populate('userId', 'name email')
      .exec();
  }

  public async getStats(): Promise<{ totalRevenue: number; totalOrders: number }> {
    const result = await Order.aggregate([
      {
        $group: {
          _id: null,
          totalRevenue: { $sum: '$totalAmount' },
          totalOrders: { $sum: 1 },
        },
      },
    ]);

    return {
      totalRevenue: result[0]?.totalRevenue || 0,
      totalOrders: result[0]?.totalOrders || 0,
    };
  }
}
