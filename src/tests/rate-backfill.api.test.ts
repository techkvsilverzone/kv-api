import request from 'supertest';
import app from '../app';
import { MetalRateRepository } from '../repositories/metalrate.repository';
import { istDayKey, istMidnightUtc } from '../utils/time';

jest.mock('../middlewares/auth.middleware', () => {
  const actual = jest.requireActual('../middlewares/auth.middleware');
  return { ...actual, protect: (req: any, _res: unknown, next: () => void) => { req.user = { isAdmin: true, name: 'Admin' }; next(); } };
});

const saved = (date: Date, metal: 'SILVER' | 'GOLD') =>
  ({ _id: '1', date, metal, karat: metal === 'GOLD' ? 22 : null, ratePerGram: 190, createdAt: date }) as never;

describe('back-filling a past day\'s rate', () => {
  afterEach(() => jest.restoreAllMocks());

  it.each([['silver-rates', 'SILVER'], ['gold-rates', 'GOLD']] as const)('POST /admin/%s stores the given past date', async (path, metal) => {
    const upsert = jest.spyOn(MetalRateRepository.prototype, 'upsertRate').mockImplementation(async (p) => saved(p.date, metal));
    const res = await request(app).post(`/api/v1/admin/${path}`).send({ ratePerGram: 190, purity: '999', date: '2026-11-10' });
    expect(res.status).toBe(201);
    expect(upsert).toHaveBeenCalledWith(expect.objectContaining({ date: istMidnightUtc('2026-11-10'), metal }));
  });

  it('defaults to today when no date is sent', async () => {
    const upsert = jest.spyOn(MetalRateRepository.prototype, 'upsertRate').mockImplementation(async (p) => saved(p.date, 'SILVER'));
    await request(app).post('/api/v1/admin/silver-rates').send({ ratePerGram: 190, purity: '999' });
    expect(upsert).toHaveBeenCalledWith(expect.objectContaining({ date: istMidnightUtc(istDayKey()) }));
  });

  it('rejects a future date and a malformed one', async () => {
    const upsert = jest.spyOn(MetalRateRepository.prototype, 'upsertRate');
    const future = await request(app).post('/api/v1/admin/silver-rates').send({ ratePerGram: 190, date: '2999-01-01' });
    expect(future.status).toBe(400);
    const bad = await request(app).post('/api/v1/admin/silver-rates').send({ ratePerGram: 190, date: '10/11/2026' });
    expect(bad.status).toBe(400);
    expect(upsert).not.toHaveBeenCalled();
  });
});
