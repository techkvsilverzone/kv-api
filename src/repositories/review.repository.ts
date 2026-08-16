import { query, queryOne, queryRows } from '../infrastructure/postgres/pool';
import { toBigIntParam, toDate, toNum } from '../infrastructure/postgres/mapping';

export interface IReview {
  _id: string;
  productId: string;
  userId: string;
  userName?: string;
  rating: number;
  title?: string;
  comment?: string;
  createdAt: Date;
}

interface ReviewRow {
  id: string;
  product_id: string;
  user_id: string;
  user_name: string | null;
  rating: number;
  comment: string | null;
  created_at: Date | null;
}

/** The JOIN onto users replaces `populate('userId', 'name')`. */
const REVIEW_SELECT = `
  SELECT r.id, r.product_id, r.user_id, u.name AS user_name, r.rating, r.comment, r.created_at
  FROM reviews r
  LEFT JOIN users u ON u.id = r.user_id`;

const mapReview = (row: ReviewRow): IReview => ({
  _id: String(row.id),
  productId: String(row.product_id),
  userId: String(row.user_id),
  userName: row.user_name ?? undefined,
  rating: toNum(row.rating),
  comment: row.comment ?? undefined,
  createdAt: toDate(row.created_at) ?? new Date(0),
});

export class ReviewRepository {
  public async findByProductId(productId: string): Promise<IReview[]> {
    const id = toBigIntParam(productId);
    if (!id) return [];

    const rows = await queryRows<ReviewRow>(
      `${REVIEW_SELECT} WHERE r.product_id = $1 ORDER BY r.created_at DESC, r.id DESC`,
      [id],
    );
    return rows.map(mapReview);
  }

  public async create(data: Partial<IReview>): Promise<IReview> {
    const productId = toBigIntParam(data.productId);
    const userId = toBigIntParam(data.userId);
    if (!productId) throw new Error(`Invalid product id: ${data.productId}`);
    if (!userId) throw new Error(`Invalid user id: ${data.userId}`);

    const inserted = await queryOne<{ id: string }>(
      `INSERT INTO reviews (product_id, user_id, rating, comment)
       VALUES ($1, $2, $3, $4)
       RETURNING id`,
      [productId, userId, Number(data.rating || 5), data.comment ?? null],
    );

    // Read back through the JOIN so the response carries userName, exactly as
    // the post-save `populate` did.
    const row = await queryOne<ReviewRow>(`${REVIEW_SELECT} WHERE r.id = $1`, [
      String(inserted!.id),
    ]);
    return mapReview(row!);
  }

  public async deleteById(reviewId: string): Promise<boolean> {
    const id = toBigIntParam(reviewId);
    if (!id) return false;

    const result = await query('DELETE FROM reviews WHERE id = $1', [id]);
    return (result.rowCount ?? 0) > 0;
  }

  public async findById(reviewId: string): Promise<{ userId: string } | null> {
    const id = toBigIntParam(reviewId);
    if (!id) return null;

    const row = await queryOne<{ user_id: string }>('SELECT user_id FROM reviews WHERE id = $1', [
      id,
    ]);
    return row ? { userId: String(row.user_id) } : null;
  }

  public async getAverageRating(
    productId: string,
  ): Promise<{ averageRating: number; totalReviews: number }> {
    const id = toBigIntParam(productId);
    if (!id) return { averageRating: 0, totalReviews: 0 };

    const row = await queryOne<{ average_rating: number | null; total_reviews: number }>(
      `SELECT AVG(rating)::float8 AS average_rating, count(*)::int AS total_reviews
       FROM reviews WHERE product_id = $1`,
      [id],
    );

    return {
      // Rounded to one decimal, matching the previous `toFixed(1)`.
      averageRating: row?.average_rating ? Number(Number(row.average_rating).toFixed(1)) : 0,
      totalReviews: toNum(row?.total_reviews),
    };
  }
}
