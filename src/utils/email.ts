import https from 'https';
import { config } from '../config';
import Logger from './logger';

export interface EmailAddress {
  email: string;
  name?: string;
}

export interface EmailAttachment {
  name: string;
  content: string;
}

export interface SendEmailInput {
  to: EmailAddress[];
  subject: string;
  htmlContent?: string;
  textContent?: string;
  cc?: EmailAddress[];
  bcc?: EmailAddress[];
  replyTo?: EmailAddress;
  params?: Record<string, unknown>;
  tags?: string[];
  sender?: EmailAddress;
  attachments?: EmailAttachment[];
}

interface BrevoSendResult {
  messageId?: string;
}

const BREVO_HOST = 'api.brevo.com';
const BREVO_PATH = '/v3/smtp/email';

function validateInput(input: SendEmailInput): void {
  if (!config.brevoApiKey) {
    throw new Error('BREVO_API_KEY is missing');
  }

  if (!config.brevoSenderEmail && !input.sender?.email) {
    throw new Error('BREVO_SENDER_EMAIL is missing and sender.email was not provided');
  }

  if (!Array.isArray(input.to) || input.to.length === 0) {
    throw new Error('At least one recipient is required in "to"');
  }

  if (!input.subject || !input.subject.trim()) {
    throw new Error('Email subject is required');
  }

  if (!input.htmlContent && !input.textContent) {
    throw new Error('Either htmlContent or textContent is required');
  }
}

function parseResponseBody<T>(raw: string): T {
  if (!raw) return {} as T;
  return JSON.parse(raw) as T;
}

export async function sendEmail(input: SendEmailInput): Promise<BrevoSendResult> {
  validateInput(input);

  const payload = {
    sender: input.sender || {
      email: config.brevoSenderEmail,
      name: config.brevoSenderName,
    },
    to: input.to,
    subject: input.subject,
    htmlContent: input.htmlContent,
    textContent: input.textContent,
    cc: input.cc,
    bcc: input.bcc,
    replyTo: input.replyTo,
    params: input.params,
    tags: input.tags,
    attachment: input.attachments,
  };

  const body = JSON.stringify(payload);

  return new Promise<BrevoSendResult>((resolve, reject) => {
    const req = https.request(
      {
        hostname: BREVO_HOST,
        path: BREVO_PATH,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'api-key': config.brevoApiKey,
          'Content-Length': Buffer.byteLength(body),
        },
      },
      (res) => {
        let raw = '';

        res.on('data', (chunk) => {
          raw += chunk;
        });

        res.on('end', () => {
          try {
            const statusCode = res.statusCode || 500;
            const parsed = parseResponseBody<{ messageId?: string; message?: string }>(raw);

            if (statusCode >= 200 && statusCode < 300) {
              resolve({ messageId: parsed.messageId });
              return;
            }

            const brevoMessage = parsed.message || 'Unknown Brevo error';
            Logger.error(`Brevo email send failed with status ${statusCode}: ${brevoMessage}`);
            reject(new Error(`Brevo email send failed: ${brevoMessage}`));
          } catch (err) {
            reject(err instanceof Error ? err : new Error('Failed to parse Brevo response'));
          }
        });
      },
    );

    req.on('error', (err) => {
      Logger.error(`Brevo request error: ${err.message}`);
      reject(err);
    });

    req.write(body);
    req.end();
  });
}
