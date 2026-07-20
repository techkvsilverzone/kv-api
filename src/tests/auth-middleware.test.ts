import jwt from 'jsonwebtoken';
import { protect } from '../middlewares/auth.middleware';
import { UserRepository } from '../repositories/user.repository';
import { AppError } from '../utils/appError';
import { config } from '../config';

const makeReq = (token?: string) =>
  ({ headers: token ? { authorization: `Bearer ${token}` } : {} } as any);

const sign = (id: string) => jwt.sign({ id }, config.jwtSecret);

describe('protect middleware — auth failure vs. infrastructure failure', () => {
  afterEach(() => jest.restoreAllMocks());

  const run = async (req: any) => {
    const next = jest.fn();
    await protect(req, {} as any, next);
    return next.mock.calls[0]?.[0];
  };

  it('passes a valid token through and attaches the user', async () => {
    const currentUser = { _id: { toString: () => 'u1' }, name: 'Asha' };
    jest.spyOn(UserRepository.prototype, 'findById').mockResolvedValue(currentUser as never);

    const req = makeReq(sign('u1'));
    const err = await run(req);

    expect(err).toBeUndefined();
    expect(req.user).toBe(currentUser);
  });

  it('401s when no token is present', async () => {
    const err = await run(makeReq());
    expect(err).toBeInstanceOf(AppError);
    expect((err as AppError).statusCode).toBe(401);
  });

  it('401s on a token signed with the wrong secret', async () => {
    const err = await run(makeReq(jwt.sign({ id: 'u1' }, 'not-the-real-secret')));
    expect((err as AppError).statusCode).toBe(401);
  });

  it('401s when the token subject no longer exists', async () => {
    jest.spyOn(UserRepository.prototype, 'findById').mockResolvedValue(null as never);

    const err = await run(makeReq(sign('ghost')));

    expect((err as AppError).statusCode).toBe(401);
  });

  it('does NOT 401 when the user lookup fails — that is a 5xx, not a rejected token', async () => {
    // Regression: this used to share a catch block with jwt.verify and surface as
    // 401, so a Mongo blip made every client discard a perfectly valid session.
    const dbError = Object.assign(new Error('connection timed out'), {
      name: 'MongoNetworkError',
    });
    jest.spyOn(UserRepository.prototype, 'findById').mockRejectedValue(dbError);

    const err = await run(makeReq(sign('u1')));

    expect(err).toBe(dbError);
    expect(err).not.toBeInstanceOf(AppError);
  });

  it('still 401s when the token carries a malformed subject id', async () => {
    const castError = Object.assign(new Error('Cast to ObjectId failed'), { name: 'CastError' });
    jest.spyOn(UserRepository.prototype, 'findById').mockRejectedValue(castError);

    const err = await run(makeReq(sign('not-an-object-id')));

    expect(err).toBeInstanceOf(AppError);
    expect((err as AppError).statusCode).toBe(401);
  });
});
