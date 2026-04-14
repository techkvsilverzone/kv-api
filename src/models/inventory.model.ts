import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IInventory extends Document {
  _id: mongoose.Types.ObjectId;
  productId: mongoose.Types.ObjectId;
  currentStock: number;
  stockThreshold: number;
  createdAt: Date;
  updatedAt: Date;
}

const InventorySchema = new Schema<IInventory>(
  {
    productId: { type: Schema.Types.ObjectId, ref: 'Product', required: true, unique: true },
    currentStock: { type: Number, required: true, default: 0, min: 0 },
    stockThreshold: { type: Number, default: 5, min: 0 },
  },
  { timestamps: true },
);

InventorySchema.index({ productId: 1 }, { unique: true });

export const Inventory: Model<IInventory> = mongoose.model<IInventory>('Inventory', InventorySchema);
