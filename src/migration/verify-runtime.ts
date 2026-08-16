import 'dotenv/config';
import { connectPostgres, disconnectPostgres, query } from '../infrastructure/postgres/pool';

import { UserRepository } from '../repositories/user.repository';
import { ProductRepository } from '../repositories/product.repository';
import { CategoryRepository } from '../repositories/category.repository';
import { CartRepository } from '../repositories/cart.repository';
import { WishlistRepository } from '../repositories/wishlist.repository';
import { OrderRepository } from '../repositories/order.repository';
import { CouponRepository } from '../repositories/coupon.repository';
import { GiftVoucherRepository } from '../repositories/giftVoucher.repository';
import { InventoryRepository } from '../repositories/inventory.repository';
import { ReviewRepository } from '../repositories/review.repository';
import { ReturnRepository } from '../repositories/return.repository';
import { UnmatchedReturnVideoRepository } from '../repositories/unmatchedReturnVideo.repository';
import { SavingsRepository } from '../repositories/savings.repository';
import { SchemePlanRepository } from '../repositories/schemePlan.repository';
import { MetalRateRepository } from '../repositories/metalrate.repository';
import { SilverRateRepository } from '../repositories/silverrate.repository';
import { RateStatusRepository } from '../repositories/rateStatus.repository';
import { StoreConfigRepository } from '../repositories/storeConfig.repository';
import { PricingConfigRepository } from '../repositories/pricingConfig.repository';
import { DeliveryConfigRepository } from '../repositories/deliveryConfig.repository';
import { FilterConfigRepository } from '../repositories/filterConfig.repository';
import { InvoiceConfigRepository } from '../repositories/invoiceConfig.repository';
import { StallConfigRepository } from '../repositories/stallConfig.repository';
import { PincodeRateRepository } from '../repositories/pincodeRate.repository';
import { OtpCodeRepository } from '../repositories/otpCode.repository';

/**
 * READ-ONLY runtime verification against the live PostgreSQL database.
 *
 * Every runtime repository's main read path is executed so that malformed SQL,
 * a wrong column name or a bad mapping surfaces here rather than in production.
 * Nothing is written. Run with `npm run migration:verify`.
 *
 * This complements the unit tests, which mock the pool: those prove the SQL we
 * *intend* to send, this proves PostgreSQL actually accepts it.
 */

type Check = { name: string; run: () => Promise<unknown> };

const summarise = (value: unknown): string => {
  if (value === null || value === undefined) return 'null';
  if (Array.isArray(value)) return `${value.length} row(s)`;
  if (typeof value === 'object') return `object(${Object.keys(value as object).length} keys)`;
  return String(value);
};

async function main(): Promise<void> {
  await connectPostgres();

  // Real ids from the migrated data, so the joins and nested aggregates are
  // exercised against actual rows rather than a guaranteed-empty result.
  const firstUser = await query<{ id: string }>('SELECT id FROM users ORDER BY id LIMIT 1');
  const firstProduct = await query<{ id: string }>('SELECT id FROM products ORDER BY id LIMIT 1');
  const userId = firstUser.rows[0]?.id ? String(firstUser.rows[0].id) : '0';
  const productId = firstProduct.rows[0]?.id ? String(firstProduct.rows[0].id) : '0';

  console.log(`Sample user id: ${userId} | sample product id: ${productId}`);
  console.log('');

  const checks: Check[] = [
    { name: 'User.findAll', run: () => new UserRepository().findAll() },
    { name: 'User.findById', run: () => new UserRepository().findById(userId) },
    { name: 'User.findRegularCustomers', run: () => new UserRepository().findRegularCustomers() },
    { name: 'User.findCelebrationCandidates', run: () => new UserRepository().findCelebrationCandidates() },
    { name: 'User.getAddresses', run: () => new UserRepository().getAddresses(userId) },

    { name: 'Product.findAll', run: () => new ProductRepository().findAll({}) },
    { name: 'Product.findAll (filtered+paged)', run: () => new ProductRepository().findAll({ category: 'Jewellery', search: 'silver', sortBy: 'price_asc', page: '1', limit: '5' }) },
    { name: 'Product.findById', run: () => new ProductRepository().findById(productId) },
    { name: 'Product.findFeatured', run: () => new ProductRepository().findFeatured() },
    { name: 'Product.count', run: () => new ProductRepository().count() },
    { name: 'Product.getCategoryUsage', run: () => new ProductRepository().getCategoryUsage() },
    { name: 'Product.getTags', run: () => new ProductRepository().getTags() },

    { name: 'Category.findAll', run: () => new CategoryRepository().findAll() },

    { name: 'Cart.findByUserId', run: () => new CartRepository().findByUserId(userId) },
    { name: 'Wishlist.findByUserId', run: () => new WishlistRepository().findByUserId(userId) },

    { name: 'Order.findAll', run: () => new OrderRepository().findAll() },
    { name: 'Order.findByUserId', run: () => new OrderRepository().findByUserId(userId) },
    { name: 'Order.getStats', run: () => new OrderRepository().getStats() },

    { name: 'Coupon.findAll', run: () => new CouponRepository().findAll() },
    { name: 'GiftVoucher.findAll', run: () => new GiftVoucherRepository().findAll() },
    { name: 'GiftVoucher.findActive', run: () => new GiftVoucherRepository().findActive() },

    { name: 'Inventory.findAllStock', run: () => new InventoryRepository().findAllStock() },
    { name: 'Inventory.getStockMap', run: () => new InventoryRepository().getStockMap([productId]) },
    { name: 'Inventory.findTransactions', run: () => new InventoryRepository().findTransactions({}) },
    { name: 'Inventory.countTransactionsSince', run: () => new InventoryRepository().countTransactionsSince(new Date(0)) },

    { name: 'Review.findByProductId', run: () => new ReviewRepository().findByProductId(productId) },
    { name: 'Review.getAverageRating', run: () => new ReviewRepository().getAverageRating(productId) },

    { name: 'Return.findAll', run: () => new ReturnRepository().findAll() },
    { name: 'Return.findByUserId', run: () => new ReturnRepository().findByUserId(userId) },
    { name: 'Return.findAwaitingVideoByPhone', run: () => new ReturnRepository().findAwaitingVideoByPhone('+91 98765 43210') },
    { name: 'UnmatchedReturnVideo.findAllUnlinked', run: () => new UnmatchedReturnVideoRepository().findAllUnlinked() },

    { name: 'Savings.findAll', run: () => new SavingsRepository().findAll() },
    { name: 'Savings.findByUserId', run: () => new SavingsRepository().findByUserId(userId) },
    { name: 'Savings.findActiveWithUserPhone', run: () => new SavingsRepository().findActiveWithUserPhone() },
    { name: 'Savings.generatePassbookNumber', run: () => new SavingsRepository().generatePassbookNumber('SLV') },
    { name: 'SchemePlan.findAll', run: () => new SchemePlanRepository().findAll() },
    { name: 'SchemePlan.findByType', run: () => new SchemePlanRepository().findByType('SILVER_11_1') },

    { name: 'MetalRate.findToday', run: () => new MetalRateRepository().findToday() },
    { name: 'MetalRate.findHistory', run: () => new MetalRateRepository().findHistory(30) },
    { name: 'MetalRate.findLatest(SILVER)', run: () => new MetalRateRepository().findLatest('SILVER') },
    { name: 'MetalRate.findLatest(GOLD)', run: () => new MetalRateRepository().findLatest('GOLD') },
    { name: 'SilverRate.findAll', run: () => new SilverRateRepository().findAll() },
    { name: 'SilverRate.findToday', run: () => new SilverRateRepository().findToday() },

    { name: 'RateStatus.getStatus', run: () => new RateStatusRepository().getStatus() },
    { name: 'StoreConfig.get', run: () => new StoreConfigRepository().get() },
    { name: 'PricingConfig.getGstPercent', run: () => new PricingConfigRepository().getGstPercent() },
    { name: 'DeliveryConfig.getConfig', run: () => new DeliveryConfigRepository().getConfig() },
    { name: 'FilterConfig.get', run: () => new FilterConfigRepository().get() },
    { name: 'InvoiceConfig.getConfig', run: () => new InvoiceConfigRepository().getConfig() },
    { name: 'StallConfig.getConfig', run: () => new StallConfigRepository().getConfig() },
    { name: 'PincodeRate.findAll', run: () => new PincodeRateRepository().findAll() },
    { name: 'OtpCode.findActive', run: () => new OtpCodeRepository().findActive('nobody@example.com', 'login') },
  ];

  let passed = 0;
  const failures: Array<{ name: string; error: string }> = [];

  for (const check of checks) {
    try {
      // eslint-disable-next-line no-await-in-loop
      const result = await check.run();
      passed += 1;
      console.log(`  PASS  ${check.name.padEnd(38)} -> ${summarise(result)}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      failures.push({ name: check.name, error: message });
      console.log(`  FAIL  ${check.name.padEnd(38)} -> ${message}`);
    }
  }

  console.log('');
  console.log(`${passed}/${checks.length} repository read paths verified against PostgreSQL.`);

  if (failures.length) {
    console.log('');
    console.log('FAILURES:');
    for (const failure of failures) console.log(`  ${failure.name}: ${failure.error}`);
    process.exitCode = 1;
  }

  await disconnectPostgres();
}

main().catch(async (error) => {
  console.error('VERIFICATION FAILED');
  console.error(error instanceof Error ? (error.stack ?? error.message) : error);
  await disconnectPostgres().catch(() => undefined);
  process.exitCode = 1;
});
