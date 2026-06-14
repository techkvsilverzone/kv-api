import mongoose from 'mongoose';
import { InventoryTransaction, IInventoryTransaction, TransactionType } from '../models/inventoryTransaction.model';
import { Inventory, IInventory } from '../models/inventory.model';

export interface CreateTransactionData {
  type: TransactionType;
  productId: string;
  quantity: number;
  reason: string;
  performedBy: string;
}

export interface TransactionFilters {
  productId?: string;
  type?: TransactionType;
  limit?: number;
}

export class InventoryRepository {
  // ── Inventory stock document ──────────────────────────────────────────

  public async findByProductId(productId: string): Promise<IInventory | null> {
    return Inventory.findOne({ productId: new mongoose.Types.ObjectId(productId) });
  }

  public async upsertStock(
    productId: string,
    currentStock: number,
    stockThreshold?: number,
  ): Promise<IInventory> {
    const update: any = { currentStock };
    if (stockThreshold !== undefined) update.stockThreshold = stockThreshold;

    return Inventory.findOneAndUpdate(
      { productId: new mongoose.Types.ObjectId(productId) },
      { $set: update },
      { upsert: true, new: true },
    ) as Promise<IInventory>;
  }

  public async findAllStock(): Promise<IInventory[]> {
    return Inventory.find().populate('productId', 'name isActive').lean() as Promise<IInventory[]>;
  }

  /**
   * Create the stock document only if it does not exist yet (lazy seed from the
   * product's listed quantity). Never clobbers an existing currentStock.
   */
  public async ensureStock(
    productId: string,
    initialStock: number,
    stockThreshold?: number,
  ): Promise<IInventory> {
    return Inventory.findOneAndUpdate(
      { productId: new mongoose.Types.ObjectId(productId) },
      {
        $setOnInsert: {
          currentStock: Math.max(0, Math.floor(initialStock) || 0),
          ...(stockThreshold !== undefined ? { stockThreshold } : {}),
        },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    ).exec() as Promise<IInventory>;
  }

  /**
   * Atomically decrement stock only when at least `qty` is available.
   * Returns true on success, false if insufficient (no change). The conditional
   * filter makes this race-safe under concurrent checkouts.
   */
  public async decrementStockAtomic(productId: string, qty: number): Promise<boolean> {
    if (!mongoose.Types.ObjectId.isValid(productId)) return false;
    const result = await Inventory.findOneAndUpdate(
      { productId: new mongoose.Types.ObjectId(productId), currentStock: { $gte: qty } },
      { $inc: { currentStock: -qty } },
      { new: true },
    ).exec();
    return result !== null;
  }

  /** Restore stock (rollback of a partial reservation). */
  public async incrementStock(productId: string, qty: number): Promise<void> {
    if (!mongoose.Types.ObjectId.isValid(productId)) return;
    await Inventory.findOneAndUpdate(
      { productId: new mongoose.Types.ObjectId(productId) },
      { $inc: { currentStock: qty } },
    ).exec();
  }

  /** Map of productId -> currentStock for a set of products (for read enrichment). */
  public async getStockMap(productIds: string[]): Promise<Record<string, number>> {
    const ids = productIds
      .filter((id) => mongoose.Types.ObjectId.isValid(id))
      .map((id) => new mongoose.Types.ObjectId(id));
    if (ids.length === 0) return {};
    const docs = await Inventory.find({ productId: { $in: ids } }).lean();
    const map: Record<string, number> = {};
    for (const doc of docs as any[]) {
      map[doc.productId.toString()] = doc.currentStock;
    }
    return map;
  }

  // ── Inventory transactions (audit log) ───────────────────────────────

  public async createTransaction(data: CreateTransactionData): Promise<IInventoryTransaction> {
    const tx = new InventoryTransaction({
      type: data.type,
      productId: new mongoose.Types.ObjectId(data.productId),
      quantity: data.quantity,
      reason: data.reason,
      performedBy: new mongoose.Types.ObjectId(data.performedBy),
    });
    return tx.save();
  }

  public async findTransactions(filters: TransactionFilters = {}): Promise<any[]> {
    const query: any = {};

    if (filters.productId) {
      query.productId = new mongoose.Types.ObjectId(filters.productId);
    }
    if (filters.type === 'IN' || filters.type === 'OUT') {
      query.type = filters.type;
    }

    const limit = filters.limit ? Number(filters.limit) : 100;

    const transactions = await InventoryTransaction.find(query)
      .sort({ date: -1 })
      .limit(limit)
      .populate('productId', 'name')
      .populate('performedBy', '_id name email')
      .lean();

    return transactions.map((tx: any) => ({
      id: tx._id.toString(),
      type: tx.type,
      productId: tx.productId?._id?.toString() ?? tx.productId?.toString(),
      productName: tx.productId?.name ?? '',
      quantity: tx.quantity,
      reason: tx.reason,
      date: tx.date,
      performedBy: tx.performedBy?._id?.toString() ?? tx.performedBy?.toString(),
    }));
  }
}
