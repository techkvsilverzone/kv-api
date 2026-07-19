import mongoose, { Schema, Document, Model } from 'mongoose';

/**
 * Standalone category registry. Product listings/filters primarily derive
 * categories from `Product.distinct('material')`, so a category with no
 * products yet wouldn't otherwise be selectable — this collection lets an
 * admin register one ahead of creating the first product in it (and removing
 * an entry here doesn't touch existing products, which keep their material
 * value regardless — see ProductRepository.getCategories()).
 */
export interface ICategory extends Document {
  _id: mongoose.Types.ObjectId;
  name: string;
  createdAt: Date;
  updatedAt: Date;
}

const CategorySchema = new Schema<ICategory>(
  {
    name: { type: String, required: true, unique: true, trim: true },
  },
  { timestamps: true },
);

export const Category: Model<ICategory> = mongoose.model<ICategory>('Category', CategorySchema);
