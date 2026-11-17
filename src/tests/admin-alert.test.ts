import { EventEmitter } from 'events';

// Capture what would be POSTed to Meta; the first call (template) is refused, the second accepted.
const sent: any[] = [];
let refuseTemplate = true;
jest.mock('https', () => ({
  request: (_opts: unknown, cb: (res: any) => void) => {
    const req = new EventEmitter() as any;
    req.write = (body: string) => sent.push(JSON.parse(body));
    req.end = () => {
      const res = new EventEmitter() as any;
      const isTemplate = sent[sent.length - 1]?.type === 'template';
      res.statusCode = isTemplate && refuseTemplate ? 400 : 200;
      cb(res);
      res.emit('data', res.statusCode === 200 ? '{"messages":[{"id":"wamid.x"}]}' : '{"error":{"code":132001}}');
      res.emit('end');
    };
    return req;
  },
}));
jest.mock('../utils/messageLog', () => ({ recordMessage: jest.fn() }));
jest.mock('../config', () => {
  const actual = jest.requireActual('../config');
  return { config: { ...actual.config, whatsappProvider: 'meta', whatsappToken: 't', whatsappPhoneId: 'p', rateAlertRecipient: '+918825649680' } };
});

import { sendAdminAlert } from '../utils/whatsapp';

describe('admin WhatsApp alerts', () => {
  beforeEach(() => { sent.length = 0; });

  it('sends the approved template with the text flattened to one line', async () => {
    refuseTemplate = false;
    const r = await sendAdminAlert('New order INV-1:\n ₹819.50   paid', 'admin_order_placed');
    expect(r.sent).toBe(true);
    expect(sent).toHaveLength(1);
    expect(sent[0]).toMatchObject({
      to: '918825649680',
      type: 'template',
      template: { name: 'kv_admin_alert', components: [{ type: 'body', parameters: [{ type: 'text', text: 'New order INV-1: ₹819.50 paid' }] }] },
    });
  });

  it('falls back to free text when the template is refused (e.g. not approved yet)', async () => {
    refuseTemplate = true;
    const r = await sendAdminAlert('Silver rate set to ₹190/g', 'admin_rate_updated');
    expect(r.sent).toBe(true);
    expect(sent.map((m) => m.type)).toEqual(['template', 'text']);
    expect(sent[1].text.body).toBe('KV Silver Zone admin alert: Silver rate set to ₹190/g');
  });
});
