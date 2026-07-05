import request from 'supertest';
import app from '../app';
import { GoldRateService } from '../services/goldrate.service';
import { RateGuardService } from '../services/rateGuard.service';

jest.mock('../middlewares/auth.middleware', () => ({
  protect: (req: any, _res: unknown, next: () => void) => {
    req.user = { _id: { toString: () => 'admin1' }, name: 'Admin User', isAdmin: true };
    next();
  },
  admin: (_req: unknown, _res: unknown, next: () => void) => next(),
  adminOrStaff: (_req: unknown, _res: unknown, next: () => void) => next(),
}));

const goldRate = {
  id: 'r1',
  date: '2026-06-16',
  rateDate: '2026-06-16',
  purity: '916',
  ratePerGram: 6500,
  ratePerKg: 6500000,
  createdAt: '2026-06-16T04:30:00.000Z',
  updatedBy: 'Admin User',
};

describe('Gold rate endpoints (#25 B1)', () => {
  afterEach(() => jest.restoreAllMocks());

  it('GET /gold-rates/today returns today rates (public)', async () => {
    jest.spyOn(GoldRateService.prototype, 'getTodayRates').mockResolvedValue([goldRate] as never);

    const res = await request(app).get('/api/v1/gold-rates/today');

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].date).toBe('2026-06-16');
    expect(res.body[0].rateDate).toBe('2026-06-16');
    expect(res.body[0].purity).toBe('916');
  });

  it('GET /gold-rates/history defaults to 30 days', async () => {
    const spy = jest
      .spyOn(GoldRateService.prototype, 'getHistory')
      .mockResolvedValue([goldRate] as never);

    const res = await request(app).get('/api/v1/gold-rates/history');

    expect(res.status).toBe(200);
    expect(spy).toHaveBeenCalledWith(30);
  });

  it('GET /admin/gold-rates returns all records', async () => {
    jest.spyOn(GoldRateService.prototype, 'getAllRates').mockResolvedValue([goldRate] as never);

    const res = await request(app)
      .get('/api/v1/admin/gold-rates')
      .set('Authorization', 'Bearer test-token');

    expect(res.status).toBe(200);
    expect(res.body[0].id).toBe('r1');
  });

  it('POST /admin/gold-rates upserts today rate and returns 201', async () => {
    const spy = jest
      .spyOn(GoldRateService.prototype, 'upsertRate')
      .mockResolvedValue(goldRate as never);

    const res = await request(app)
      .post('/api/v1/admin/gold-rates')
      .set('Authorization', 'Bearer test-token')
      .send({ ratePerGram: 6500, purity: '916' });

    expect(res.status).toBe(201);
    expect(spy).toHaveBeenCalledWith(6500, '916', 'Admin User');
    expect(res.body.ratePerKg).toBe(6500000);
  });

  it('GET /admin/rate-status returns the block flag', async () => {
    jest.spyOn(RateGuardService.prototype, 'getStatus').mockResolvedValue({
      blocked: true,
      staleMetals: ['gold'],
      checkedAt: '2026-06-16T04:30:00.000Z',
    } as never);

    const res = await request(app)
      .get('/api/v1/admin/rate-status')
      .set('Authorization', 'Bearer test-token');

    expect(res.status).toBe(200);
    expect(res.body.blocked).toBe(true);
    expect(res.body.staleMetals).toEqual(['gold']);
  });
});
