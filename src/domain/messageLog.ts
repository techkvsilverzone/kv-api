/** One outbound customer/ops message (WhatsApp, or an OTP email). OTP codes are never stored. */
export interface MessageLogEntry {
  channel: 'whatsapp' | 'email';
  kind: string;
  recipient: string;
  status: 'sent' | 'failed';
  providerMessageId?: string | null;
  body?: string | null;
  error?: string | null;
}
