import { IProduct } from './catalog';

/**
 * Cart / wishlist / review / coupon / gift-voucher / shipping domain models.
 *
 * Carts and wishlists keep their nested `items` array even though the rows now
 * live in `cart_items` / `wishlist_items` (spec §16, §30).
 */

export interface ICartItem {
  _id: string;
  /**
   * The full product, as the old `populate('items.productId')` returned it.
   * Callers read `item.productId._id`, so the shape is preserved rather than
   * flattened to a bare id.
   */
  productId: IProduct | string;
  productGroupCode: string;
  productName: string;
  quantity: number;
  weight: number;
  unitPrice: number;
}

export interface ICart {
  _id: string;
  userId: string;
  items: ICartItem[];
  createdAt: Date | null;
  updatedAt: Date | null;
}

export interface IWishlistItem {
  productId: IProduct | string;
}

export interface IWishlist {
  _id: string;
  userId: string;
  items: IWishlistItem[];
  createdAt: Date | null;
  updatedAt: Date | null;
}

export interface ICoupon {
  _id: string;
  code: string;
  discountType: 'percentage' | 'fixed';
  discountValue: number;
  minOrderAmount: number;
  /** 0 means unlimited — it must never be normalised to null (spec §24). */
  maxUses: number;
  usedCount: number;
  expiryDate: Date;
  isActive: boolean;
  createdAt: Date | null;
  updatedAt: Date | null;
}

export interface IGiftVoucher {
  _id: string;
  label: string;
  amount: number;
  description?: string | null;
  /** Public URL of the voucher artwork. */
  imageUrl?: string | null;
  /** Same URL under the legacy key the admin panel and storefront still read. */
  imageBase64?: string | null;
  isActive: boolean;
  sortOrder: number;
  createdAt: Date | null;
  updatedAt: Date | null;
}

export interface IPincodeRate {
  _id: string;
  pincode: string;
  label: string;
  rate: number;
  createdAt: Date | null;
  updatedAt: Date | null;
}
