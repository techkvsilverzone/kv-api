import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IReturnItem {
  orderItemId: mongoose.Types.ObjectId;
  productName: string;
  quantity: number;
  reason?: string;
}

export type ReturnFaultType = 'kv_fault' | 'customer_preference';
export type ReturnVideoStatus = 'not_required' | 'awaiting' | 'received';

export interface IReturn extends Document {
  _id: mongoose.Types.ObjectId;
  orderId: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  reason: string;
  description?: string;
  status: 'Pending' | 'Approved' | 'Rejected' | 'Completed';
  refundAmount: number;
  items: IReturnItem[];
  /** Whether this is a KV-fault claim (refund/replacement eligible) or a customer-preference
   * request (exchange/store-credit only — never a cash refund, since metal value fluctuates). */
  faultType: ReturnFaultType;
  /** 'awaiting' for kv_fault claims until the unboxing video is matched; 'not_required' otherwise. */
  videoStatus: ReturnVideoStatus;
  /** Short code (e.g. "RET-A1B2C3") the customer includes in their WhatsApp video caption. */
  videoReferenceCode?: string;
  videoFilePath?: string;
  videoMimeType?: string;
  videoReceivedAt?: Date;
  videoSenderPhone?: string;
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
    description: { type: String },
    status: {
      type: String,
      required: true,
      enum: ['Pending', 'Approved', 'Rejected', 'Completed'],
      default: 'Pending',
    },
    refundAmount: { type: Number, default: 0 },
    items: { type: [ReturnItemSchema], default: [] },
    faultType: {
      type: String,
      required: true,
      enum: ['kv_fault', 'customer_preference'],
    },
    videoStatus: {
      type: String,
      required: true,
      enum: ['not_required', 'awaiting', 'received'],
      default: 'not_required',
    },
    videoReferenceCode: { type: String, unique: true, sparse: true },
    videoFilePath: { type: String },
    videoMimeType: { type: String },
    videoReceivedAt: { type: Date },
    videoSenderPhone: { type: String },
  },
  { timestamps: true },
);

ReturnSchema.index({ userId: 1 });
ReturnSchema.index({ orderId: 1 });

export const Return: Model<IReturn> = mongoose.model<IReturn>('Return', ReturnSchema);
