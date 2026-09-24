import https from 'https';
import { EventEmitter } from 'events';

jest.mock('../config', () => ({
  config: { whatsappProvider: 'meta', whatsappToken: 't', whatsappPhoneId: 'p', whatsappApiVersion: 'v21.0' },
}));

import { sendWhatsAppText } from '../utils/whatsapp';

function sentRecipient(): Promise<string> {
  return new Promise((resolve) => {
    jest.spyOn(https, 'request').mockImplementation(((_opts: unknown, cb: (res: EventEmitter & { statusCode: number }) => void) => {
      const req = new EventEmitter() as EventEmitter & { write: (b: string) => void; end: () => void };
      req.write = (body: string) => resolve(JSON.parse(body).to);
      req.end = () => {
        const res = Object.assign(new EventEmitter(), { statusCode: 200 });
        cb(res);
        res.emit('data', '{"messages":[{"id":"x"}]}');
        res.emit('end');
      };
      return req;
    }) as unknown as typeof https.request);
  });
}

describe('sendWhatsAppText recipient', () => {
  afterEach(() => jest.restoreAllMocks());

  it.each([
    ['8190858375', '918190858375'],
    ['+91 81908 58375', '918190858375'],
    ['918190858375', '918190858375'],
  ])('%s -> %s', async (input, expected) => {
    const recipient = sentRecipient();
    await sendWhatsAppText(input, 'hi');
    expect(await recipient).toBe(expected);
  });
});
