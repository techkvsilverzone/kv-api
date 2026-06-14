import { connectMongo, disconnectMongo } from './db';
import { Product } from '../models/product.model';
import { Inventory } from '../models/inventory.model';
import Logger from './logger';

/**
 * One-time reconciliation: create an Inventory.currentStock document for every
 * product that does not have one yet, seeded from the product's listed
 * `quantity`. Idempotent — existing inventory docs are left untouched.
 */
export async function seedInventoryFromProducts(): Promise<{ created: number; skipped: number }> {
  const products = await Product.find({}, { quantity: 1 }).lean();
  let created = 0;
  let skipped = 0;

  for (const product of products as Array<{ _id: any; quantity?: number }>) {
    const existing = await Inventory.findOne({ productId: product._id });
    if (existing) {
      skipped += 1;
      continue;
    }
    await Inventory.create({
      productId: product._id,
      currentStock: Math.max(0, Math.floor(Number(product.quantity) || 0)),
    });
    created += 1;
  }

  return { created, skipped };
}

// Allow running directly: `npm run seed:inventory`
if (require.main === module) {
  (async () => {
    try {
      await connectMongo();
      const result = await seedInventoryFromProducts();
      Logger.info(`Inventory seed complete — created ${result.created}, skipped ${result.skipped}`);
    } catch (error) {
      Logger.error(`Inventory seed failed: ${error instanceof Error ? error.message : String(error)}`);
      process.exitCode = 1;
    } finally {
      await disconnectMongo();
    }
  })();
}
