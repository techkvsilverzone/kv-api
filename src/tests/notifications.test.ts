import crypto from 'crypto';
import request from 'supertest';
import app from '../app';
import { NotificationService } from '../services/notification.service';
import { NotificationRepository, PushTokenRepository } from '../repositories/notification.repository';
import { buildAssertion, resetFcmCache, sendPush } from '../infrastructure/push/fcm';
import { config } from '../config';
import { notifyOrderStatus } from '../services/customerNotifications';

jest.mock('../middlewares/auth.middleware', () => ({
  protect: (req: any, _res: unknown, next: () => void) => {
    req.user = { _id: { toString: () => '7' }, name: 'Asha', isAdmin: false };
    next();
  },
  admin: (_req: unknown, _res: unknown, next: () => void) => next(),
  adminOrStaff: (_req: unknown, _res: unknown, next: () => void) => next(),
}));

const fakeRepos = () => {
  const notifications = {
    create: jest.fn(async (_u: string, n: any) => ({ _id: '55', ...n, route: n.route ?? null, read: false, createdAt: new Date() })),
    listForUser: jest.fn(async () => []),
    countUnread: jest.fn(async () => 3),
    markRead: jest.fn(async () => true),
    markAllRead: jest.fn(async () => undefined),
  } as unknown as NotificationRepository;
  const tokens = {
    upsert: jest.fn(async () => undefined),
    removeForUser: jest.fn(async () => undefined),
    removeTokens: jest.fn(async () => undefined),
    tokensForUser: jest.fn(async () => ['tok-a', 'tok-b']),
  } as unknown as PushTokenRepository;
  return { notifications, tokens };
};

describe('NotificationService', () => {
  it('stores the notification, pushes it to every device, and prunes dead tokens', async () => {
    const { notifications, tokens } = fakeRepos();
    const push = jest.fn(async () => ({ sent: 1, invalidTokens: ['tok-b'] }));
    const svc = new NotificationService(notifications, tokens, push);

    await svc.notifyUser('7', { kind: 'order', title: 'Order shipped', body: 'On its way', route: '/order/9' });

    expect(notifications.create).toHaveBeenCalledWith('7', expect.objectContaining({ title: 'Order shipped' }));
    expect(push).toHaveBeenCalledWith(['tok-a', 'tok-b'], {
      title: 'Order shipped',
      body: 'On its way',
      data: { route: '/order/9', kind: 'order', notificationId: '55' },
    });
    expect(tokens.removeTokens).toHaveBeenCalledWith(['tok-b']);
  });

  it('never throws into the business action that triggered it', async () => {
    const { notifications, tokens } = fakeRepos();
    (notifications.create as jest.Mock).mockRejectedValue(new Error('db down'));
    const svc = new NotificationService(notifications, tokens, jest.fn());
    await expect(svc.notifyUser('7', { kind: 'general', title: 't', body: 'b' })).resolves.toBeUndefined();
    await expect(svc.notifyUser(null, { kind: 'general', title: 't', body: 'b' })).resolves.toBeUndefined();
  });

  it('validates device tokens and platforms', async () => {
    const { notifications, tokens } = fakeRepos();
    const svc = new NotificationService(notifications, tokens, jest.fn());
    await expect(svc.registerToken('7', '', 'android')).rejects.toThrow('token is required');
    await expect(svc.registerToken('7', 'abc', 'windows')).rejects.toThrow('platform must be one of');
    await svc.registerToken('7', ' abc ', 'android');
    expect(tokens.upsert).toHaveBeenCalledWith('7', 'abc', 'android');
  });
});

describe('order status copy', () => {
  it('notifies for customer-visible statuses only', async () => {
    const spy = jest.spyOn(NotificationService.prototype, 'notifyUser').mockResolvedValue(undefined);
    await notifyOrderStatus({ _id: '123456789', userId: { _id: '7', toString: () => '7' }, status: 'Shipped' });
    await notifyOrderStatus({ _id: '1', userId: '7', status: 'Pending' });
    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy).toHaveBeenCalledWith('7', {
      kind: 'order',
      title: 'Order shipped',
      body: 'Your order #456789 is on its way.',
      route: '/order/123456789',
    });
    spy.mockRestore();
  });
});

describe('FCM sender', () => {
  const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
  const sa = {
    project_id: 'kv-test',
    client_email: 'push@kv-test.iam.gserviceaccount.com',
    private_key: privateKey.export({ type: 'pkcs8', format: 'pem' }).toString(),
    token_uri: 'https://oauth2.googleapis.com/token',
  };
  const realFetch = global.fetch;

  afterEach(() => {
    global.fetch = realFetch;
    config.fcmServiceAccountJson = '';
    resetFcmCache();
  });

  it('signs a verifiable RS256 assertion for the messaging scope', () => {
    const jwt = buildAssertion(sa, 1_700_000_000);
    const [h, c, sig] = jwt.split('.');
    expect(crypto.createVerify('RSA-SHA256').update(`${h}.${c}`).verify(publicKey, Buffer.from(sig, 'base64url'))).toBe(true);
    const claims = JSON.parse(Buffer.from(c, 'base64url').toString());
    expect(claims).toMatchObject({ iss: sa.client_email, scope: 'https://www.googleapis.com/auth/firebase.messaging', exp: 1_700_003_600 });
  });

  it('sends nothing without credentials', async () => {
    global.fetch = jest.fn() as never;
    expect(await sendPush(['t'], { title: 'a', body: 'b' })).toEqual({ sent: 0, invalidTokens: [] });
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('sends to each token and reports unregistered ones', async () => {
    config.fcmServiceAccountJson = JSON.stringify(sa);
    resetFcmCache();
    const json = (status: number, body: unknown) => ({ ok: status < 300, status, json: async () => body });
    global.fetch = jest.fn(async (url: string, init: any) => {
      if (url.includes('oauth2')) return json(200, { access_token: 'ya29', expires_in: 3600 });
      const token = JSON.parse(init.body).message.token;
      return token === 'good'
        ? json(200, { name: 'projects/kv-test/messages/1' })
        : json(404, { error: { status: 'NOT_FOUND', details: [{ errorCode: 'UNREGISTERED' }] } });
    }) as never;

    const result = await sendPush(['good', 'gone'], { title: 'Hi', body: 'There', data: { route: '/x' } });

    expect(result).toEqual({ sent: 1, invalidTokens: ['gone'] });
    const sendCall = (global.fetch as jest.Mock).mock.calls.find(([u]) => String(u).includes('messages:send'));
    expect(sendCall[0]).toBe('https://fcm.googleapis.com/v1/projects/kv-test/messages:send');
    expect(sendCall[1].headers.Authorization).toBe('Bearer ya29');
  });
});

describe('notification endpoints', () => {
  afterEach(() => jest.restoreAllMocks());

  it('GET /users/me/notifications returns the inbox and unread count', async () => {
    jest.spyOn(NotificationService.prototype, 'list').mockResolvedValue({ notifications: [], unreadCount: 2 });
    const res = await request(app).get('/api/v1/users/me/notifications').set('Authorization', 'Bearer t');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ notifications: [], unreadCount: 2 });
  });

  it('POST /users/me/push-tokens registers the device for the caller', async () => {
    const spy = jest.spyOn(NotificationService.prototype, 'registerToken').mockResolvedValue(undefined);
    const res = await request(app)
      .post('/api/v1/users/me/push-tokens')
      .set('Authorization', 'Bearer t')
      .send({ token: 'fcm-1', platform: 'android' });
    expect(res.status).toBe(204);
    expect(spy).toHaveBeenCalledWith('7', 'fcm-1', 'android');
  });

  it('DELETE /users/me/push-tokens and the read endpoints answer 204', async () => {
    jest.spyOn(NotificationService.prototype, 'unregisterToken').mockResolvedValue(undefined);
    jest.spyOn(NotificationService.prototype, 'markRead').mockResolvedValue(undefined);
    jest.spyOn(NotificationService.prototype, 'markAllRead').mockResolvedValue(undefined);
    const auth = { Authorization: 'Bearer t' };
    expect((await request(app).delete('/api/v1/users/me/push-tokens').set(auth).send({ token: 'x' })).status).toBe(204);
    expect((await request(app).post('/api/v1/users/me/notifications/5/read').set(auth)).status).toBe(204);
    expect((await request(app).post('/api/v1/users/me/notifications/read-all').set(auth)).status).toBe(204);
  });

  it('GET /delivery/check rejects a malformed pincode', async () => {
    const res = await request(app).get('/api/v1/delivery/check?pincode=12');
    expect(res.status).toBe(400);
  });
});
