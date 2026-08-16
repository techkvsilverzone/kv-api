/**
 * Order domain model.
 *
 * The shipping address is denormalised onto `orders` as a set of `shipping_*`
 * columns and mapped back into the nested `shippingAddress` object the API has
 * always returned. It remains a historical snapshot: reads never recompute it
 * and never resolve it against the customer's current address book (spec §17).
 */

export interface IOrderItem {
  _id: string;
  /** Null for a line with no catalogue product behind it, e.g. a gift voucher. */
  productId: string | null;
  productGroupCode: string;
  productName: string;
  quantity: number;
  weight: number;
  unitPrice: number;
  totalPrice: number;
  isGiftVoucher?: boolean;
}

export interface IShippingAddress {
  name: string;
  phone: string;
  line1: string;
  line2?: string | null;
  city: string;
  state: string;
  pincode: string;
  country: string;
}

/** Present when the query joined the customer, standing in for the old `populate`. */
export interface IOrderUserRef {
  _id: string;
  name: string;
  email: string;
}

export interface IOrder {
  _id: string;
  userId: string | IOrderUserRef;
  /** Sequential per-calendar-year tax invoice number, e.g. "INV-2026-000123". */
  invoiceNumber: string;
  status: string;
  paymentMethod: string;
  paymentStatus: string;
  razorpayOrderId?: string | null;
  razorpayPaymentId?: string | null;
  couponCode?: string | null;
  couponDiscount: number;
  giftWrap: boolean;
  giftMessage?: string | null;
  giftWrapFee: number;
  subtotal: number;
  taxAmount: number;
  totalWithTax: number;
  deliveryFee: number;
  grandTotal: number;
  totalAmount: number;
  tax: number;
  shippingAddress: IShippingAddress;
  items: IOrderItem[];
  /** Set once, the first time status transitions to 'Delivered' — anchors the return claim window. */
  deliveredAt?: Date | null;
  createdAt: Date | null;
  updatedAt: Date | null;
}
