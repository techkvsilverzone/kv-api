import { MessageLogRepository } from '../repositories/messageLog.repository';
import { MessageLogEntry } from '../domain/messageLog';
import Logger from './logger';

const repository = new MessageLogRepository();

/** Best-effort audit row — a logging failure must never fail or block the message itself. */
export async function recordMessage(entry: MessageLogEntry): Promise<void> {
  try {
    await repository.create(entry);
  } catch (error) {
    Logger.error(`[message-log] could not record ${entry.channel}/${entry.kind} to ${entry.recipient}: ${String(error)}`);
  }
}
