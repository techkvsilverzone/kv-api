import { query } from '../infrastructure/postgres/pool';
import { MessageLogEntry } from '../domain/messageLog';

export class MessageLogRepository {
  public async create(entry: MessageLogEntry): Promise<void> {
    await query(
      `INSERT INTO message_log (channel, kind, recipient, status, provider_message_id, body, error)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        entry.channel,
        entry.kind,
        entry.recipient,
        entry.status,
        entry.providerMessageId ?? null,
        entry.body ?? null,
        entry.error ?? null,
      ],
    );
  }
}
