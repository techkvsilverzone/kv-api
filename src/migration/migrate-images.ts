import 'dotenv/config';
import crypto from 'crypto';
import fs from 'fs/promises';
import path from 'path';
import sharp from 'sharp';
import { Pool, PoolClient } from 'pg';
import mongoose from 'mongoose';

import { connectMongo, disconnectMongo } from '../utils/db';
import { Product } from '../models/product.model';

const POSTGRES_URL = process.env.POSTGRES_MIGRATION_URL;

if (!POSTGRES_URL) {
  throw new Error(
    'POSTGRES_MIGRATION_URL is not set. Refusing to run image migration.',
  );
}

const IMAGE_ROOT =
  process.env.IMAGE_STORAGE_ROOT || '/opt/kvs/storage/products';

const IMAGE_PUBLIC_BASE =
  process.env.IMAGE_PUBLIC_BASE || '/images/products';

const MAX_WIDTH = 1600;
const MAX_HEIGHT = 1600;
const WEBP_QUALITY = 82;

const DRY_RUN = process.argv.includes('--dry-run');

const pool = new Pool({
  connectionString: POSTGRES_URL,
});

function generateLegacyImageId(
  productMongoId: string,
  imageIndex: number,
  sortOrder: number,
): string {
  return crypto
    .createHash('sha256')
    .update(`${productMongoId}:${imageIndex}:${sortOrder}`)
    .digest('hex')
    .slice(0, 24);
}

function parseBase64Image(value: string): {
  buffer: Buffer;
  mimeType: string;
} {
  if (!value) {
    throw new Error('Empty imageBase64');
  }

  const match = value.match(
    /^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/s,
  );

  if (!match) {
    throw new Error(
      'Image is not a valid data URI in the expected format',
    );
  }

  const mimeType = match[1];
  const base64Data = match[2];

  const buffer = Buffer.from(base64Data, 'base64');

  if (!buffer.length) {
    throw new Error('Decoded image buffer is empty');
  }

  return {
    buffer,
    mimeType,
  };
}

function extensionFromMime(mimeType: string): string {
  switch (mimeType.toLowerCase()) {
    case 'image/jpeg':
      return 'jpg';

    case 'image/png':
      return 'png';

    case 'image/webp':
      return 'webp';

    case 'image/gif':
      return 'gif';

    case 'image/bmp':
      return 'bmp';

    case 'image/tiff':
      return 'tiff';

    default:
      return 'unknown';
  }
}

async function ensureDirectory(directory: string): Promise<void> {
  await fs.mkdir(directory, {
    recursive: true,
  });
}

async function migrateImage(
  client: PoolClient | null,
  product: any,
  image: any,
  imageIndex: number,
): Promise<{
  status: 'migrated' | 'skipped' | 'invalid';
  originalBytes?: number;
  outputBytes?: number;
}> {
  const productMongoId = String(product._id);
  const sortOrder = Number(image.sortOrder ?? imageIndex + 1);
  const variantName = String(image.variantName ?? 'Default');

  const legacyMongoId = generateLegacyImageId(
    productMongoId,
    imageIndex,
    sortOrder,
  );

  const existing = client
    ? await client.query(
        `
        SELECT id, image_url
        FROM product_images
        WHERE legacy_mongo_id = $1
        `,
        [legacyMongoId],
      )
    : null;

  if (existing && existing.rowCount && existing.rowCount > 0) {
    return {
      status: 'skipped',
    };
  }

  const parsed = parseBase64Image(image.imageBase64);

  const sourceExtension = extensionFromMime(parsed.mimeType);

  const outputDirectory = path.join(
    IMAGE_ROOT,
    productMongoId,
  );

  const fileName = `${String(sortOrder).padStart(3, '0')}.webp`;

  const outputPath = path.join(
    outputDirectory,
    fileName,
  );

  const publicUrl = `${IMAGE_PUBLIC_BASE}/${productMongoId}/${fileName}`;

  const result = await sharp(parsed.buffer)
    .rotate()
    .resize({
      width: MAX_WIDTH,
      height: MAX_HEIGHT,
      fit: 'inside',
      withoutEnlargement: true,
    })
    .webp({
      quality: WEBP_QUALITY,
    })
    .toBuffer({
      resolveWithObject: true,
    });

  if (!DRY_RUN) {
    await ensureDirectory(outputDirectory);

    await fs.writeFile(outputPath, result.data);

    if (!client) {
      throw new Error('PostgreSQL client is required for real migration');
    }

    const productResult = await client.query(
      `
      SELECT id
      FROM products
      WHERE legacy_mongo_id = $1
      `,
      [productMongoId],
    );

    if (productResult.rowCount !== 1) {
      throw new Error(
        `PostgreSQL product not found for MongoDB ID ${productMongoId}`,
      );
    }

    const productId = productResult.rows[0].id;

    await client.query(
      `
      INSERT INTO product_images
      (
        legacy_mongo_id,
        product_id,
        variant_name,
        image_url,
        sort_order,
        created_at,
        updated_at
      )
      VALUES ($1,$2,$3,$4,$5,NOW(),NOW())
      ON CONFLICT (legacy_mongo_id) DO UPDATE SET
        product_id = EXCLUDED.product_id,
        variant_name = EXCLUDED.variant_name,
        image_url = EXCLUDED.image_url,
        sort_order = EXCLUDED.sort_order,
        updated_at = NOW()
      `,
      [
        legacyMongoId,
        productId,
        variantName,
        publicUrl,
        sortOrder,
      ],
    );
  }

  console.log(
    `  ${DRY_RUN ? 'WOULD MIGRATE' : 'MIGRATED'} ` +
      `${product.name} | ` +
      `${variantName} | ` +
      `${sourceExtension} | ` +
      `${Math.round(parsed.buffer.length / 1024)} KB -> ` +
      `${Math.round(result.data.length / 1024)} KB | ` +
      `${result.info.width}x${result.info.height}`,
  );

  return {
    status: 'migrated',
    originalBytes: parsed.buffer.length,
    outputBytes: result.data.length,
  };
}

async function main(): Promise<void> {
  console.log('==============================================');
  console.log('KVS PRODUCT IMAGE MIGRATION');
  console.log('==============================================');

  console.log(`Mode: ${DRY_RUN ? 'DRY RUN' : 'REAL MIGRATION'}`);
  console.log(`Image root: ${IMAGE_ROOT}`);
  console.log(`Public base: ${IMAGE_PUBLIC_BASE}`);
  console.log(`Max dimensions: ${MAX_WIDTH}x${MAX_HEIGHT}`);
  console.log(`WebP quality: ${WEBP_QUALITY}`);

  if (DRY_RUN) {
    console.log('PostgreSQL writes: DISABLED');
    console.log('Filesystem writes: DISABLED');
  }

  console.log('');

  try {
    await connectMongo();

    const products = await Product.find({
      'images.0': { $exists: true },
    }).lean();

    console.log(`Products with images: ${products.length}`);

    let totalImages = 0;
    let validImages = 0;
    let invalidImages = 0;
    let skippedImages = 0;
    let totalOriginalBytes = 0;
    let totalOutputBytes = 0;

    const client = DRY_RUN
      ? null
      : await pool.connect();

    try {
      if (client) {
        await client.query('BEGIN');
      }

      for (const product of products) {
        const images = product.images ?? [];

        console.log('');
        console.log(
          `${product.name} (${String(product._id)}) — ${images.length} images`,
        );

        for (let index = 0; index < images.length; index++) {
          totalImages++;

          try {
            const result = await migrateImage(
              client,
              product,
              images[index],
              index,
            );

            if (result.status === 'skipped') {
              skippedImages++;
              console.log(
                `  SKIPPED ${product.name} | image ${index + 1} | already migrated`,
              );
              continue;
            }

            validImages++;

            totalOriginalBytes += result.originalBytes ?? 0;
            totalOutputBytes += result.outputBytes ?? 0;
          } catch (error) {
            invalidImages++;

            console.error(
              `  FAILED ${product.name} | image ${index + 1}`,
            );

            console.error(
              error instanceof Error
                ? error.message
                : error,
            );

            if (client) {
              throw error;
            }
          }
        }
      }

      if (client) {
        await client.query('COMMIT');
      }
    } catch (error) {
      if (client) {
        await client.query('ROLLBACK');
      }

      throw error;
    } finally {
      client?.release();
    }

    console.log('');
    console.log('==============================================');
    console.log('IMAGE MIGRATION SUMMARY');
    console.log('==============================================');

    console.log(`Products with images: ${products.length}`);
    console.log(`Images discovered: ${totalImages}`);
    console.log(`Images processed: ${validImages}`);
    console.log(`Images skipped: ${skippedImages}`);
    console.log(`Images failed: ${invalidImages}`);

    if (totalOriginalBytes > 0) {
      console.log(
        `Original size: ${(totalOriginalBytes / 1024 / 1024).toFixed(2)} MB`,
      );

      console.log(
        `WebP size: ${(totalOutputBytes / 1024 / 1024).toFixed(2)} MB`,
      );

      console.log(
        `Reduction: ${(
          (1 - totalOutputBytes / totalOriginalBytes) *
          100
        ).toFixed(1)}%`,
      );
    }

    console.log('');

    if (DRY_RUN) {
      console.log(
        'DRY RUN COMPLETE — no files or PostgreSQL rows were written.',
      );
    } else {
      console.log(
        'IMAGE MIGRATION COMPLETE',
      );
    }
  } finally {
    await disconnectMongo();
    await pool.end();
  }
}

main().catch(error => {
  console.error('');
  console.error('IMAGE MIGRATION FAILED');
  console.error(error);

  process.exitCode = 1;
});