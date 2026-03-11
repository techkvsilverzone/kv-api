import mongoose from 'mongoose';
import { Order, IOrder } from '../models/order.model';

export class OrderRepository {
  public async create(data: any): Promise<IOrder> {
    const shippingAddress = data.shippingAddress || {};
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
      };
    });

    const order = new Order({
      userId: new mongoose.Types.ObjectId(String(data.user)),
      status: data.status || 'Pending',
      paymentMethod: data.paymentMethod || 'cod',
      paymentStatus: data.razorpayPaymentId ? 'Paid' : 'Pending',
      razorpayPaymentId: data.razorpayPaymentId || undefined,
      couponCode: data.couponCode || undefined,
      couponDiscount: Number(data.couponDiscount || 0),
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
    return Order.findByIdAndUpdate(id, { status }, { new: true })
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
