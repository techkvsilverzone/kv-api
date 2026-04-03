import { Router, Request, Response } from 'express';
import { AppError } from '../utils/appError';
import { sendContactUsEmail } from '../utils/emailNotifications';
import Logger from '../utils/logger';

const router = Router();

/**
 * @openapi
 * /contact:
 *   post:
 *     summary: Send contact enquiry
 *     tags: [Misc]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name, email, subject, message]
 *             properties:
 *               name: { type: string }
 *               email: { type: string }
 *               subject: { type: string }
 *               message: { type: string }
 */
router.post('/contact', async (req: Request, res: Response) => {
  const { name, email, subject, message } = req.body || {};

  if (!name || !email || !subject || !message) {
    throw new AppError('name, email, subject and message are required', 400);
  }

  try {
    await sendContactUsEmail({
      name: String(name),
      email: String(email),
      subject: String(subject),
      message: String(message),
    });
    res.status(200).json({ message: 'Message sent successfully' });
  } catch (error) {
    Logger.error(`Contact email failed: ${error instanceof Error ? error.message : String(error)}`);
    throw new AppError('Failed to send message', 502);
  }
});

export default router;
