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
