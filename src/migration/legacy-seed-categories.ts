import { connectMongo, disconnectMongo } from './mongoConnection';
import { Category } from './models/category.model';
import { Product } from './models/product.model';
import Logger from '../utils/logger';

/** Seeded taxonomy. Only Jewellery has subcategories today. */
const TAXONOMY: Record<string, string[]> = {
  Jewellery: ['Mens', 'Womens', 'Kids'],
  'Puja Items': [],
  Coins: [],
  Idols: [],
  'Car Dashboard': [],
  'Photo Frames': [],
  'Silver Articles': [],
  'New Born Baby Products': [],
};

/**
 * Best-effort category for a product with no category set yet, keyed off its
 * name. Order matters — 'coin' is checked before the puja keywords so e.g.
 * "Ganesha Coin Book" lands in Coins, not Puja Items. Anything unmatched
 * falls back to Silver Articles.
 */
function inferCategory(name: string): string {
  const n = name.toLowerCase();
  if (n.includes('coin')) return 'Coins';
  if (n.includes('photo frame')) return 'Photo Frames';
  if (['villaku', 'aarathi', 'archanai', 'bell', 'kungumam'].some((kw) => n.includes(kw))) return 'Puja Items';
  return 'Silver Articles';
}

interface SeedReport {
  categoriesRegistered: number;
  subcategoriesRegistered: number;
  productAssignments: Array<{ id: string; name: string; category: string }>;
  applied: boolean;
}

/**
 * Idempotent: upserts the fixed taxonomy into the Category collection and
 * backfills `category` on any product that doesn't have one set — never
 * overwrites a product's existing category, so re-running (or running with
 * apply=false to preview) is always safe.
 */
export async function seedCategories(options: { apply: boolean }): Promise<SeedReport> {
  // A pre-existing single-field unique index on `name` (from before subcategories
  // existed) would collide with the new compound { name, parent } index.
  const indexes = await Category.collection.indexes().catch(() => []);
  const legacyIndex = indexes.find((idx) => idx.unique && Object.keys(idx.key).join(',') === 'name');
  if (legacyIndex?.name && options.apply) {
    await Category.collection.dropIndex(legacyIndex.name);
    Logger.info(`Dropped legacy index ${legacyIndex.name} on Category.name`);
  }

  let categoriesRegistered = 0;
  let subcategoriesRegistered = 0;
  if (options.apply) {
    for (const [name, subcategories] of Object.entries(TAXONOMY)) {
      const res = await Category.findOneAndUpdate(
        { name, parent: null },
        { $setOnInsert: { name, parent: null } },
        { upsert: true, includeResultMetadata: true },
      );
      if (!res?.value) categoriesRegistered += 1;
      for (const sub of subcategories) {
        const subRes = await Category.findOneAndUpdate(
          { name: sub, parent: name },
          { $setOnInsert: { name: sub, parent: name } },
          { upsert: true, includeResultMetadata: true },
        );
        if (!subRes?.value) subcategoriesRegistered += 1;
      }
    }
  }

  const uncategorized = await Product.find(
    { $or: [{ category: { $exists: false } }, { category: '' }, { category: null }] },
    { name: 1 },
  ).lean();

  const productAssignments = uncategorized.map((p: any) => ({
    id: String(p._id),
    name: p.name as string,
    category: inferCategory(p.name),
  }));

  if (options.apply) {
    for (const assignment of productAssignments) {
      await Product.updateOne({ _id: assignment.id }, { $set: { category: assignment.category } });
    }
  }

  return { categoriesRegistered, subcategoriesRegistered, productAssignments, applied: options.apply };
}

// Allow running directly: `npm run seed:categories` (dry run) or `npm run seed:categories -- --apply`
if (require.main === module) {
  const apply = process.argv.includes('--apply');
  (async () => {
    try {
      await connectMongo();
      const report = await seedCategories({ apply });
      Logger.info(`[${apply ? 'APPLY' : 'DRY RUN'}] categories registered: ${report.categoriesRegistered}, subcategories registered: ${report.subcategoriesRegistered}`);
      Logger.info(`[${apply ? 'APPLY' : 'DRY RUN'}] product category assignments (${report.productAssignments.length}):`);
      report.productAssignments.forEach((a) => Logger.info(`  ${a.name} -> ${a.category}`));
      if (!apply) {
        Logger.info('Dry run only — re-run with `-- --apply` to write these changes.');
      }
    } catch (error) {
      Logger.error(`Category seed failed: ${error instanceof Error ? error.message : String(error)}`);
      process.exitCode = 1;
    } finally {
      await disconnectMongo();
    }
  })();
}
