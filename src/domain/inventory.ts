export type TransactionType = 'IN' | 'OUT';

/** The product summary that `findAllStock` attaches, standing in for the old `populate`. */
export interface IInventoryProductRef {
  _id: string;
  name: string;
  isActive: boolean;
}

/**
 * Authoritative per-product stock. `Product.quantity` is only the seed value
 * and stays in place until inventory behaviour is fully reconciled (spec §25).
 *
 * `productId` is a bare id on single-row reads and a product summary on
 * `findAllStock`, exactly as Mongoose's optional `populate` behaved — callers
 * already handle both forms.
 */
export interface IInventory {
  _id: string;
  productId: string | IInventoryProductRef;
  currentStock: number;
  stockThreshold: number;
  createdAt: Date | null;
  updatedAt: Date | null;
}

export interface IInventoryTransaction {
  _id: string;
  type: TransactionType;
  productId: string;
  quantity: number;
  reason: string;
  performedBy: string;
  date: Date | null;
}
