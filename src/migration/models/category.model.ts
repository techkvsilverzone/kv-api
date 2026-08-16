import mongoose, { Schema, Document, Model } from 'mongoose';

/**
 * Category/subcategory registry. Top-level categories have `parent: null`;
 * a subcategory (currently only Jewellery's Mens/Womens/Kids) sets `parent`
 * to its parent category's name. Product listings/filters primarily derive
 * categories in use from `Product.distinct('category')`, so a category with
 * no products yet wouldn't otherwise be selectable — this collection lets an
 * admin register one ahead of creating the first product in it (and removing
 * an entry here doesn't touch existing products, which keep their category
 * value regardless — see ProductService.getCategories()).
 */
export interface ICategory extends Document {
  _id: mongoose.Types.ObjectId;
  name: string;
  parent: string | null;
  createdAt: Date;
  updatedAt: Date;
}

const CategorySchema = new Schema<ICategory>(
  {
    name: { type: String, required: true, trim: true },
    parent: { type: String, default: null, trim: true },
  },
  { timestamps: true },
);

CategorySchema.index({ name: 1, parent: 1 }, { unique: true });

export const Category: Model<ICategory> = mongoose.model<ICategory>('Category', CategorySchema);
