import https from 'https';
import { config } from '../config';
import Logger from './logger';

export interface WhatsAppSendResult {
  sent: boolean;
  messageId?: string;
  skippedReason?: string;
}

/**
 * Send a plain-text WhatsApp message via the Meta WhatsApp Cloud API.
 *
 * No SDK — a single native HTTPS POST (mirrors how payments use native crypto
 * and email uses Nodemailer directly). Best-effort: missing config or transport
 * failures are logged and returned as `{ sent: false }`, never thrown, so the
 * caller (the daily cron) is not derailed by a delivery problem.
 *
 * NOTE: outside the 24-hour customer-care window WhatsApp requires an approved
 * message template; free-form text only delivers inside that window.
 */
export async function sendWhatsAppText(to: string, body: string): Promise<WhatsAppSendResult> {
  if (config.whatsappProvider !== 'meta') {
    const reason = `unsupported WHATSAPP_PROVIDER "${config.whatsappProvider}" (only "meta" implemented)`;
    Logger.warn(`[whatsapp] ${reason}`);
    return { sent: false, skippedReason: reason };
  }

  if (!config.whatsappToken || !config.whatsappPhoneId) {
    const reason = 'WHATSAPP_TOKEN / WHATSAPP_PHONE_ID not configured';
    Logger.warn(`[whatsapp] ${reason} — skipping send`);
    return { sent: false, skippedReason: reason };
  }

  // Meta expects the recipient in international format without a leading "+".
  const recipient = to.replace(/[^\d]/g, '');
  const payload = JSON.stringify({
    messaging_product: 'whatsapp',
    to: recipient,
    type: 'text',
    text: { preview_url: false, body },
  });

  const path = `/${config.whatsappApiVersion}/${config.whatsappPhoneId}/messages`;

  try {
    const result = await new Promise<WhatsAppSendResult>((resolve, reject) => {
      const req = https.request(
        {
          hostname: 'graph.facebook.com',
          path,
          method: 'POST',
          headers: {
            Authorization: `Bearer ${config.whatsappToken}`,
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(payload),
          },
        },
        (res) => {
          let data = '';
          res.on('data', (chunk) => (data += chunk));
          res.on('end', () => {
            const status = res.statusCode ?? 0;
            if (status >= 200 && status < 300) {
              let messageId: string | undefined;
              try {
                messageId = JSON.parse(data)?.messages?.[0]?.id;
              } catch {
                /* ignore parse issues — delivery already succeeded */
              }
              resolve({ sent: true, messageId });
            } else {
              reject(new Error(`WhatsApp API responded ${status}: ${data}`));
            }
          });
        },
      );
      req.on('error', reject);
      req.write(payload);
      req.end();
    });

    Logger.info(`[whatsapp] message sent to ${recipient} — id: ${result.messageId ?? 'n/a'}`);
    return result;
  } catch (error) {
    Logger.error(`[whatsapp] send to ${recipient} failed: ${String(error)}`);
    return { sent: false, skippedReason: String(error) };
  }
}

/**
 * Build and send the daily "rate not updated" reminder for the given stale metals.
 */
export async function sendRateUpdateReminder(staleMetals: string[]): Promise<WhatsAppSendResult> {
  const metals = staleMetals
    .map((m) => m.charAt(0).toUpperCase() + m.slice(1).toLowerCase())
    .join(' & ');
  const body =
    `⚠️ KV Silver Zone: Today's ${metals} rate has not been updated. ` +
    `The admin panel is locked for admin/staff until it is recorded. Please update it now.`;
  return sendWhatsAppText(config.rateAlertRecipient, body);
}
