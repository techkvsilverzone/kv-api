import request from 'supertest';
import app from '../app';
import { UserRepository } from '../repositories/user.repository';

// Authenticated as a fixed user; admin guard unused here.
jest.mock('../middlewares/auth.middleware', () => ({
  protect: (req: any, _res: unknown, next: () => void) => {
    req.user = { _id: { toString: () => 'user-1' }, isAdmin: false };
    next();
  },
  admin: (_req: unknown, _res: unknown, next: () => void) => next(),
  adminOrStaff: (_req: unknown, _res: unknown, next: () => void) => next(),
}));

const validAddress = {
  label: 'Home',
  firstName: 'Asha',
  lastName: 'Rao',
  address: '12 Mint Street',
  city: 'Chennai',
  state: 'Tamil Nadu',
  pincode: '600001',
  phone: '9876543210',
};

describe('Address book API', () => {
  afterEach(() => jest.restoreAllMocks());

  it('creates an address (201) and maps _id -> id', async () => {
    jest.spyOn(UserRepository.prototype, 'addAddress').mockResolvedValue({
      _id: { toString: () => 'addr-1' },
      ...validAddress,
      isDefault: true,
    } as never);

    const res = await request(app).post('/api/v1/users/me/addresses').send(validAddress);

    expect(res.status).toBe(201);
    expect(res.body.id).toBe('addr-1');
    expect(res.body.isDefault).toBe(true);
    expect(res.body).not.toHaveProperty('_id');
  });

  it('rejects an invalid Indian mobile number (400)', async () => {
    const res = await request(app)
      .post('/api/v1/users/me/addresses')
      .send({ ...validAddress, phone: '12345' });

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/phone/i);
  });

  it('rejects a non 6-digit pincode (400)', async () => {
    const res = await request(app)
      .post('/api/v1/users/me/addresses')
      .send({ ...validAddress, pincode: '12' });

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/pincode/i);
  });

  it('requires mandatory fields (400)', async () => {
    const res = await request(app)
      .post('/api/v1/users/me/addresses')
      .send({ firstName: 'Asha' });

    expect(res.status).toBe(400);
  });

  it('lists addresses (200)', async () => {
    jest.spyOn(UserRepository.prototype, 'getAddresses').mockResolvedValue([
      { _id: { toString: () => 'addr-1' }, ...validAddress, isDefault: true },
    ] as never);

    const res = await request(app).get('/api/v1/users/me/addresses');

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body[0].id).toBe('addr-1');
  });

  it('returns 404 when updating a missing address', async () => {
    jest.spyOn(UserRepository.prototype, 'updateAddress').mockResolvedValue(null);

    const res = await request(app)
      .put('/api/v1/users/me/addresses/nope')
      .send({ city: 'Madurai' });

    expect(res.status).toBe(404);
  });

  it('deletes an address (204)', async () => {
    jest.spyOn(UserRepository.prototype, 'deleteAddress').mockResolvedValue(true);

    const res = await request(app).delete('/api/v1/users/me/addresses/addr-1');

    expect(res.status).toBe(204);
  });
});
