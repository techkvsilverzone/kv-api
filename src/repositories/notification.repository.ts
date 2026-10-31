import { query, queryRows, queryOne } from '../infrastructure/postgres/pool';
import { toBigIntParam, toDate } from '../infrastructure/postgres/mapping';
import { INotification, NotificationKind, PushPlatform } from '../domain/notification';

interface NotificationRow {
  id: string;
  kind: NotificationKind;
  title: string;
  body: string;
  route: string | null;
  read_at: Date | null;
  created_at: Date;
}

const toDomain = (r: NotificationRow): INotification => ({
  _id: String(r.id),
  kind: r.kind,
  title: r.title,
  body: r.body,
  route: r.route,
  read: r.read_at !== null,
  createdAt: toDate(r.created_at) as Date,
});

export class NotificationRepository {
  public async create(
    userId: string,
    n: { kind: NotificationKind; title: string; body: string; route?: string | null },
  ): Promise<INotification> {
    const row = await queryOne<NotificationRow>(
      `INSERT INTO notifications (user_id, kind, title, body, route)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, kind, title, body, route, read_at, created_at`,
      [toBigIntParam(userId), n.kind, n.title.slice(0, 200), n.body.slice(0, 1000), n.route ?? null],
    );
    return toDomain(row as NotificationRow);
  }

  /** Newest first. */
  public async listForUser(userId: string, limit = 50): Promise<INotification[]> {
    const rows = await queryRows<NotificationRow>(
      `SELECT id, kind, title, body, route, read_at, created_at
         FROM notifications WHERE user_id = $1
        ORDER BY created_at DESC, id DESC LIMIT $2`,
      [toBigIntParam(userId), limit],
    );
    return rows.map(toDomain);
  }

  public async countUnread(userId: string): Promise<number> {
    const row = await queryOne<{ n: string }>(
      `SELECT count(*)::text AS n FROM notifications WHERE user_id = $1 AND read_at IS NULL`,
      [toBigIntParam(userId)],
    );
    return Number(row?.n ?? 0);
  }

  /** Scoped to the owner, so one customer can't mark another's notification. */
  public async markRead(userId: string, id: string): Promise<boolean> {
    const res = await query(
      `UPDATE notifications SET read_at = COALESCE(read_at, now()) WHERE id = $1 AND user_id = $2`,
      [toBigIntParam(id), toBigIntParam(userId)],
    );
    return (res.rowCount ?? 0) > 0;
  }

  public async markAllRead(userId: string): Promise<void> {
    await query(`UPDATE notifications SET read_at = now() WHERE user_id = $1 AND read_at IS NULL`, [
      toBigIntParam(userId),
    ]);
  }
}

export class PushTokenRepository {
  /** Upsert by token: re-registering on another account moves the token there. */
  public async upsert(userId: string, token: string, platform: PushPlatform): Promise<void> {
    await query(
      `INSERT INTO push_tokens (user_id, token, platform) VALUES ($1, $2, $3)
       ON CONFLICT (token) DO UPDATE SET user_id = EXCLUDED.user_id, platform = EXCLUDED.platform, updated_at = now()`,
      [toBigIntParam(userId), token, platform],
    );
  }

  public async removeForUser(userId: string, token: string): Promise<void> {
    await query(`DELETE FROM push_tokens WHERE user_id = $1 AND token = $2`, [toBigIntParam(userId), token]);
  }

  public async removeTokens(tokens: string[]): Promise<void> {
    if (tokens.length === 0) return;
    await query(`DELETE FROM push_tokens WHERE token = ANY($1::text[])`, [tokens]);
  }

  public async tokensForUser(userId: string): Promise<string[]> {
    const rows = await queryRows<{ token: string }>(`SELECT token FROM push_tokens WHERE user_id = $1`, [
      toBigIntParam(userId),
    ]);
    return rows.map((r) => r.token);
  }
}
