import { Router, Request, Response } from 'express';

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
router.post('/contact', (req: Request, res: Response) => {
  // Logic to send email or save to DB
  res.status(200).json({ message: 'Message sent successfully' });
});

export default router;
