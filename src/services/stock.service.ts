import { InventoryRepository } from '../repositories/inventory.repository';
import { PricedLineItem } from './pricing.service';
import { AppError } from '../utils/appError';
import Logger from '../utils/logger';

/**
 * Enforces product stock at order creation (I9). The `Inventory.currentStock`
 * collection is the single source of truth for stock; it is lazily seeded from
 * the product's listed quantity the first time a product is checked out.
 * Decrements are atomic and conditional, so concurrent checkouts cannot
 * oversell; a partial reservation is rolled back on the first failure.
 */
export class StockService {
  private inventoryRepository: InventoryRepository;

  constructor() {
    this.inventoryRepository = new InventoryRepository();
  }

  /**
   * Reserve (decrement) stock for every physical line item. Throws AppError 409
   * with the offending product name if any item is unavailable, after rolling
   * back any items already decremented in this call.
   */
  public async reserveForOrder(
    items: PricedLineItem[],
    userId: string,
    reason = 'Customer order',
  ): Promise<void> {
    const physicalItems = items.filter((i) => !i.isGiftVoucher);
    const reserved: Array<{ productId: string; qty: number }> = [];

    for (const item of physicalItems) {
      // Lazy-seed the inventory doc from the product's listed quantity so legacy
      // products (created before inventory tracking) can still be sold.
      await this.inventoryRepository.ensureStock(item.product, item.stockAvailable ?? 0);

      const ok = await this.inventoryRepository.decrementStockAtomic(item.product, item.quantity);
      if (!ok) {
        await this.rollback(reserved);
        throw new AppError(
          `${item.name} is out of stock or the requested quantity is unavailable`,
          409,
        );
      }
      reserved.push({ productId: item.product, qty: item.quantity });
    }

    // Best-effort audit ledger entries (never block the order on a log write).
    for (const r of reserved) {
      try {
        await this.inventoryRepository.createTransaction({
          type: 'OUT',
          productId: r.productId,
          quantity: r.qty,
          reason,
          performedBy: userId,
        });
      } catch (error) {
        Logger.error(
          `Inventory ledger write failed for ${r.productId}: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }
  }

  /**
   * Release previously-reserved stock (e.g. when order persistence fails after
   * a successful reservation). Public compensation counterpart to reserveForOrder.
   */
  public async releaseForOrder(items: PricedLineItem[], _userId: string): Promise<void> {
    const reserved = items
      .filter((i) => !i.isGiftVoucher)
      .map((i) => ({ productId: i.product, qty: i.quantity }));
    await this.rollback(reserved);
  }

  private async rollback(reserved: Array<{ productId: string; qty: number }>): Promise<void> {
    for (const r of reserved) {
      try {
        await this.inventoryRepository.incrementStock(r.productId, r.qty);
      } catch (error) {
        Logger.error(
          `Stock rollback failed for ${r.productId}: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }
  }
}
