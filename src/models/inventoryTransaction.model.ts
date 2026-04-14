import mongoose, { Schema, Document, Model } from 'mongoose';

export type TransactionType = 'IN' | 'OUT';

export interface IInventoryTransaction extends Document {
  _id: mongoose.Types.ObjectId;
  type: TransactionType;
  productId: mongoose.Types.ObjectId;
  quantity: number;
  reason: string;
  performedBy: mongoose.Types.ObjectId;
  date: Date;
  createdAt: Date;
  updatedAt: Date;
}

const InventoryTransactionSchema = new Schema<IInventoryTransaction>(
  {
    type: { type: String, enum: ['IN', 'OUT'], required: true },
    productId: { type: Schema.Types.ObjectId, ref: 'Product', required: true },
    quantity: { type: Number, required: true, min: 1 },
    reason: { type: String, required: true, trim: true },
    performedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    date: { type: Date, default: Date.now },
  },
  { timestamps: true },
);

InventoryTransactionSchema.index({ productId: 1 });
InventoryTransactionSchema.index({ type: 1 });
InventoryTransactionSchema.index({ date: -1 });

export const InventoryTransaction: Model<IInventoryTransaction> = mongoose.model<IInventoryTransaction>(
  'InventoryTransaction',
  InventoryTransactionSchema,
);
