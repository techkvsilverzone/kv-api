import Logger from '../utils/logger';
import { AppError } from '../utils/appError';
import { NotificationRepository, PushTokenRepository } from '../repositories/notification.repository';
import { INotification, NotificationKind, PUSH_PLATFORMS, PushPlatform } from '../domain/notification';
import { sendPush } from '../infrastructure/push/fcm';

export interface NotifyInput {
  kind: NotificationKind;
  title: string;
  body: string;
  /** In-app route, e.g. "/orders/12". */
  route?: string | null;
}

export class NotificationService {
  constructor(
    private notifications = new NotificationRepository(),
    private tokens = new PushTokenRepository(),
    private push: typeof sendPush = sendPush,
  ) {}

  /**
   * Stores the notification in the user's inbox and pushes it to their devices.
   * Best-effort: never throws, so the business action that triggered it always succeeds.
   */
  public async notifyUser(userId: string | null | undefined, n: NotifyInput): Promise<void> {
    if (!userId) return;
    try {
      const saved = await this.notifications.create(String(userId), n);
      const tokens = await this.tokens.tokensForUser(String(userId));
      const result = await this.push(tokens, {
        title: n.title,
        body: n.body,
        data: { route: n.route ?? '', kind: n.kind, notificationId: saved._id },
      });
      if (result.invalidTokens.length) await this.tokens.removeTokens(result.invalidTokens);
    } catch (error) {
      Logger.error(`[notify] could not notify user ${userId}: ${String(error)}`);
    }
  }

  public async registerToken(userId: string, token: unknown, platform: unknown): Promise<void> {
    const t = typeof token === 'string' ? token.trim() : '';
    if (!t || t.length > 4096) throw new AppError('token is required', 400);
    if (!PUSH_PLATFORMS.includes(platform as PushPlatform)) {
      throw new AppError(`platform must be one of ${PUSH_PLATFORMS.join(', ')}`, 400);
    }
    await this.tokens.upsert(userId, t, platform as PushPlatform);
  }

  public async unregisterToken(userId: string, token: unknown): Promise<void> {
    const t = typeof token === 'string' ? token.trim() : '';
    if (!t) throw new AppError('token is required', 400);
    await this.tokens.removeForUser(userId, t);
  }

  public async list(userId: string): Promise<{ notifications: INotification[]; unreadCount: number }> {
    const [notifications, unreadCount] = await Promise.all([
      this.notifications.listForUser(userId),
      this.notifications.countUnread(userId),
    ]);
    return { notifications, unreadCount };
  }

  public async markRead(userId: string, id: string): Promise<void> {
    if (!(await this.notifications.markRead(userId, id))) throw new AppError('Notification not found', 404);
  }

  public async markAllRead(userId: string): Promise<void> {
    await this.notifications.markAllRead(userId);
  }
}

/** Shared instance for the services that send notifications. */
export const notificationService = new NotificationService();
