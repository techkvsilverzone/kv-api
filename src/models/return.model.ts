import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IReturnItem {
  orderItemId: mongoose.Types.ObjectId;
  productName: string;
  quantity: number;
  reason?: string;
}

export interface IReturn extends Document {
  _id: mongoose.Types.ObjectId;
  orderId: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  reason: string;
  status: 'Pending' | 'Approved' | 'Rejected' | 'Completed';
  refundAmount: number;
  items: IReturnItem[];
  createdAt: Date;
  updatedAt: Date;
}

const ReturnItemSchema = new Schema<IReturnItem>(
  {
    orderItemId: { type: Schema.Types.ObjectId, required: true },
    productName: { type: String, required: true },
    quantity: { type: Number, required: true },
    reason: { type: String },
  },
  { _id: false },
);

const ReturnSchema = new Schema<IReturn>(
  {
    orderId: { type: Schema.Types.ObjectId, ref: 'Order', required: true },
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    reason: { type: String, required: true },
    status: {
      type: String,
      required: true,
      enum: ['Pending', 'Approved', 'Rejected', 'Completed'],
      default: 'Pending',
    },
    refundAmount: { type: Number, default: 0 },
    items: { type: [ReturnItemSchema], default: [] },
  },
  { timestamps: true },
);

ReturnSchema.index({ userId: 1 });
ReturnSchema.index({ orderId: 1 });

export const Return: Model<IReturn> = mongoose.model<IReturn>('Return', ReturnSchema);
