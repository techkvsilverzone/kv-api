import crypto from 'crypto';
import { Request, Response } from 'express';
import { ReturnService } from '../services/return.service';
import { config } from '../config';
import Logger from '../utils/logger';

interface RawBodyRequest extends Request {
  rawBody?: Buffer;
}

const MEDIA_TYPES = new Set(['video', 'document']);

export class WhatsAppWebhookController {
  private returnService: ReturnService;

  constructor() {
    this.returnService = new ReturnService();
  }

  /** Meta's one-time subscription handshake: GET with hub.mode/hub.verify_token/hub.challenge. */
  public verify = (req: Request, res: Response): void => {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];

    if (mode === 'subscribe' && token === config.whatsappWebhookVerifyToken && config.whatsappWebhookVerifyToken) {
      res.status(200).send(String(challenge));
      return;
    }
    res.sendStatus(403);
  };

  /** Inbound message events — we only care about video/document messages (unboxing videos). */
  public receive = async (req: RawBodyRequest, res: Response): Promise<void> => {
    // Always ack quickly with 200 — Meta retries aggressively on non-2xx, and a
    // processing error here shouldn't turn into a webhook retry storm.
    res.sendStatus(200);

    if (!this.isValidSignature(req)) {
      Logger.warn('[whatsapp-webhook] signature verification failed — dropping payload');
      return;
    }

    try {
      const entries = req.body?.entry ?? [];
      for (const entry of entries) {
        for (const change of entry?.changes ?? []) {
          const messages = change?.value?.messages ?? [];
          for (const message of messages) {
            if (!MEDIA_TYPES.has(message?.type)) continue;
            const media = message[message.type];
            if (!media?.id) continue;

            // eslint-disable-next-line no-await-in-loop
            await this.returnService.handleIncomingWhatsAppMedia({
              from: String(message.from || ''),
              mediaId: media.id,
              caption: media.caption,
            });
          }
        }
      }
    } catch (error) {
      Logger.error(`[whatsapp-webhook] processing failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  };

  private isValidSignature(req: RawBodyRequest): boolean {
    if (!config.whatsappAppSecret) {
      // No app secret configured — best-effort mode, matching the rest of the
      // WhatsApp integration. Strongly recommended to set WHATSAPP_APP_SECRET
      // in production so a forged payload can't fake "video received".
      Logger.warn('[whatsapp-webhook] WHATSAPP_APP_SECRET not set — skipping signature check');
      return true;
    }
    const signatureHeader = req.headers['x-hub-signature-256'];
    if (typeof signatureHeader !== 'string' || !req.rawBody) return false;

    const expected =
      'sha256=' + crypto.createHmac('sha256', config.whatsappAppSecret).update(req.rawBody).digest('hex');

    const a = Buffer.from(signatureHeader);
    const b = Buffer.from(expected);
    return a.length === b.length && crypto.timingSafeEqual(a, b);
  }
}
