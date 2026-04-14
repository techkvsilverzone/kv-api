import { Product } from '../models/product.model';
import { InventoryTransaction } from '../models/inventoryTransaction.model';
import { InventoryRepository, TransactionFilters } from '../repositories/inventory.repository';
import { AppError } from '../utils/appError';

export class InventoryService {
  private inventoryRepository: InventoryRepository;

  constructor() {
    this.inventoryRepository = new InventoryRepository();
  }

  public async stockInward(productId: string, quantity: number, reason: string, performedBy: string) {
    const product = await Product.findById(productId);
    if (!product) throw new AppError('Product not found', 404);

    product.quantity = product.quantity + quantity;
    await product.save();

    const transaction = await this.inventoryRepository.createTransaction({
      type: 'IN',
      productId,
      quantity,
      reason,
      performedBy,
    });

    return {
      id: transaction._id.toString(),
      type: transaction.type,
      productId: transaction.productId.toString(),
      quantity: transaction.quantity,
      reason: transaction.reason,
      date: transaction.date,
    };
  }

  public async stockOutward(productId: string, quantity: number, reason: string, performedBy: string) {
    const product = await Product.findById(productId);
    if (!product) throw new AppError('Product not found', 404);

    if (product.quantity < quantity) {
      throw new AppError(`Insufficient stock. Available: ${product.quantity}`, 400);
    }

    product.quantity = product.quantity - quantity;
    await product.save();

    const transaction = await this.inventoryRepository.createTransaction({
      type: 'OUT',
      productId,
      quantity,
      reason,
      performedBy,
    });

    return {
      id: transaction._id.toString(),
      type: transaction.type,
      productId: transaction.productId.toString(),
      quantity: transaction.quantity,
      reason: transaction.reason,
      date: transaction.date,
    };
  }

  public async getTransactions(filters: TransactionFilters) {
    return this.inventoryRepository.findTransactions(filters);
  }

  public async reconcile(productId: string, physicalCount: number, reason: string, performedBy: string) {
    const product = await Product.findById(productId);
    if (!product) throw new AppError('Product not found', 404);

    const currentStock = product.quantity;
    const delta = physicalCount - currentStock;

    if (delta === 0) {
      return {
        message: 'Stock is already accurate. No adjustment needed.',
        currentStock,
        physicalCount,
        adjustment: 0,
      };
    }

    const type = delta > 0 ? 'IN' : 'OUT';
    const adjustmentQty = Math.abs(delta);

    product.quantity = physicalCount;
    await product.save();

    const transaction = await this.inventoryRepository.createTransaction({
      type: type as 'IN' | 'OUT',
      productId,
      quantity: adjustmentQty,
      reason: reason || 'Stock reconciliation',
      performedBy,
    });

    return {
      message: `Stock reconciled. Adjustment: ${type} ${adjustmentQty}`,
      previousStock: currentStock,
      physicalCount,
      adjustment: delta,
      transaction: {
        id: transaction._id.toString(),
        type: transaction.type,
        quantity: adjustmentQty,
        date: transaction.date,
      },
    };
  }

  public async getLowStock() {
    const products = await Product.find({ isActive: true }).lean();
    return products
      .filter((p: any) => {
        const threshold = typeof p.stockThreshold === 'number' ? p.stockThreshold : 5;
        return p.quantity <= threshold;
      })
      .map((p: any) => ({
        productId: p._id.toString(),
        productName: p.name,
        currentStock: p.quantity,
        threshold: typeof p.stockThreshold === 'number' ? p.stockThreshold : 5,
      }));
  }

  public async getSummary() {
    const products = await Product.find({ isActive: true }).lean();

    let totalItemsInStock = 0;
    let lowStockCount = 0;
    let outOfStockCount = 0;

    for (const p of products) {
      const threshold = typeof (p as any).stockThreshold === 'number' ? (p as any).stockThreshold : 5;
      totalItemsInStock += p.quantity;
      if (p.quantity === 0) {
        outOfStockCount++;
      } else if (p.quantity <= threshold) {
        lowStockCount++;
      }
    }

    const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const recentMovements = await InventoryTransaction.countDocuments({ date: { $gte: since } });

    return {
      totalItemsInStock,
      lowStockCount,
      outOfStockCount,
      recentMovements,
    };
  }
}
