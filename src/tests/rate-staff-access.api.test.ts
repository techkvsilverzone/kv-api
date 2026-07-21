import request from 'supertest';
import app from '../app';
import { SilverRateService } from '../services/silverrate.service';
import { RateGuardService } from '../services/rateGuard.service';
import { OrderService } from '../services/order.service';
import { UserService } from '../services/user.service';
import { InventoryService } from '../services/inventory.service';
import { SavingsService } from '../services/savings.service';

// Use the REAL admin/adminOrStaff middleware here (only `protect` is mocked, per request, to
// inject a req.user controlled via an `x-test-user` header) so this test exercises the actual
// authorization decision — regression for: staff could never clear the mandatory daily rate
// lock, and more broadly could not use most of the admin panel, because most /admin/* routes
// required isAdmin. Product decision: staff mirror admin everywhere EXCEPT inventory.
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

const staffHeader = JSON.stringify({ isAdmin: false, role: 'staff' });
const customerHeader = JSON.stringify({ isAdmin: false, role: 'customer' });
const getAsStaff = (url: string) => request(app).get(url).set('x-test-user', staffHeader);
const getAsCustomer = (url: string) => request(app).get(url).set('x-test-user', customerHeader);

describe('Admin panel access — staff mirrors admin except inventory and savings modify/delete', () => {
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

  it('allows a staff user to GET /admin/orders', async () => {
    jest.spyOn(OrderService.prototype, 'getAllOrders').mockResolvedValue([] as never);

    const res = await getAsStaff('/api/v1/admin/orders');

    expect(res.status).toBe(200);
  });

  it('allows a staff user to GET /admin/users', async () => {
    jest.spyOn(UserService.prototype, 'getAllUsers').mockResolvedValue([] as never);

    const res = await getAsStaff('/api/v1/admin/users');

    expect(res.status).toBe(200);
  });

  it('rejects a staff user from GET /admin/inventory/summary with 403 (inventory stays admin-only)', async () => {
    const spy = jest.spyOn(InventoryService.prototype, 'getSummary');

    const res = await getAsStaff('/api/v1/admin/inventory/summary');

    expect(res.status).toBe(403);
    expect(spy).not.toHaveBeenCalled();
  });

  it('allows a staff user to GET /admin/savings (view-only stays allowed)', async () => {
    jest.spyOn(SavingsService.prototype, 'getAllSchemes').mockResolvedValue([] as never);

    const res = await getAsStaff('/api/v1/admin/savings');

    expect(res.status).toBe(200);
  });

  it('rejects a staff user from PUT /admin/savings/:id with 403 (passbook edits are admin-only)', async () => {
    const spy = jest.spyOn(SavingsService.prototype, 'adminUpdateScheme');

    const res = await request(app)
      .put('/api/v1/admin/savings/64f0000000000000000000aa')
      .set('x-test-user', staffHeader)
      .send({ status: 'Cancelled' });

    expect(res.status).toBe(403);
    expect(spy).not.toHaveBeenCalled();
  });

  it('rejects a staff user from DELETE /admin/savings/:id with 403 (passbook deletion is admin-only)', async () => {
    const spy = jest.spyOn(SavingsService.prototype, 'adminDeleteScheme');

    const res = await request(app)
      .delete('/api/v1/admin/savings/64f0000000000000000000aa')
      .set('x-test-user', staffHeader);

    expect(res.status).toBe(403);
    expect(spy).not.toHaveBeenCalled();
  });

  it('allows an admin user to PUT /admin/savings/:id', async () => {
    jest.spyOn(SavingsService.prototype, 'adminUpdateScheme').mockResolvedValue({} as never);

    const res = await request(app)
      .put('/api/v1/admin/savings/64f0000000000000000000aa')
      .set('x-test-user', JSON.stringify({ isAdmin: true }))
      .send({ status: 'Cancelled' });

    expect(res.status).toBe(200);
  });

  it('allows an admin user to DELETE /admin/savings/:id', async () => {
    jest.spyOn(SavingsService.prototype, 'adminDeleteScheme').mockResolvedValue({} as never);

    const res = await request(app)
      .delete('/api/v1/admin/savings/64f0000000000000000000aa')
      .set('x-test-user', JSON.stringify({ isAdmin: true }));

    expect(res.status).toBe(204);
  });

  it('rejects a plain customer from POST /admin/silver-rates with 403', async () => {
    const res = await request(app)
      .post('/api/v1/admin/silver-rates')
      .set('x-test-user', customerHeader)
      .send({ ratePerGram: 100, purity: 'Silver' });

    expect(res.status).toBe(403);
  });

  it('rejects a plain customer from GET /admin/orders with 403', async () => {
    const res = await getAsCustomer('/api/v1/admin/orders');

    expect(res.status).toBe(403);
  });
});
