import { Router } from 'express';
import { WhatsAppWebhookController } from '../controllers/whatsappWebhook.controller';

const router = Router();
const controller = new WhatsAppWebhookController();

/**
 * @openapi
 * /webhooks/whatsapp:
 *   get:
 *     summary: Meta WhatsApp Cloud API webhook subscription handshake
 *     tags: [Webhooks]
 *     parameters:
 *       - in: query
 *         name: hub.mode
 *         schema: { type: string }
 *       - in: query
 *         name: hub.verify_token
 *         schema: { type: string }
 *       - in: query
 *         name: hub.challenge
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Echoes hub.challenge back when the verify token matches
 *       403:
 *         description: Verify token mismatch
 */
router.get('/', controller.verify);

/**
 * @openapi
 * /webhooks/whatsapp:
 *   post:
 *     summary: Inbound WhatsApp messages (used to receive return unboxing videos)
 *     tags: [Webhooks]
 *     responses:
 *       200:
 *         description: Always acknowledged immediately; processing happens async
 */
router.post('/', controller.receive);

export default router;
