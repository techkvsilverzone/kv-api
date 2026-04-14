import { Product } from '../models/product.model';
import { InventoryTransaction } from '../models/inventoryTransaction.model';
import { InventoryRepository, TransactionFilters } from '../repositories/inventory.repository';
import { AppError } from '../utils/appError';

export class InventoryService {
  private inventoryRepository: InventoryRepository;

  constructor() {
    this.inventoryRepository = new InventoryRepository();
  }

  /** Ensure an Inventory doc exists for the product; returns current stock */
  private async getOrInitStock(productId: string): Promise<number> {
    const inv = await this.inventoryRepository.findByProductId(productId);
    return inv ? inv.currentStock : 0;
  }

  public async stockInward(productId: string, quantity: number, reason: string, performedBy: string) {
    const product = await Product.findById(productId);
    if (!product) throw new AppError('Product not found', 404);

    const currentStock = await this.getOrInitStock(productId);
    const newStock = currentStock + quantity;
    await this.inventoryRepository.upsertStock(productId, newStock);

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

    const currentStock = await this.getOrInitStock(productId);
    if (currentStock < quantity) {
      throw new AppError(`Insufficient stock. Available: ${currentStock}`, 400);
    }

    await this.inventoryRepository.upsertStock(productId, currentStock - quantity);

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

    const currentStock = await this.getOrInitStock(productId);
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

    await this.inventoryRepository.upsertStock(productId, physicalCount);

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
    const stocks = await this.inventoryRepository.findAllStock();
    return stocks
      .filter((inv: any) => {
        const product = inv.productId as any;
        if (!product?.isActive) return false;
        return inv.currentStock <= inv.stockThreshold;
      })
      .map((inv: any) => ({
        productId: inv.productId?._id?.toString() ?? inv.productId?.toString(),
        productName: inv.productId?.name ?? '',
        currentStock: inv.currentStock,
        threshold: inv.stockThreshold,
      }));
  }

  public async getSummary() {
    const stocks = await this.inventoryRepository.findAllStock();

    let totalItemsInStock = 0;
    let lowStockCount = 0;
    let outOfStockCount = 0;

    for (const inv of stocks) {
      const product = (inv as any).productId as any;
      if (!product?.isActive) continue;
      totalItemsInStock += inv.currentStock;
      if (inv.currentStock === 0) {
        outOfStockCount++;
      } else if (inv.currentStock <= inv.stockThreshold) {
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
