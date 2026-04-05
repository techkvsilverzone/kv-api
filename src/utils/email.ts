import nodemailer from 'nodemailer';
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
  sender?: EmailAddress;
  attachments?: EmailAttachment[];
}

interface BrevoSendResult {
  messageId?: string;
}

function toAddressField(addresses: EmailAddress[]): string {
  return addresses.map((a) => (a.name ? `"${a.name}" <${a.email}>` : a.email)).join(', ');
}

function validateInput(input: SendEmailInput): void {
  if (!config.brevoSmtpUser) {
    throw new Error('BREVO_SMTP_USER is missing');
  }

  if (!config.brevoSmtpPassword) {
    throw new Error('BREVO_SMTP_PASSWORD is missing');
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

const transporter = nodemailer.createTransport({
  host: 'smtp-relay.brevo.com',
  port: 587,
  secure: false,
  auth: {
    user: config.brevoSmtpUser,
    pass: config.brevoSmtpPassword,
  },
});

export async function sendEmail(input: SendEmailInput): Promise<BrevoSendResult> {
  validateInput(input);

  const senderEmail = input.sender?.email ?? config.brevoSenderEmail;
  const senderName = input.sender?.name ?? config.brevoSenderName;
  const from = senderName ? `"${senderName}" <${senderEmail}>` : senderEmail;

  const info = await transporter.sendMail({
    from,
    to: toAddressField(input.to),
    cc: input.cc ? toAddressField(input.cc) : undefined,
    bcc: input.bcc ? toAddressField(input.bcc) : undefined,
    replyTo: input.replyTo ? toAddressField([input.replyTo]) : undefined,
    subject: input.subject,
    html: input.htmlContent,
    text: input.textContent,
    attachments: input.attachments?.map((a) => ({
      filename: a.name,
      content: Buffer.from(a.content, 'base64'),
    })),
  });

  Logger.info(`Email sent to ${toAddressField(input.to)} — messageId: ${info.messageId}`);
  return { messageId: info.messageId };
}
