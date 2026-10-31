/** What triggered a notification; the client can pick an icon from it. */
export type NotificationKind = 'order' | 'payment' | 'savings' | 'return' | 'general';

export interface INotification {
  _id: string;
  kind: NotificationKind;
  title: string;
  body: string;
  /** In-app path to open on tap, e.g. "/orders/12". */
  route: string | null;
  read: boolean;
  createdAt: Date;
}

export type PushPlatform = 'android' | 'ios' | 'web';
export const PUSH_PLATFORMS: PushPlatform[] = ['android', 'ios', 'web'];
