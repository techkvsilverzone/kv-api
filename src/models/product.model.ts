import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IProductImage {
  variantName: string;
  imageBase64: string;
  sortOrder: number;
}

export interface IProductVariant {
  label: string;
  weight: string;
  height?: string;
  breadth?: string;
}

export type ProductChargeType = 'percentage' | 'amount';

export interface IProductCharge {
  type: ProductChargeType;
  value: number;
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
  isSale?: boolean;
  isFeatured?: boolean;
  metalValue?: number;
  makingCharges?: number;
  makingChargePercent?: number;
  makingChargePerGram?: number;
  quantity: number;
  isActive: boolean;
  images: IProductImage[];
  variants: IProductVariant[];
  isFixedPrice?: boolean;
  makingCharge?: IProductCharge | null;
  wastage?: IProductCharge | null;
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

const ProductVariantSchema = new Schema<IProductVariant>(
  {
    label: { type: String, required: true, trim: true },
    weight: { type: String, required: true, trim: true },
    height: { type: String, trim: true },
    breadth: { type: String, trim: true },
  },
  { _id: false },
);

const ProductChargeSchema = new Schema<IProductCharge>(
  {
    type: { type: String, enum: ['percentage', 'amount'], required: true },
    value: { type: Number, required: true, min: 0 },
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
    isSale: { type: Boolean, default: false },
    isFeatured: { type: Boolean, default: false },
    metalValue: { type: Number },
    makingCharges: { type: Number },
    makingChargePercent: { type: Number },
    makingChargePerGram: { type: Number },
    isActive: { type: Boolean, default: true },
    images: { type: [ProductImageSchema], default: [] },
    variants: { type: [ProductVariantSchema], default: [] },
    isFixedPrice: { type: Boolean, default: false },
    makingCharge: { type: ProductChargeSchema, default: null },
    wastage: { type: ProductChargeSchema, default: null },
  },
  { timestamps: true },
);

ProductSchema.index({ material: 1 });
ProductSchema.index({ price: 1 });
ProductSchema.index({ name: 'text', description: 'text', material: 'text' });

export const Product: Model<IProduct> = mongoose.model<IProduct>('Product', ProductSchema);
