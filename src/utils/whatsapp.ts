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

/**
 * Confirm to the ops number that today's metal rates were updated on time —
 * the success counterpart to `sendRateUpdateReminder`, sent once the 10 AM
 * guard finds every metal fresh.
 */
export async function sendRateUpdateSuccessNotice(rates: { metal: string; ratePerGram: number }[]): Promise<WhatsAppSendResult> {
  const lines = rates
    .map((r) => `• ${r.metal.charAt(0).toUpperCase() + r.metal.slice(1).toLowerCase()}: ₹${r.ratePerGram}/g`)
    .join('\n');
  const body = `✅ KV Silver Zone: Today's rates are live —\n${lines}`;
  return sendWhatsAppText(config.rateAlertRecipient, body);
}

/** Order payment confirmed — sent to the customer's phone from their shipping address. */
export async function sendPaymentSuccessMessage(
  phone: string,
  input: { invoiceNumber: string; amount: number; paymentMethod: string },
): Promise<WhatsAppSendResult> {
  const body =
    `✅ KV Silver Zone: Payment received for Invoice #${input.invoiceNumber} — ₹${input.amount.toLocaleString('en-IN')} ` +
    `(${input.paymentMethod.toUpperCase()}). Thank you for shopping with us!`;
  return sendWhatsAppText(phone, body);
}

/** A savings installment was recorded — sent to the customer's phone. */
export async function sendSavingsPaymentSuccess(
  phone: string,
  input: { passbookNumber: string; amount: number; totalPaid: number },
): Promise<WhatsAppSendResult> {
  const body =
    `✅ KV Silver Zone: ₹${input.amount.toLocaleString('en-IN')} received for Passbook #${input.passbookNumber}. ` +
    `Total saved so far: ₹${input.totalPaid.toLocaleString('en-IN')}.`;
  return sendWhatsAppText(phone, body);
}

export type SavingsReminderKind = 'day1' | 'day5' | 'day10' | 'missed';

const SAVINGS_REMINDER_COPY: Record<SavingsReminderKind, string> = {
  day1: 'Your savings scheme installment is due. Please pay at your earliest convenience.',
  day5: 'Reminder: your savings scheme installment is still pending (5 days overdue).',
  day10: 'Final reminder: your savings scheme installment is 10 days overdue. Please pay to avoid disruption.',
  missed: 'You have missed this month\'s savings scheme installment. Please contact us or pay online to stay on track.',
};

/**
 * Installment-due / overdue reminder for a savings scheme. `passbookNumber` is absent for
 * the very first installment (a passbook isn't issued until that payment lands), so the
 * message refers to "your savings enrollment" instead of a passbook number in that case.
 */
export async function sendSavingsReminder(
  phone: string,
  kind: SavingsReminderKind,
  input: { passbookNumber?: string; monthlyAmount: number },
): Promise<WhatsAppSendResult> {
  const label = input.passbookNumber ? `Passbook #${input.passbookNumber}` : 'your savings enrollment';
  const body =
    `🔔 KV Silver Zone — ${label}: ${SAVINGS_REMINDER_COPY[kind]} ` +
    `Amount due: ₹${input.monthlyAmount.toLocaleString('en-IN')}.`;
  return sendWhatsAppText(phone, body);
}

/** Birthday wish, sent on the customer's date of birth. */
export async function sendBirthdayWish(phone: string, name: string): Promise<WhatsAppSendResult> {
  const body = `🎉 Happy Birthday, ${name}! Wishing you a wonderful year ahead, from all of us at KV Silver Zone.`;
  return sendWhatsAppText(phone, body);
}

/** Wedding-anniversary wish, sent on the customer's anniversary date. */
export async function sendAnniversaryWish(phone: string, name: string): Promise<WhatsAppSendResult> {
  const body = `💍 Happy Anniversary, ${name}! Wishing you many more years of happiness, from KV Silver Zone.`;
  return sendWhatsAppText(phone, body);
}

/**
 * OTP login code via WhatsApp. Gated by `config.whatsappOtpEnabled` at the call
 * site — Meta requires an approved "Authentication" template to deliver an
 * unsolicited code outside the 24h customer-care window; free-form text (what
 * `sendWhatsAppText` sends) will only actually land once that's approved.
 */
export async function sendOtpWhatsApp(phone: string, code: string, expiryMinutes: number): Promise<WhatsAppSendResult> {
  const body = `Your KV Silver Zone login code is ${code}. It expires in ${expiryMinutes} minutes. Do not share this code.`;
  return sendWhatsAppText(phone, body);
}

/** A Diwali scheme has collected all its installments and is ready for the redemption payout
 * to be computed — sent to the ops number, since that's a manual admin action (unlike
 * Gold/Silver 11+1, whose bonus grams are credited automatically with no further step). */
export async function sendDiwaliSchemeCompleted(
  passbookNumber: string | undefined,
  totalPaid: number,
): Promise<WhatsAppSendResult> {
  const body =
    `🪔 KV Silver Zone: Diwali scheme ${passbookNumber ? `#${passbookNumber}` : '(no passbook yet)'} has collected all ` +
    `installments — ₹${totalPaid.toLocaleString('en-IN')} total. Compute the redemption payout in the admin panel when ready.`;
  return sendWhatsAppText(config.rateAlertRecipient, body);
}

/** The Diwali redemption payout has been computed — sent to the customer. */
export async function sendDiwaliRedemptionReady(
  phone: string,
  input: { passbookNumber: string; goldGrams: number; goldCoinValue: number; silverGrams: number; giftsValue: number },
): Promise<WhatsAppSendResult> {
  const body =
    `🪔 KV Silver Zone: Your Diwali scheme (Passbook #${input.passbookNumber}) redemption is ready — ` +
    `${input.goldGrams}g gold (₹${input.goldCoinValue.toLocaleString('en-IN')}), ${input.silverGrams}g silver, and a ` +
    `₹${input.giftsValue.toLocaleString('en-IN')} gift hamper. Visit the store to collect it.`;
  return sendWhatsAppText(phone, body);
}

/** Admin-authored festival/promotional broadcast to a list of customer phone numbers. */
export async function sendBroadcast(phones: string[], message: string): Promise<{ to: string; result: WhatsAppSendResult }[]> {
  const results: { to: string; result: WhatsAppSendResult }[] = [];
  for (const phone of phones) {
    // Sequential, not Promise.all — a burst of parallel sends is more likely to
    // hit the WhatsApp Cloud API's per-second rate limit for a broadcast-sized list.
    // eslint-disable-next-line no-await-in-loop
    const result = await sendWhatsAppText(phone, message);
    results.push({ to: phone, result });
  }
  return results;
}
