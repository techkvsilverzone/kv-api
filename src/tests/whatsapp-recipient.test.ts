import https from 'https';
import { EventEmitter } from 'events';

jest.mock('../config', () => ({
  config: { whatsappProvider: 'meta', whatsappToken: 't', whatsappPhoneId: 'p', whatsappApiVersion: 'v21.0', whatsappOtpTemplate: 'kv_otp', whatsappOtpTemplateLanguage: 'en_US' },
}));
jest.mock('../utils/messageLog', () => ({ recordMessage: jest.fn() }));

import { sendWhatsAppText, sendOtpWhatsApp } from '../utils/whatsapp';
import { recordMessage } from '../utils/messageLog';
import { toIndianMobile } from '../utils/phone';

function sentPayload(status = 200): Promise<Record<string, any>> {
  return new Promise((resolve) => {
    jest.spyOn(https, 'request').mockImplementation(((_opts: unknown, cb: (res: EventEmitter & { statusCode: number }) => void) => {
      const req = new EventEmitter() as EventEmitter & { write: (b: string) => void; end: () => void };
      req.write = (body: string) => resolve(JSON.parse(body));
      req.end = () => {
        const res = Object.assign(new EventEmitter(), { statusCode: status });
        cb(res);
        res.emit('data', status === 200 ? '{"messages":[{"id":"wamid.x"}]}' : '{"error":"bad"}');
        res.emit('end');
      };
      return req;
    }) as unknown as typeof https.request);
  });
}

describe('toIndianMobile', () => {
  it.each([
    ['8190858375', '8190858375'],
    ['+91 81908 58375', '8190858375'],
    ['918190858375', '8190858375'],
    ['08190858375', '8190858375'],
  ])('%s -> %s', (input, expected) => expect(toIndianMobile(input)).toBe(expected));
});

describe('sendWhatsAppText', () => {
  afterEach(() => jest.restoreAllMocks());

  it.each(['8190858375', '+91 81908 58375', '918190858375', '08190858375'])('sends %s to 918190858375', async (input) => {
    const payload = sentPayload();
    await sendWhatsAppText(input, 'hi', 'test');
    expect((await payload).to).toBe('918190858375');
  });

  it('records a sent message with its body and Meta id', async () => {
    sentPayload();
    await sendWhatsAppText('8190858375', 'hello', 'payment_success');
    expect(recordMessage).toHaveBeenLastCalledWith(expect.objectContaining({
      channel: 'whatsapp', kind: 'payment_success', recipient: '918190858375', status: 'sent', providerMessageId: 'wamid.x', body: 'hello',
    }));
  });

  it('records a failed send with the error', async () => {
    sentPayload(400);
    const result = await sendWhatsAppText('8190858375', 'hello', 'broadcast');
    expect(result.sent).toBe(false);
    expect(recordMessage).toHaveBeenLastCalledWith(expect.objectContaining({ status: 'failed', error: expect.stringContaining('400') }));
  });
});

describe('sendOtpWhatsApp', () => {
  afterEach(() => jest.restoreAllMocks());

  it('sends the kv_otp template and never logs the code', async () => {
    const payload = sentPayload();
    await sendOtpWhatsApp('8190858375', '482913', 'login');
    expect((await payload).template.name).toBe('kv_otp');
    const entry = (recordMessage as jest.Mock).mock.lastCall[0];
    expect(entry).toMatchObject({ kind: 'otp_login', body: 'template:kv_otp' });
    expect(JSON.stringify(entry)).not.toContain('482913');
  });
});
