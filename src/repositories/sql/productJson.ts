/**
 * A product rendered as JSON inside another query.
 *
 * Cart and wishlist reads used to `populate()` their product reference, so
 * callers receive a whole product object rather than a bare id. This builds the
 * equivalent projection so those repositories can keep returning the same shape
 * from a single round trip instead of an N+1 of product lookups.
 *
 * Keys are camelCase to match the mapped product domain object, and money
 * columns are cast to float8 so they arrive as JSON numbers — inside
 * `json_build_object` a numeric would otherwise serialise as a string,
 * bypassing the pool's NUMERIC type parser.
 */
export const productJson = (alias: string): string => `
  json_build_object(
    '_id', ${alias}.id::text,
    'productGroupCode', ${alias}.product_group_code,
    'name', ${alias}.name,
    'description', ${alias}.description,
    'material', ${alias}.material,
    'category', ${alias}.category,
    'subcategory', ${alias}.subcategory,
    'tags', ${alias}.tags,
    'weight', ${alias}.weight::float8,
    'price', ${alias}.price::float8,
    'originalPrice', ${alias}.original_price::float8,
    'purity', ${alias}.purity,
    'isSale', ${alias}.is_sale,
    'isFeatured', ${alias}.is_featured,
    'quantity', ${alias}.quantity,
    'isActive', ${alias}.is_active,
    'isFixedPrice', ${alias}.is_fixed_price,
    'createdAt', ${alias}.created_at,
    'updatedAt', ${alias}.updated_at,
    'images', COALESCE(
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
        WHERE pi.product_id = ${alias}.id
      ),
      '[]'::json
    ),
    'variants', COALESCE(
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
        WHERE pv.product_id = ${alias}.id
      ),
      '[]'::json
    )
  )`;
