import request from 'supertest';
import app from '../app';
import { SilverRateService } from '../services/silverrate.service';
import { RateGuardService } from '../services/rateGuard.service';

// Use the REAL admin/adminOrStaff middleware here (only `protect` is mocked, per request, to
// inject a req.user controlled via an `x-test-user` header) so this test exercises the actual
// authorization decision — regression for: staff could never clear the mandatory daily rate
// lock because the rate-update endpoints required isAdmin.
jest.mock('../middlewares/auth.middleware', () => {
  const actual = jest.requireActual('../middlewares/auth.middleware');
  return {
    ...actual,
    protect: (req: any, _res: unknown, next: () => void) => {
      const raw = req.headers['x-test-user'];
      req.user = raw ? JSON.parse(raw) : { isAdmin: true };
      next();
    },
  };
});

const rate = {
  id: 'r1',
  date: '2026-07-05',
  purity: '999',
  ratePerGram: 100,
  ratePerKg: 100000,
  createdAt: '2026-07-05T04:30:00.000Z',
};

describe('Rate endpoints — staff carve-out', () => {
  afterEach(() => jest.restoreAllMocks());

  it('allows a staff user to POST /admin/silver-rates', async () => {
    jest.spyOn(SilverRateService.prototype, 'upsertRate').mockResolvedValue(rate as never);

    const res = await request(app)
      .post('/api/v1/admin/silver-rates')
      .set('x-test-user', JSON.stringify({ isAdmin: false, role: 'staff' }))
      .send({ ratePerGram: 100, purity: 'Silver' });

    expect(res.status).toBe(201);
  });

  it('allows a staff user to GET /admin/rate-status', async () => {
    jest.spyOn(RateGuardService.prototype, 'getStatus').mockResolvedValue({
      blocked: false,
      staleMetals: [],
      checkedAt: '2026-07-05T04:30:00.000Z',
    } as never);

    const res = await request(app)
      .get('/api/v1/admin/rate-status')
      .set('x-test-user', JSON.stringify({ isAdmin: false, role: 'staff' }));

    expect(res.status).toBe(200);
  });

  it('rejects a plain customer from POST /admin/silver-rates with 403', async () => {
    const res = await request(app)
      .post('/api/v1/admin/silver-rates')
      .set('x-test-user', JSON.stringify({ isAdmin: false, role: 'customer' }))
      .send({ ratePerGram: 100, purity: 'Silver' });

    expect(res.status).toBe(403);
  });

  it('still rejects staff from an admin-only endpoint (e.g. GET /admin/users)', async () => {
    const res = await request(app)
      .get('/api/v1/admin/users')
      .set('x-test-user', JSON.stringify({ isAdmin: false, role: 'staff' }));

    expect(res.status).toBe(403);
  });
});
