import mongoose from 'mongoose';
import request from 'supertest';
import app from '../app';
import { UserRepository } from '../repositories/user.repository';

jest.mock('../middlewares/auth.middleware', () => ({
  protect: (req: any, _res: unknown, next: () => void) => {
    req.user = { _id: { toString: () => 'u1' }, name: 'Asha', isAdmin: true };
    next();
  },
  admin: (_req: unknown, _res: unknown, next: () => void) => next(),
  adminOrStaff: (_req: unknown, _res: unknown, next: () => void) => next(),
}));

const ADDRESS_ID = new mongoose.Types.ObjectId();
const BCRYPT_HASH = '$2a$10$abcdefghijklmnopqrstuvOJ3S1nQ8p8w0J8p8w0J8p8w0J8p8w0';

/** Stands in for a Mongoose user doc — `toObject()` yields the raw stored shape. */
const userDoc = (overrides: Record<string, any> = {}) => {
  const plain = {
    _id: 'u1',
    name: 'Asha',
    email: 'asha@example.com',
    phone: '9876543210',
    passwordHash: BCRYPT_HASH,
    isAdmin: false,
    isActive: true,
    addresses: [
      {
        _id: ADDRESS_ID,
        label: 'Home',
        firstName: 'Asha',
        lastName: 'R',
        address: '12 Mount Road',
        city: 'Chennai',
        state: 'Tamil Nadu',
        pincode: '600002',
        phone: '9876543210',
        isDefault: true,
      },
    ],
    ...overrides,
  };
  return { ...plain, toObject: () => plain };
};

describe('User payload shape is identical across every endpoint that returns one', () => {
  afterEach(() => jest.restoreAllMocks());

  it('PUT /users/me never returns the password hash', async () => {
    jest.spyOn(UserRepository.prototype, 'update').mockResolvedValue(userDoc() as never);

    const res = await request(app).put('/api/v1/users/me').send({ name: 'Asha R' });

    expect(res.status).toBe(200);
    expect(res.body.passwordHash).toBeUndefined();
    expect(JSON.stringify(res.body)).not.toContain('$2a$');
  });

  it('PUT /users/me returns the computed role, like GET does', async () => {
    jest.spyOn(UserRepository.prototype, 'update').mockResolvedValue(userDoc() as never);

    const res = await request(app).put('/api/v1/users/me').send({ name: 'Asha R' });

    expect(res.body.role).toBe('customer');
  });

  it('GET and PUT /users/me agree on the exact key set', async () => {
    const doc = userDoc();
    jest.spyOn(UserRepository.prototype, 'findById').mockResolvedValue(doc as never);
    jest.spyOn(UserRepository.prototype, 'update').mockResolvedValue(doc as never);

    const read = await request(app).get('/api/v1/users/me');
    const written = await request(app).put('/api/v1/users/me').send({ name: 'Asha' });

    expect(Object.keys(written.body).sort()).toEqual(Object.keys(read.body).sort());
    expect(written.body).toEqual(read.body);
  });

  it('computes an admin role rather than reflecting the stored field', async () => {
    jest
      .spyOn(UserRepository.prototype, 'findById')
      .mockResolvedValue(userDoc({ isAdmin: true }) as never);

    const res = await request(app).get('/api/v1/users/me');

    expect(res.body.role).toBe('admin');
  });

  describe('embedded addresses', () => {
    it('are keyed by id, not the raw sub-document _id', async () => {
      jest.spyOn(UserRepository.prototype, 'findById').mockResolvedValue(userDoc() as never);

      const res = await request(app).get('/api/v1/users/me');

      const [address] = res.body.addresses;
      expect(address.id).toBe(ADDRESS_ID.toString());
      expect(address._id).toBeUndefined();
    });

    it('use the same id the address-book endpoint returns for that address', async () => {
      jest.spyOn(UserRepository.prototype, 'findById').mockResolvedValue(userDoc() as never);
      jest
        .spyOn(UserRepository.prototype, 'getAddresses')
        .mockResolvedValue(userDoc().addresses as never);

      const fromUser = await request(app).get('/api/v1/users/me');
      const fromBook = await request(app).get('/api/v1/users/me/addresses');

      // One address, created once — it must look the same read either way.
      expect(fromUser.body.addresses[0]).toEqual(fromBook.body[0]);
    });

    it('survive a profile update with the same id key', async () => {
      jest.spyOn(UserRepository.prototype, 'update').mockResolvedValue(userDoc() as never);

      const res = await request(app).put('/api/v1/users/me').send({ name: 'Asha R' });

      expect(res.body.addresses[0].id).toBe(ADDRESS_ID.toString());
      expect(res.body.addresses[0]._id).toBeUndefined();
    });

    it('stay an empty array when the user has none', async () => {
      jest
        .spyOn(UserRepository.prototype, 'findById')
        .mockResolvedValue(userDoc({ addresses: [] }) as never);

      const res = await request(app).get('/api/v1/users/me');

      expect(res.body.addresses).toEqual([]);
    });
  });

  it('GET /admin/users does not leak any customer password hash', async () => {
    jest
      .spyOn(UserRepository.prototype, 'findAll')
      .mockResolvedValue([userDoc(), userDoc({ _id: 'u2', email: 'b@example.com' })] as never);

    const res = await request(app).get('/api/v1/admin/users');

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(2);
    expect(JSON.stringify(res.body)).not.toContain('$2a$');
    res.body.forEach((u: any) => {
      expect(u.passwordHash).toBeUndefined();
      expect(u.role).toBe('customer');
    });
  });

  it('login returns a sanitized user', async () => {
    const bcrypt = require('bcryptjs');
    const realHash = await bcrypt.hash('secret123', 10);
    jest
      .spyOn(UserRepository.prototype, 'findByEmail')
      .mockResolvedValue(userDoc({ passwordHash: realHash }) as never);

    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'asha@example.com', password: 'secret123' });

    expect(res.status).toBe(200);
    expect(res.body.user.passwordHash).toBeUndefined();
    expect(res.body.user.role).toBe('customer');
    expect(res.body.user.addresses[0].id).toBe(ADDRESS_ID.toString());
  });
});
