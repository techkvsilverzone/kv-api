import * as pool from '../infrastructure/postgres/pool';
import { OrderRepository } from '../repositories/order.repository';

/** Captures the SQL of OrderRepository.create through a fake transaction client. */
function stubTransaction() {
  const calls: Array<{ sql: string; params: unknown[] }> = [];
  const client = {
    query: jest.fn(async (sql: string, params: unknown[] = []) => {
      calls.push({ sql, params });
      if (sql.includes('AS next')) return { rows: [{ next: 42 }] };
      if (sql.includes('INSERT INTO orders')) return { rows: [{ id: '77' }] };
      return { rows: [] };
    }),
  };
  jest.spyOn(pool, 'withTransaction').mockImplementation(async (work) => work(client as never));
  jest.spyOn(pool, 'queryOne').mockResolvedValue({
    id: '77', user_id: null, invoice_number: 'INV-2026-000042', status: 'Delivered', payment_method: 'cash',
    payment_status: 'Paid', channel: 'OFFLINE', sold_by: '9', sold_by_name: 'Counter Staff', sale_location: 'Stall',
    user_name: null, user_email: null, items: [],
  } as never);
  return calls;
}

const insertParams = (calls: Array<{ sql: string; params: unknown[] }>) =>
  calls.find((c) => c.sql.includes('INSERT INTO orders'))!.params;

describe('OrderRepository.create — channels', () => {
  afterEach(() => jest.restoreAllMocks());

  it('stores a walk-in OFFLINE sale with no customer, its seller and location, already paid', async () => {
    const calls = stubTransaction();

    const order = await new OrderRepository().create({
      channel: 'OFFLINE', user: null, soldBy: '9', saleLocation: '  Anna Nagar stall ', status: 'Delivered',
      paymentMethod: 'cash', paymentStatus: 'Paid', shippingAddress: { name: 'Walk-in customer' }, items: [],
    });

    const params = insertParams(calls);
    expect(params[0]).toBeNull(); // user_id
    expect(params[2]).toBe('Delivered');
    expect(params[4]).toBe('Paid');
    expect(params.slice(26)).toEqual(['OFFLINE', '9', 'Anna Nagar stall']);
    expect(calls.find((c) => c.sql.includes('INSERT INTO orders'))!.sql).toContain("CASE WHEN $3 = 'Delivered' THEN NOW() END");
    expect(order).toMatchObject({ userId: null, channel: 'OFFLINE', soldBy: { _id: '9', name: 'Counter Staff' }, saleLocation: 'Stall' });
  });

  it('still refuses an ONLINE order without a customer', async () => {
    stubTransaction();
    await expect(new OrderRepository().create({ user: null, items: [] })).rejects.toThrow('Invalid user id');
  });

  it('defaults to ONLINE with payment status derived from Razorpay, as before', async () => {
    const calls = stubTransaction();

    await new OrderRepository().create({ user: '37', razorpayPaymentId: 'pay_1', items: [] });

    const params = insertParams(calls);
    expect(params[0]).toBe('37');
    expect(params[4]).toBe('Paid');
    expect(params.slice(26)).toEqual(['ONLINE', null, null]);
  });
});
