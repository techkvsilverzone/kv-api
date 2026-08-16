/**
 * Catalog domain models — plain-TypeScript replacements for the Mongoose
 * `IProduct` / `ICategory` document interfaces.
 *
 * `variants` and `images` are still nested on the product even though they now
 * live in `product_variants` and `product_images`. The relational split is a
 * storage detail; the API response shape the frontend consumes is unchanged
 * (spec §14, §30).
 */

export interface IProductImage {
  /** Public URL served by Nginx from the on-disk store, e.g. `/images/products/12/001-ab34cd12.webp`. */
  imageUrl: string;
  /**
   * The same public URL, under the key the storefront has always read.
   *
   * Base64 is gone from the database (spec §13), but the field name is part of
   * the client contract. An `<img src>` accepts a URL exactly where it accepted
   * a data URI, so existing clients keep rendering with no change while new
   * ones can read the clearer `imageUrl`.
   */
  imageBase64: string;
  variantName: string;
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

export interface IProduct {
  _id: string;
  productGroupCode: string;
  name: string;
  description?: string | null;
  material?: string | null;
  category: string;
  subcategory?: string | null;
  tags: string[];
  weight: number;
  price: number;
  originalPrice?: number | null;
  purity?: string | null;
  isSale?: boolean | null;
  isFeatured?: boolean | null;
  metalValue?: number | null;
  makingCharges?: number | null;
  makingChargePercent?: number | null;
  makingChargePerGram?: number | null;
  quantity: number;
  isActive: boolean;
  images: IProductImage[];
  variants: IProductVariant[];
  isFixedPrice?: boolean | null;
  makingCharge?: IProductCharge | null;
  wastage?: IProductCharge | null;
  createdAt: Date | null;
  updatedAt: Date | null;
}

export interface ICategory {
  _id: string;
  name: string;
  /** null marks a top-level category; otherwise the parent category's name. */
  parent: string | null;
  createdAt: Date | null;
  updatedAt: Date | null;
}
