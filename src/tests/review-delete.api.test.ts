import request from 'supertest';
import app from '../app';
import { ReviewService } from '../services/review.service';
import { AppError } from '../utils/appError';

const PRODUCT_ID = '507f1f77bcf86cd799439011';
const REVIEW_ID  = '507f1f77bcf86cd799439022';

jest.mock('../middlewares/auth.middleware', () => ({
  protect: (req: any, _res: unknown, next: () => void) => {
    // Role is overwritten per test via req.__mockUser
    req.user = req.__mockUser ?? {
      _id: { toString: () => 'user123' },
      name: 'Regular User',
      isAdmin: false,
    };
    next();
  },
  admin: (_req: unknown, _res: unknown, next: () => void) => next(),
}));

describe('DELETE /products/:id/reviews/:reviewId', () => {
  afterEach(() => jest.restoreAllMocks());

  it('allows review owner to delete their own review → 204', async () => {
    jest.spyOn(ReviewService.prototype, 'deleteReview').mockResolvedValue(undefined);

    const response = await request(app)
      .delete(`/api/v1/products/${PRODUCT_ID}/reviews/${REVIEW_ID}`)
      .set('Authorization', 'Bearer user-token');

    expect(response.status).toBe(204);
  });

  it('allows admin to delete any review → 204', async () => {
    jest.spyOn(ReviewService.prototype, 'deleteReview').mockResolvedValue(undefined);

    const response = await request(app)
      .delete(`/api/v1/products/${PRODUCT_ID}/reviews/${REVIEW_ID}`)
      .set('Authorization', 'Bearer admin-token');

    expect(response.status).toBe(204);
  });

  it('returns 403 if service throws 403 (non-owner, non-admin)', async () => {
    jest
      .spyOn(ReviewService.prototype, 'deleteReview')
      .mockRejectedValue(new AppError('Not authorized to delete this review', 403));

    const response = await request(app)
      .delete(`/api/v1/products/${PRODUCT_ID}/reviews/${REVIEW_ID}`)
      .set('Authorization', 'Bearer other-user-token');

    expect(response.status).toBe(403);
    expect(response.body.message).toBe('Not authorized to delete this review');
  });

  it('returns 404 when review does not exist', async () => {
    jest
      .spyOn(ReviewService.prototype, 'deleteReview')
      .mockRejectedValue(new AppError('Review not found', 404));

    const response = await request(app)
      .delete(`/api/v1/products/${PRODUCT_ID}/reviews/${REVIEW_ID}`)
      .set('Authorization', 'Bearer user-token');

    expect(response.status).toBe(404);
    expect(response.body.message).toBe('Review not found');
  });
});
