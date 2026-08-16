import { PoolClient } from 'pg';
import {
  IProduct,
  IProductCharge,
  IProductImage,
  IProductVariant,
} from '../domain/catalog';
import { query, queryOne, queryRows, withTransaction } from '../infrastructure/postgres/pool';
import { persistProductImage } from '../infrastructure/storage/productImages';
import {
  toBigIntParam,
  toBool,
  toBoolOrNull,
  toDate,
  toNum,
  toNumOrNull,
  toNullableText,
  toStrArray,
} from '../infrastructure/postgres/mapping';
import { AppError } from '../utils/appError';

export { IProduct };

/**
 * Variants and images are aggregated back into the nested arrays the API has
 * always returned, rather than exposing the join to callers (spec §14, §30).
 *
 * `imageBase64` intentionally carries the same public URL as `imageUrl` — see
 * the note on IProductImage. Nothing base64 is read from the database.
 */
const VARIANTS_JSON = `
  COALESCE(
    (
      SELECT json_agg(
        json_build_object(
          'label', pv.label,
          'weight', pv.weight,
          'height', pv.height,
          'breadth', pv.breadth
        )
        ORDER BY pv.id
      )
      FROM product_variants pv
      WHERE pv.product_id = p.id
    ),
    '[]'::json
  ) AS variants`;

const IMAGES_JSON = `
  COALESCE(
    (
      SELECT json_agg(
        json_build_object(
          'imageUrl', pi.image_url,
          'imageBase64', pi.image_url,
          'variantName', pi.variant_name,
          'sortOrder', pi.sort_order
        )
        ORDER BY pi.sort_order, pi.id
      )
      FROM product_images pi
      WHERE pi.product_id = p.id
    ),
    '[]'::json
  ) AS images`;

const PRODUCT_SELECT = `
  SELECT
    p.id, p.product_group_code, p.name, p.description, p.material, p.category,
    p.subcategory, p.tags, p.weight, p.price, p.original_price, p.purity,
    p.is_sale, p.is_featured, p.metal_value, p.making_charges,
    p.making_charge_percent, p.making_charge_per_gram, p.quantity, p.is_active,
    p.is_fixed_price, p.making_charge_type, p.making_charge_value,
    p.wastage_type, p.wastage_value, p.created_at, p.updated_at,
    ${VARIANTS_JSON},
    ${IMAGES_JSON}
  FROM products p`;

interface ProductRow {
  id: string;
  product_group_code: string;
  name: string;
  description: string | null;
  material: string | null;
  category: string;
  subcategory: string | null;
  tags: string[] | null;
  weight: number;
  price: number;
  original_price: number | null;
  purity: string | null;
  is_sale: boolean | null;
  is_featured: boolean | null;
  metal_value: number | null;
  making_charges: number | null;
  making_charge_percent: number | null;
  making_charge_per_gram: number | null;
  quantity: number;
  is_active: boolean;
  is_fixed_price: boolean | null;
  making_charge_type: string | null;
  making_charge_value: number | null;
  wastage_type: string | null;
  wastage_value: number | null;
  created_at: Date | null;
  updated_at: Date | null;
  variants: unknown;
  images: unknown;
}

/**
 * A charge is stored as a (type, value) column pair and is only meaningful when
 * both are set — matching the embedded sub-document that was `null` when unset.
 */
const mapCharge = (type: string | null, value: number | null): IProductCharge | null => {
  if (!type || value === null || value === undefined) return null;
  return { type: type === 'amount' ? 'amount' : 'percentage', value: toNum(value) };
};

const mapVariant = (raw: Record<string, unknown>): IProductVariant => {
  const variant: IProductVariant = {
    label: String(raw.label ?? ''),
    weight: String(raw.weight ?? ''),
  };
  // height/breadth are omitted rather than null when unset, matching how the
  // Mongo sub-document serialised.
  if (raw.height) variant.height = String(raw.height);
  if (raw.breadth) variant.breadth = String(raw.breadth);
  return variant;
};

const mapImage = (raw: Record<string, unknown>): IProductImage => ({
  imageUrl: String(raw.imageUrl ?? ''),
  imageBase64: String(raw.imageBase64 ?? raw.imageUrl ?? ''),
  variantName: String(raw.variantName ?? 'Default view'),
  sortOrder: toNum(raw.sortOrder),
});

const mapProduct = (row: ProductRow): IProduct => ({
  _id: String(row.id),
  productGroupCode: row.product_group_code,
  name: row.name,
  description: row.description,
  material: row.material,
  category: row.category ?? '',
  subcategory: row.subcategory,
  tags: toStrArray(row.tags),
  weight: toNum(row.weight),
  price: toNum(row.price),
  originalPrice: toNumOrNull(row.original_price),
  purity: row.purity,
  isSale: toBoolOrNull(row.is_sale),
  isFeatured: toBoolOrNull(row.is_featured),
  metalValue: toNumOrNull(row.metal_value),
  makingCharges: toNumOrNull(row.making_charges),
  makingChargePercent: toNumOrNull(row.making_charge_percent),
  makingChargePerGram: toNumOrNull(row.making_charge_per_gram),
  quantity: toNum(row.quantity),
  isActive: toBool(row.is_active, true),
  images: Array.isArray(row.images) ? (row.images as Record<string, unknown>[]).map(mapImage) : [],
  variants: Array.isArray(row.variants)
    ? (row.variants as Record<string, unknown>[]).map(mapVariant)
    : [],
  isFixedPrice: toBoolOrNull(row.is_fixed_price),
  makingCharge: mapCharge(row.making_charge_type, row.making_charge_value),
  wastage: mapCharge(row.wastage_type, row.wastage_value),
  createdAt: toDate(row.created_at),
  updatedAt: toDate(row.updated_at),
});

/** Split a comma-separated filter value into trimmed, non-empty terms. */
const splitList = (value: unknown): string[] =>
  String(value)
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);

export class ProductRepository {
  /**
   * Coerce an `images` payload into a normalised list of pending writes.
   * Accepts either bare strings (base64/URL) or the `{ variantName, imageBase64,
   * sortOrder }` objects the service produces, dropping blank/invalid entries.
   * `sortOrder` falls back to the array position when not supplied.
   */
  private toImageDocs(
    images: unknown[],
  ): Array<{ variantName: string; value: string; sortOrder: number }> {
    const docs: Array<{ variantName: string; value: string; sortOrder: number }> = [];

    images.forEach((img, i) => {
      if (typeof img === 'string') {
        const value = img.trim();
        if (value) docs.push({ variantName: 'Default view', value, sortOrder: i });
        return;
      }

      if (img && typeof img === 'object') {
        const raw = img as Record<string, unknown>;
        const source = raw.imageBase64 ?? raw.imageUrl;
        if (typeof source !== 'string') return;
        const value = source.trim();
        if (!value) return;

        docs.push({
          variantName: String(raw.variantName || 'Default view'),
          value,
          sortOrder: raw.sortOrder !== undefined ? Number(raw.sortOrder) : i,
        });
      }
    });

    return docs;
  }

  /**
   * Write a product's gallery, replacing whatever was there.
   *
   * Base64 payloads become WebP files on disk; only the resulting URL is
   * stored. Existing URLs pass through untouched, so re-saving a product that
   * echoes back its current gallery does not rewrite any file.
   */
  private async replaceImages(
    client: PoolClient,
    productId: string,
    images: unknown[],
  ): Promise<void> {
    const docs = this.toImageDocs(images);

    const persisted: Array<{ variantName: string; url: string; sortOrder: number }> = [];
    for (const [index, doc] of docs.entries()) {
      // Sequential on purpose: sharp is CPU-bound, and a gallery is a handful
      // of images uploaded by one admin, not a hot path.
      // eslint-disable-next-line no-await-in-loop
      const url = await persistProductImage(productId, index, doc.value);
      if (url) persisted.push({ variantName: doc.variantName, url, sortOrder: doc.sortOrder });
    }

    await client.query('DELETE FROM product_images WHERE product_id = $1', [productId]);

    for (const image of persisted) {
      // eslint-disable-next-line no-await-in-loop
      await client.query(
        `INSERT INTO product_images (product_id, variant_name, image_url, sort_order)
         VALUES ($1, $2, $3, $4)`,
        [productId, image.variantName, image.url, image.sortOrder],
      );
    }
  }

  /** Write a product's variants, replacing whatever was there. */
  private async replaceVariants(
    client: PoolClient,
    productId: string,
    variants: unknown,
  ): Promise<void> {
    await client.query('DELETE FROM product_variants WHERE product_id = $1', [productId]);
    if (!Array.isArray(variants)) return;

    for (const entry of variants) {
      if (!entry || typeof entry !== 'object') continue;
      const raw = entry as Record<string, unknown>;
      const label = String(raw.label ?? '').trim();
      const weight = String(raw.weight ?? '').trim();
      if (!label || !weight) continue;

      // eslint-disable-next-line no-await-in-loop
      await client.query(
        `INSERT INTO product_variants (product_id, label, weight, height, breadth)
         VALUES ($1, $2, $3, $4, $5)`,
        [productId, label, weight, toNullableText(raw.height), toNullableText(raw.breadth)],
      );
    }
  }

  public async create(data: any): Promise<IProduct> {
    const productGroupCode = String(data.productGroupCode || data.productGroup || '')
      .trim()
      .toUpperCase();
    const name = String(data.itemName || data.name || '').trim();

    if (!productGroupCode || !name) {
      throw new AppError('productGroupCode and name are required', 400);
    }

    const image = data.imageBase64 || data.image || data.imageUrl || '';
    const variantName = String(data.variantName || data.variant || 'Default view').trim();

    const productId = await withTransaction(async (client) => {
      // Lock the group code so two concurrent creates cannot both miss the
      // existing row and race into the unique constraint.
      const existing = await client.query<{ id: string; images: number }>(
        `SELECT p.id, (SELECT count(*)::int FROM product_images pi WHERE pi.product_id = p.id) AS images
         FROM products p WHERE p.product_group_code = $1 FOR UPDATE`,
        [productGroupCode],
      );

      if (existing.rowCount) {
        const id = String(existing.rows[0].id);

        // Same partial-update semantics the Mongoose branch had: only fields
        // present on the payload are touched.
        const assignments: string[] = [];
        const values: unknown[] = [];
        const push = (column: string, value: unknown): void => {
          values.push(value);
          assignments.push(`${column} = $${values.length}`);
        };

        push('name', name);
        if (data.material !== undefined || data.category !== undefined) {
          push('material', String(data.material || data.category || '').trim());
        }
        if (data.weight !== undefined) push('weight', Number(data.weight));
        if (data.price !== undefined) push('price', Number(data.price));
        if (data.quantity !== undefined) push('quantity', Number(data.quantity));
        if (data.isFixedPrice !== undefined) push('is_fixed_price', Boolean(data.isFixedPrice));
        if (data.makingCharge !== undefined) {
          push('making_charge_type', data.makingCharge?.type ?? null);
          push('making_charge_value', data.makingCharge?.value ?? null);
        }
        if (data.wastage !== undefined) {
          push('wastage_type', data.wastage?.type ?? null);
          push('wastage_value', data.wastage?.value ?? null);
        }

        values.push(id);
        await client.query(
          `UPDATE products SET ${assignments.join(', ')}, updated_at = NOW() WHERE id = $${values.length}`,
          values,
        );

        if (data.variants !== undefined) await this.replaceVariants(client, id, data.variants);

        if (data.images !== undefined && Array.isArray(data.images)) {
          // Full replace of the gallery (images[0] = primary).
          await this.replaceImages(client, id, data.images);
        } else if (image) {
          // Append a single image, preserving the legacy single-field path.
          const sortOrder = Number(data.sortOrder || Number(existing.rows[0].images) + 1);
          const url = await persistProductImage(id, sortOrder, image);
          if (url) {
            await client.query(
              `INSERT INTO product_images (product_id, variant_name, image_url, sort_order)
               VALUES ($1, $2, $3, $4)`,
              [id, variantName, url, sortOrder],
            );
          }
        }

        return id;
      }

      const inserted = await client.query<{ id: string }>(
        `INSERT INTO products (
           product_group_code, name, description, material, category, subcategory, tags,
           weight, price, quantity, original_price, purity, is_sale, is_featured,
           metal_value, making_charges, making_charge_percent, making_charge_per_gram,
           is_active, is_fixed_price, making_charge_type, making_charge_value,
           wastage_type, wastage_value
         )
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24)
         RETURNING id`,
        [
          productGroupCode,
          name,
          data.description ?? null,
          String(data.material || data.category || 'Silver').trim(),
          String(data.category ?? '').trim(),
          toNullableText(data.subcategory),
          Array.isArray(data.tags) ? data.tags.map(String) : [],
          Number(data.weight ?? 0),
          Number(data.price || 0),
          Number(data.quantity ?? 1),
          data.originalPrice !== undefined ? Number(data.originalPrice) : null,
          data.purity ?? null,
          Boolean(data.isSale || false),
          Boolean(data.isFeatured || false),
          data.metalValue !== undefined ? Number(data.metalValue) : null,
          data.makingCharges !== undefined ? Number(data.makingCharges) : null,
          data.makingChargePercent !== undefined ? Number(data.makingChargePercent) : null,
          data.makingChargePerGram !== undefined ? Number(data.makingChargePerGram) : null,
          data.isActive === undefined ? true : Boolean(data.isActive),
          Boolean(data.isFixedPrice || false),
          data.makingCharge?.type ?? null,
          data.makingCharge?.value ?? null,
          data.wastage?.type ?? null,
          data.wastage?.value ?? null,
        ],
      );

      const id = String(inserted.rows[0].id);

      await this.replaceVariants(client, id, Array.isArray(data.variants) ? data.variants : []);

      if (Array.isArray(data.images)) {
        await this.replaceImages(client, id, data.images);
      } else if (image) {
        await this.replaceImages(client, id, [
          { variantName, imageBase64: image, sortOrder: Number(data.sortOrder || 1) },
        ]);
      }

      return id;
    });

    const created = await this.findById(productId);
    if (!created) throw new Error('Product insert succeeded but the row could not be read back.');
    return created;
  }

  /** Distinct category/subcategory combinations actually in use, for building the category tree. */
  public async getCategoryUsage(): Promise<Array<{ category: string; subcategory?: string }>> {
    const rows = await queryRows<{ category: string; subcategory: string | null }>(
      `SELECT DISTINCT category, subcategory
       FROM products
       WHERE is_active = TRUE AND category IS NOT NULL AND category <> ''`,
    );

    return rows.map((row) => ({
      category: row.category,
      subcategory: row.subcategory || undefined,
    }));
  }

  public async getTags(): Promise<string[]> {
    const rows = await queryRows<{ tag: string }>(
      `SELECT DISTINCT unnest(tags) AS tag
       FROM products
       WHERE is_active = TRUE`,
    );

    return rows
      .map((row) => row.tag)
      .filter(Boolean)
      .sort();
  }

  public async findAll(filters: any = {}): Promise<IProduct[]> {
    const conditions: string[] = ['p.is_active = TRUE'];
    const values: unknown[] = [];

    const bind = (value: unknown): string => {
      values.push(value);
      return `$${values.length}`;
    };

    if (filters.category) {
      conditions.push(`p.category = ANY(${bind(splitList(filters.category))})`);
    }

    if (filters.subcategory) {
      conditions.push(`p.subcategory = ANY(${bind(splitList(filters.subcategory))})`);
    }

    if (filters.tags) {
      const tags = splitList(filters.tags);
      // `&&` is array overlap — the direct equivalent of Mongo's `$in` against
      // an array field, and it uses the GIN index on tags.
      if (tags.length) conditions.push(`p.tags && ${bind(tags)}`);
    }

    if (filters.metal) {
      const metals = splitList(filters.metal);
      // Matches `purity` case-insensitively and exactly, as the anchored
      // case-insensitive regex did.
      if (metals.length) conditions.push(`lower(p.purity) = ANY(${bind(metals.map((m) => m.toLowerCase()))})`);
    }

    if (filters.minPrice !== undefined) {
      conditions.push(`p.price >= ${bind(Number(filters.minPrice))}`);
    }

    if (filters.maxPrice !== undefined) {
      conditions.push(`p.price <= ${bind(Number(filters.maxPrice))}`);
    }

    if (filters.search) {
      // Mongo used a $text index over name/description/material/category/tags.
      // A case-insensitive substring match over the same fields is the closest
      // faithful equivalent without introducing a tsvector column, and it is
      // strictly more forgiving (it also matches partial words).
      const term = bind(`%${String(filters.search).trim()}%`);
      conditions.push(`(
        p.name ILIKE ${term}
        OR p.description ILIKE ${term}
        OR p.material ILIKE ${term}
        OR p.category ILIKE ${term}
        OR EXISTS (SELECT 1 FROM unnest(p.tags) AS t WHERE t ILIKE ${term})
      )`);
    }

    if (filters.onSale === true || filters.onSale === 'true') {
      conditions.push('(p.is_sale = TRUE OR p.original_price IS NOT NULL)');
    }

    if (filters.featured === true || filters.featured === 'true') {
      conditions.push('p.is_featured = TRUE');
    }

    let orderBy = 'p.product_group_code ASC';
    if (filters.sortBy === 'price_asc') orderBy = 'p.price ASC';
    else if (filters.sortBy === 'price_desc') orderBy = 'p.price DESC';
    else if (filters.sortBy === 'newest') orderBy = 'p.created_at DESC';

    // A stable tiebreaker — without one, equal sort keys can reorder between
    // pages and an infinite-scroll client would see duplicates or gaps.
    const sql = [
      PRODUCT_SELECT,
      `WHERE ${conditions.join(' AND ')}`,
      `ORDER BY ${orderBy}, p.id ASC`,
    ];

    // Optional pagination (infinite scroll). Filters/sort apply BEFORE paging, so
    // each page is a slice of the already filtered+sorted result set. When `limit`
    // is absent or invalid we return the full set (backward-compatible).
    const { skip, limit } = this.parsePagination(filters);
    if (limit !== undefined) {
      sql.push(`LIMIT ${bind(limit)} OFFSET ${bind(skip)}`);
    }

    const rows = await queryRows<ProductRow>(sql.join('\n'), values);
    return rows.map(mapProduct);
  }

  /**
   * Parse `page`/`limit` query params into a SQL offset/limit. `page` is 1-indexed
   * (defaults to 1); `limit` is the page size, capped at MAX_PAGE_SIZE to bound the
   * payload. Returns `limit: undefined` (⇒ no pagination) when `limit` is missing or
   * not a positive integer, preserving the legacy "return everything" behaviour.
   */
  private parsePagination(filters: any): { skip: number; limit: number | undefined } {
    const MAX_PAGE_SIZE = 100;
    const rawLimit = Number(filters?.limit);
    if (!Number.isInteger(rawLimit) || rawLimit <= 0) {
      return { skip: 0, limit: undefined };
    }
    const limit = Math.min(rawLimit, MAX_PAGE_SIZE);

    const rawPage = Number(filters?.page);
    const page = Number.isInteger(rawPage) && rawPage >= 1 ? rawPage : 1;

    return { skip: (page - 1) * limit, limit };
  }

  public async findById(id: string): Promise<IProduct | null> {
    const productId = toBigIntParam(id);
    if (!productId) return null;

    const row = await queryOne<ProductRow>(`${PRODUCT_SELECT} WHERE p.id = $1`, [productId]);
    return row ? mapProduct(row) : null;
  }

  public async update(id: string, data: any): Promise<IProduct | null> {
    const productId = toBigIntParam(id);
    if (!productId) return null;

    const updated = await withTransaction(async (client) => {
      const existing = await client.query('SELECT id FROM products WHERE id = $1 FOR UPDATE', [
        productId,
      ]);
      if (!existing.rowCount) return false;

      const assignments: string[] = [];
      const values: unknown[] = [];
      const push = (column: string, value: unknown): void => {
        values.push(value);
        assignments.push(`${column} = $${values.length}`);
      };

      if (data.name !== undefined || data.itemName !== undefined) {
        push('name', String(data.name ?? data.itemName));
      }
      if (data.material !== undefined) push('material', String(data.material));
      if (data.category !== undefined) push('category', String(data.category));
      if (data.subcategory !== undefined) push('subcategory', toNullableText(data.subcategory));
      if (data.tags !== undefined) push('tags', Array.isArray(data.tags) ? data.tags.map(String) : []);
      if (data.weight !== undefined || data.weightGm !== undefined) {
        push('weight', Number(data.weight ?? data.weightGm));
      }
      if (data.price !== undefined) push('price', Number(data.price));
      if (data.quantity !== undefined) push('quantity', Number(data.quantity));
      if (data.description !== undefined) push('description', data.description);
      if (data.originalPrice !== undefined) push('original_price', Number(data.originalPrice));
      if (data.purity !== undefined) push('purity', String(data.purity));
      if (data.isSale !== undefined) push('is_sale', Boolean(data.isSale));
      if (data.isFeatured !== undefined) push('is_featured', Boolean(data.isFeatured));
      if (data.metalValue !== undefined) push('metal_value', Number(data.metalValue));
      if (data.makingCharges !== undefined) push('making_charges', Number(data.makingCharges));
      if (data.makingChargePercent !== undefined) {
        push('making_charge_percent', Number(data.makingChargePercent));
      }
      if (data.makingChargePerGram !== undefined) {
        push('making_charge_per_gram', Number(data.makingChargePerGram));
      }
      if (data.isActive !== undefined) push('is_active', Boolean(data.isActive));
      if (data.isFixedPrice !== undefined) push('is_fixed_price', Boolean(data.isFixedPrice));
      if (data.makingCharge !== undefined) {
        push('making_charge_type', data.makingCharge?.type ?? null);
        push('making_charge_value', data.makingCharge?.value ?? null);
      }
      if (data.wastage !== undefined) {
        push('wastage_type', data.wastage?.type ?? null);
        push('wastage_value', data.wastage?.value ?? null);
      }

      if (assignments.length) {
        values.push(productId);
        await client.query(
          `UPDATE products SET ${assignments.join(', ')}, updated_at = NOW() WHERE id = $${values.length}`,
          values,
        );
      }

      // Full replace of the variants array. An empty array clears all variants.
      if (data.variants !== undefined) {
        await this.replaceVariants(client, productId, data.variants);
      }

      // Full replace of the gallery. An empty array clears all images.
      if (data.images !== undefined) {
        await this.replaceImages(client, productId, Array.isArray(data.images) ? data.images : []);
      }

      return true;
    });

    if (!updated) return null;
    return this.findById(id);
  }

  public async delete(id: string): Promise<IProduct | null> {
    const productId = toBigIntParam(id);
    if (!productId) return null;

    // Read the product before deleting — callers return the deleted document.
    const existing = await this.findById(productId);
    if (!existing) return null;

    await withTransaction(async (client) => {
      // Children have no ON DELETE CASCADE, so they are removed explicitly.
      await client.query('DELETE FROM product_images WHERE product_id = $1', [productId]);
      await client.query('DELETE FROM product_variants WHERE product_id = $1', [productId]);
      await client.query('DELETE FROM inventory WHERE product_id = $1', [productId]);
      await client.query('DELETE FROM products WHERE id = $1', [productId]);
    });

    return existing;
  }

  /**
   * The storefront's "featured" strip.
   *
   * Deliberately unchanged from the Mongo implementation: it returns the ten
   * most recently created active products and does NOT filter on `is_featured`.
   * That is pre-existing behaviour the storefront depends on, so it is
   * preserved rather than corrected here (spec §45).
   */
  public async findFeatured(): Promise<IProduct[]> {
    const rows = await queryRows<ProductRow>(
      `${PRODUCT_SELECT}
       WHERE p.is_active = TRUE
       ORDER BY p.created_at DESC, p.id DESC
       LIMIT 10`,
    );
    return rows.map(mapProduct);
  }

  public async count(): Promise<number> {
    const row = await queryOne<{ count: number }>(
      'SELECT count(*)::int AS count FROM products WHERE is_active = TRUE',
    );
    return toNum(row?.count);
  }
}
