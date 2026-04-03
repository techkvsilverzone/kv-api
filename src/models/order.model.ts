import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IOrderItem {
  _id: mongoose.Types.ObjectId;
  productId: mongoose.Types.ObjectId;
  productGroupCode: string;
  productName: string;
  quantity: number;
  weight: number;
  unitPrice: number;
  totalPrice: number;
}

export interface IShippingAddress {
  name: string;
  phone: string;
  line1: string;
  line2?: string;
  city: string;
  state: string;
  pincode: string;
  country: string;
}

export interface IOrder extends Document {
  _id: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  status: string;
  paymentMethod: string;
  paymentStatus: string;
  razorpayOrderId?: string;
  razorpayPaymentId?: string;
  couponCode?: string;
  couponDiscount: number;
  totalAmount: number;
  tax: number;
  shippingAddress: IShippingAddress;
  items: IOrderItem[];
  createdAt: Date;
  updatedAt: Date;
}

const OrderItemSchema = new Schema<IOrderItem>(
  {
    productId: { type: Schema.Types.ObjectId, ref: 'Product', required: true },
    productGroupCode: { type: String, default: '' },
    productName: { type: String, required: true },
    quantity: { type: Number, required: true },
    weight: { type: Number, required: true },
    unitPrice: { type: Number, required: true },
    totalPrice: { type: Number, required: true },
  },
  { _id: true },
);

const ShippingAddressSchema = new Schema<IShippingAddress>(
  {
    name: { type: String, required: true },
    phone: { type: String, required: true },
    line1: { type: String, required: true },
    line2: { type: String },
    city: { type: String, required: true },
    state: { type: String, required: true },
    pincode: { type: String, required: true },
    country: { type: String, required: true, default: 'India' },
  },
  { _id: false },
);

const OrderSchema = new Schema<IOrder>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    status: {
      type: String,
      required: true,
      enum: ['Pending', 'Processing', 'Shipped', 'Delivered', 'Cancelled'],
      default: 'Pending',
    },
    paymentMethod: {
      type: String,
      required: true,
      enum: ['cod', 'razorpay', 'COD', 'RAZORPAY', 'Razorpay'],
      set: (v: string) => (typeof v === 'string' ? v.toLowerCase() : v),
    },
    paymentStatus: {
      type: String,
      required: true,
      enum: ['Pending', 'Paid', 'Failed', 'Refunded'],
      default: 'Pending',
    },
    razorpayOrderId: { type: String },
    razorpayPaymentId: { type: String },
    couponCode: { type: String },
    couponDiscount: { type: Number, default: 0 },
    totalAmount: { type: Number, required: true },
    tax: { type: Number, default: 0 },
    shippingAddress: { type: ShippingAddressSchema, required: true },
    items: { type: [OrderItemSchema], default: [] },
  },
  { timestamps: true },
);

OrderSchema.index({ userId: 1 });
OrderSchema.index({ status: 1 });

export const Order: Model<IOrder> = mongoose.model<IOrder>('Order', OrderSchema);
