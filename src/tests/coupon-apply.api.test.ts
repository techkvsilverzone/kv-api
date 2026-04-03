import request from 'supertest';
import app from '../app';
import { CouponService } from '../services/coupon.service';
import { AppError } from '../utils/appError';

jest.mock('../middlewares/auth.middleware', () => ({
  protect: (_req: unknown, _res: unknown, next: () => void) => next(),
  admin: (_req: unknown, _res: unknown, next: () => void) => next(),
}));

describe('POST /coupons/apply coupon validation', () => {
  afterEach(() => jest.restoreAllMocks());

  it('returns 200 with valid coupon applied', async () => {
    jest.spyOn(CouponService.prototype, 'applyCoupon').mockResolvedValue({
      valid: true,
      discount: 100,
      message: 'Coupon applied! You save ₹100',
    } as never);

    const response = await request(app)
      .post('/api/v1/coupons/apply')
      .send({ code: 'SAVE10', orderAmount: 1000 });

    expect(response.status).toBe(200);
    expect(response.body.valid).toBe(true);
    expect(response.body.discount).toBe(100);
  });

  it('returns 400 for invalid coupon code', async () => {
    jest
      .spyOn(CouponService.prototype, 'applyCoupon')
      .mockRejectedValue(new AppError('Coupon code is invalid', 400));

    const response = await request(app)
      .post('/api/v1/coupons/apply')
      .send({ code: 'INVALID99', orderAmount: 1000 });

    expect(response.status).toBe(400);
    expect(response.body.message).toBe('Coupon code is invalid');
  });

  it('returns 400 for expired coupon', async () => {
    jest
      .spyOn(CouponService.prototype, 'applyCoupon')
      .mockRejectedValue(new AppError('Coupon has expired', 400));

    const response = await request(app)
      .post('/api/v1/coupons/apply')
      .send({ code: 'EXPIRED', orderAmount: 1000 });

    expect(response.status).toBe(400);
    expect(response.body.message).toBe('Coupon has expired');
  });

  it('returns 400 for order amount below minimum', async () => {
    jest
      .spyOn(CouponService.prototype, 'applyCoupon')
      .mockRejectedValue(new AppError('Minimum order amount of ₹500 required', 400));

    const response = await request(app)
      .post('/api/v1/coupons/apply')
      .send({ code: 'SAVE50', orderAmount: 100 });

    expect(response.status).toBe(400);
    expect(response.body.message).toContain('Minimum order amount');
  });

  it('does NOT return 200 for invalid coupon code (no silent failure)', async () => {
    jest
      .spyOn(CouponService.prototype, 'applyCoupon')
      .mockRejectedValue(new AppError('Coupon code is invalid', 400));

    const response = await request(app)
      .post('/api/v1/coupons/apply')
      .send({ code: 'WRONG', orderAmount: 1000 });

    expect(response.status).not.toBe(200);
  });
});
