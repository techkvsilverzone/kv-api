import mongoose, { Schema, Document, Model } from 'mongoose';

export interface ICartItem {
  _id: mongoose.Types.ObjectId;
  productId: mongoose.Types.ObjectId;
  productGroupCode: string;
  productName: string;
  quantity: number;
  weight: number;
  unitPrice: number;
}

export interface ICart extends Document {
  _id: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  items: ICartItem[];
  updatedAt: Date;
}

const CartItemSchema = new Schema<ICartItem>(
  {
    productId: { type: Schema.Types.ObjectId, ref: 'Product', required: true },
    productGroupCode: { type: String, required: true },
    productName: { type: String, required: true },
    quantity: { type: Number, required: true, min: 1 },
    weight: { type: Number, required: true },
    unitPrice: { type: Number, required: true },
  },
  { _id: true },
);

const CartSchema = new Schema<ICart>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
    items: { type: [CartItemSchema], default: [] },
  },
  { timestamps: true },
);

export const Cart: Model<ICart> = mongoose.model<ICart>('Cart', CartSchema);
