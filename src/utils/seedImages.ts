import fs from 'fs';
import path from 'path';
import sql from 'mssql';
import { getSqlPool, closeSqlPool } from './sql';
import Logger from './logger';

const ASSETS_DIR = path.resolve(__dirname, '../../assets/product');

// ─── Image → ImageId mapping ────────────────────────────────────────────────
// Each entry describes one kv.ProductImage row.
// type: 'update' → UPDATE existing row
// type: 'insert' → INSERT new row (requires productGroupCode + variantName + sortOrder)
const IMAGE_MAP: Array<
  | { type: 'update'; imageId: number; file: string }
  | {
      type: 'insert';
      imageId: number;
      file: string;
      productGroupCode: string;
      variantName: string;
      sortOrder: number;
    }
> = [
  // ── Puja Items ────────────────────────────────────────────────────────────
  { type: 'update', imageId: 1,  file: 'WhatsApp Image 2026-02-19 at 2.26.10 PM.jpeg' },        // AGAL-01  – Agal Villaku, top view
  { type: 'update', imageId: 2,  file: 'WhatsApp Image 2026-02-19 at 2.31.36 PM.jpeg' },        // BOWL-01  – Design Bowl, front view
  { type: 'update', imageId: 3,  file: 'WhatsApp Image 2026-02-19 at 2.31.38 PM.jpeg' },        // BOWL-01  – Design Bowl, angle view
  { type: 'update', imageId: 4,  file: 'WhatsApp Image 2026-02-19 at 2.31.36 PM (1).jpeg' },    // BELL-01  – Bell, front view
  { type: 'update', imageId: 5,  file: 'WhatsApp Image 2026-02-19 at 2.31.37 PM (1).jpeg' },    // AF-A     – Archanai Flower lotus style
  { type: 'update', imageId: 6,  file: 'WhatsApp Image 2026-02-19 at 2.31.37 PM.jpeg' },        // AF-B     – Archanai Flower mesh petal
  { type: 'update', imageId: 7,  file: 'WhatsApp Image 2026-02-19 at 2.34.19 PM.jpeg' },        // AAR-01   – Wooden Aarathi, full view
  { type: 'update', imageId: 8,  file: 'WhatsApp Image 2026-02-19 at 2.35.44 PM.jpeg' },        // SOM-01   – Sombu (mini kalash)
  { type: 'update', imageId: 9,  file: 'WhatsApp Image 2026-02-19 at 2.44.27 PM.jpeg' },        // KBOX-01  – Kungumam Box, closed view
  { type: 'update', imageId: 10, file: 'WhatsApp Image 2026-02-19 at 2.44.27 PM (1).jpeg' },    // KUTHU-01 – Kutthu Villaku

  // ── Baby Coin Sets ────────────────────────────────────────────────────────
  { type: 'update', imageId: 11, file: 'WhatsApp Image 2026-02-20 at 1.11.05 PM (1).jpeg' },    // BC-BLUE  – Box open
  { type: 'update', imageId: 12, file: 'WhatsApp Image 2026-02-20 at 1.11.05 PM (2).jpeg' },    // BC-BLUE  – Certificate view
  { type: 'update', imageId: 13, file: 'WhatsApp Image 2026-02-20 at 1.11.06 PM (1).jpeg' },    // BC-BLUE  – Box closed (gift box)
  { type: 'update', imageId: 14, file: 'WhatsApp Image 2026-02-20 at 1.11.05 PM.jpeg' },        // BC-PINK  – Box open with certificate

  // ── Tree of Life Coin Set ─────────────────────────────────────────────────
  { type: 'update', imageId: 16, file: 'WhatsApp Image 2026-02-20 at 1.11.06 PM.jpeg' },        // TREE-01  – Box open (3 coloured tree coins)
  { type: 'update', imageId: 17, file: 'WhatsApp Image 2026-02-20 at 1.11.07 PM.jpeg' },        // TREE-01  – Coins close-up

  // ── Ashta Lakshmi Coin Set ────────────────────────────────────────────────
  { type: 'update', imageId: 18, file: 'WhatsApp Image 2026-02-20 at 12.51.06 PM.jpeg' },       // ASHTA-01 – Front cover
  { type: 'update', imageId: 19, file: 'WhatsApp Image 2026-02-20 at 12.51.06 PM (1).jpeg' },   // ASHTA-01 – Inside view (8 coins)

  // ── Coin Books ────────────────────────────────────────────────────────────
  { type: 'update', imageId: 21, file: 'WhatsApp Image 2026-02-20 at 12.51.08 PM.jpeg' },       // LAX-BOOK-01 – Closed cover (Lakshmi)
  { type: 'update', imageId: 22, file: 'WhatsApp Image 2026-02-20 at 12.51.08 PM (1).jpeg' },   // LAX-BOOK-01 – Open with coin
  { type: 'update', imageId: 23, file: 'WhatsApp Image 2026-02-20 at 12.51.08 PM (2).jpeg' },   // GAN-BOOK-01 – Open with coin (Ganesha)
  { type: 'update', imageId: 24, file: 'WhatsApp Image 2026-02-20 at 12.51.09 PM (1).jpeg' },   // SAR-BOOK-01 – Open with coin (Saraswati)
  { type: 'update', imageId: 25, file: 'WhatsApp Image 2026-02-20 at 12.51.09 PM.jpeg' },       // SAR-BOOK-01 – Closed cover
  { type: 'update', imageId: 26, file: 'WhatsApp Image 2026-02-20 at 12.51.10 PM.jpeg' },       // MUR-BOOK-01 – Open with coin (Palani Murugan)

  // ── NEW rows (no existing ImageId) ────────────────────────────────────────
  {
    type: 'insert',
    imageId: 27,
    file: 'WhatsApp Image 2026-02-20 at 12.51.07 PM (1).jpeg',  // GAN-BOOK-01 – Closed cover
    productGroupCode: 'GAN-BOOK-01',
    variantName: 'Closed cover',
    sortOrder: 2,
  },
  {
    type: 'insert',
    imageId: 28,
    file: 'WhatsApp Image 2026-02-20 at 12.51.07 PM.jpeg',      // MUR-BOOK-01 – Closed cover
    productGroupCode: 'MUR-BOOK-01',
    variantName: 'Closed cover',
    sortOrder: 2,
  },
  {
    type: 'insert',
    imageId: 29,
    file: 'WhatsApp Image 2026-02-20 at 12.51.06 PM (2).jpeg',  // MUR-BOOK-01 – Inside view (6 coins)
    productGroupCode: 'MUR-BOOK-01',
    variantName: 'Inside view',
    sortOrder: 3,
  },
];

function toBase64DataUri(filePath: string): string {
  const buffer = fs.readFileSync(filePath);
  const base64 = buffer.toString('base64');
  return `data:image/jpeg;base64,${base64}`;
}

export const seedImages = async (): Promise<void> => {
  const pool = await getSqlPool();

  let updated = 0;
  let inserted = 0;
  let skipped = 0;

  for (const entry of IMAGE_MAP) {
    const filePath = path.join(ASSETS_DIR, entry.file);

    if (!fs.existsSync(filePath)) {
      Logger.warn(`  [SKIP] File not found: ${entry.file}`);
      skipped++;
      continue;
    }

    Logger.info(`  Processing ImageId ${entry.imageId} — ${entry.file}`);
    const imageBase64 = toBase64DataUri(filePath);

    if (entry.type === 'update') {
      await pool
        .request()
        .input('imageId', sql.Int, entry.imageId)
        .input('imageBase64', sql.NVarChar(sql.MAX), imageBase64)
        .query(`
          UPDATE kv.ProductImage
          SET ImageBase64 = @imageBase64
          WHERE ImageId = @imageId;
        `);
      Logger.info(`  [UPDATED] ImageId ${entry.imageId}`);
      updated++;
    } else {
      // Resolve ProductGroupId from code
      const pgResult = await pool
        .request()
        .input('productGroupCode', sql.VarChar(30), entry.productGroupCode)
        .query<{ ProductGroupId: number }>(`
          SELECT TOP 1 ProductGroupId
          FROM kv.ProductGroup
          WHERE ProductGroupCode = @productGroupCode AND IsActive = 1;
        `);

      const productGroupId = pgResult.recordset[0]?.ProductGroupId;

      if (!productGroupId) {
        Logger.warn(`  [SKIP] ProductGroup not found for code: ${entry.productGroupCode}`);
        skipped++;
        continue;
      }

      // Upsert (insert if not exists, update if already exists)
      await pool
        .request()
        .input('imageId', sql.Int, entry.imageId)
        .input('productGroupId', sql.Int, productGroupId)
        .input('variantName', sql.NVarChar(150), entry.variantName)
        .input('imageBase64', sql.NVarChar(sql.MAX), imageBase64)
        .input('sortOrder', sql.Int, entry.sortOrder)
        .query(`
          MERGE kv.ProductImage AS target
          USING (
            SELECT
              @imageId        AS ImageId,
              @productGroupId AS ProductGroupId,
              @variantName    AS VariantName,
              @imageBase64    AS ImageBase64,
              @sortOrder      AS SortOrder
          ) AS source
          ON target.ImageId = source.ImageId
          WHEN MATCHED THEN
            UPDATE SET
              ProductGroupId = source.ProductGroupId,
              VariantName    = source.VariantName,
              ImageBase64    = source.ImageBase64,
              SortOrder      = source.SortOrder
          WHEN NOT MATCHED THEN
            INSERT (ImageId, ProductGroupId, VariantName, ImageBase64, SortOrder)
            VALUES (source.ImageId, source.ProductGroupId, source.VariantName, source.ImageBase64, source.SortOrder);
        `);
      Logger.info(`  [INSERTED/UPDATED] ImageId ${entry.imageId} for ${entry.productGroupCode} – ${entry.variantName}`);
      inserted++;
    }
  }

  Logger.info(`Image seeding complete — Updated: ${updated}, Inserted: ${inserted}, Skipped: ${skipped}`);
};

// ─── Run standalone ──────────────────────────────────────────────────────────
if (require.main === module) {
  (async () => {
    try {
      Logger.info('Connecting to SQL Server...');
      await getSqlPool();
      Logger.info('Starting image seed...');
      await seedImages();
      await closeSqlPool();
      process.exit(0);
    } catch (error) {
      Logger.error(`Image seeding failed: ${String(error)}`);
      process.exit(1);
    }
  })();
}
