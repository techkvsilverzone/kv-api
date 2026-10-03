import request from 'supertest';
import app from '../app';
import { UserRepository } from '../repositories/user.repository';
import { StallConfigRepository } from '../repositories/stallConfig.repository';

const MESSAGE = 'An account with this email already exists. Please log in instead.';
const body = { name: 'Asha', email: 'asha@example.com', password: 'secret1', phone: '9876543210' };

describe('POST /auth/signup with an email that already has an account', () => {
  afterEach(() => jest.restoreAllMocks());

  it('rejects an active account email with a clear 409 before inserting', async () => {
    jest.spyOn(UserRepository.prototype, 'findByEmail').mockResolvedValue({ _id: '1' } as never);
    const create = jest.spyOn(UserRepository.prototype, 'create');

    const res = await request(app).post('/api/v1/auth/signup').send(body);

    expect(res.status).toBe(409);
    expect(res.body.message).toBe(MESSAGE);
    expect(create).not.toHaveBeenCalled();
  });

  it('maps the database unique violation (e.g. a deactivated account) to the same 409, not a 500', async () => {
    jest.spyOn(UserRepository.prototype, 'findByEmail').mockResolvedValue(null);
    jest.spyOn(StallConfigRepository.prototype, 'getConfig').mockResolvedValue({ active: false } as never);
    jest
      .spyOn(UserRepository.prototype, 'create')
      .mockRejectedValue(Object.assign(new Error('duplicate key'), { code: '23505', constraint: 'uq_users_email' }));

    const res = await request(app).post('/api/v1/auth/signup').send(body);

    expect(res.status).toBe(409);
    expect(res.body.message).toBe(MESSAGE);
  });
});
