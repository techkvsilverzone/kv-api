import request from 'supertest';
import app from '../app';
import { UserRepository } from '../repositories/user.repository';

jest.mock('../middlewares/auth.middleware', () => ({
  protect: (req: any, _res: unknown, next: () => void) => {
    req.user = { _id: { toString: () => 'u1' }, name: 'Asha', isAdmin: false };
    next();
  },
  admin: (_req: unknown, _res: unknown, next: () => void) => next(),
  adminOrStaff: (_req: unknown, _res: unknown, next: () => void) => next(),
}));

const stored = { _id: 'u1', name: 'Asha', email: 'asha@example.com', phone: '9876543210', phoneVerified: true };

describe('PUT /users/me only lets a customer change their own profile fields', () => {
  afterEach(() => jest.restoreAllMocks());

  it('drops privilege and verification fields from the request', async () => {
    jest.spyOn(UserRepository.prototype, 'findById').mockResolvedValue(stored as never);
    const update = jest.spyOn(UserRepository.prototype, 'update').mockResolvedValue(stored as never);

    await request(app).put('/api/v1/users/me').send({
      name: 'Asha R',
      isAdmin: true,
      role: 'admin',
      isActive: true,
      phoneVerified: true,
      passwordHash: 'x',
      password: 'hijack1',
    });

    expect(update).toHaveBeenCalledWith('u1', { name: 'Asha R' });
  });

  it('resets phone verification when the number changes', async () => {
    jest.spyOn(UserRepository.prototype, 'findById').mockResolvedValue(stored as never);
    const update = jest.spyOn(UserRepository.prototype, 'update').mockResolvedValue(stored as never);

    await request(app).put('/api/v1/users/me').send({ phone: '+91 81908 58375' });

    expect(update).toHaveBeenCalledWith('u1', { phone: '8190858375', phoneVerified: false });
  });

  it('keeps verification when the same number is resent in another format', async () => {
    jest.spyOn(UserRepository.prototype, 'findById').mockResolvedValue(stored as never);
    const update = jest.spyOn(UserRepository.prototype, 'update').mockResolvedValue(stored as never);

    await request(app).put('/api/v1/users/me').send({ phone: '+91 98765 43210' });

    expect(update).toHaveBeenCalledWith('u1', { phone: '9876543210' });
  });
});
