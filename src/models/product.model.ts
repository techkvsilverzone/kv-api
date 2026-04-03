import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IProductImage {
  variantName: string;
  imageBase64: string;
  sortOrder: number;
}

export interface IProduct extends Document {
  _id: mongoose.Types.ObjectId;
  productGroupCode: string;
  name: string;
  description?: string;
  material: string;
  weight: number;
  price: number;
  originalPrice?: number;
  purity?: string;
  quantity: number;
  isActive: boolean;
  images: IProductImage[];
  createdAt: Date;
  updatedAt: Date;
}

const ProductImageSchema = new Schema<IProductImage>(
  {
    variantName: { type: String, required: true },
    imageBase64: { type: String, default: '' },
    sortOrder: { type: Number, default: 1 },
  },
  { _id: false },
);

const ProductSchema = new Schema<IProduct>(
  {
    productGroupCode: { type: String, required: true, unique: true, uppercase: true, trim: true },
    name: { type: String, required: true, trim: true },
    description: { type: String },
    material: { type: String, required: true },
    weight: { type: Number, required: true },
    price: { type: Number, required: true },
    quantity: { type: Number, required: true, default: 0 },
    originalPrice: { type: Number },
    purity: { type: String },
    isActive: { type: Boolean, default: true },
    images: { type: [ProductImageSchema], default: [] },
  },
  { timestamps: true },
);

ProductSchema.index({ material: 1 });
ProductSchema.index({ price: 1 });
ProductSchema.index({ name: 'text', description: 'text', material: 'text' });

export const Product: Model<IProduct> = mongoose.model<IProduct>('Product', ProductSchema);
