import { notificationService } from './notification.service';

/**
 * Customer-facing notifications for business events. Routes are the storefront's
 * paths (the app maps `/order/:id` to its own order screen). All best-effort.
 */
type UserRef = string | { _id?: unknown; toString(): string } | null | undefined;

const userIdOf = (u: UserRef): string | null => {
  if (!u) return null;
  if (typeof u === 'object' && '_id' in u && u._id) return String(u._id);
  return String(u);
};

const orderLabel = (o: { _id: unknown; invoiceNumber?: string | null }): string =>
  o.invoiceNumber ? o.invoiceNumber : `#${String(o._id).slice(-6)}`;

const STATUS_COPY: Record<string, { title: string; body: (label: string) => string }> = {
  Processing: { title: 'Order being prepared', body: (l) => `Your order ${l} is being prepared for dispatch.` },
  Shipped: { title: 'Order shipped', body: (l) => `Your order ${l} is on its way.` },
  Delivered: { title: 'Order delivered', body: (l) => `Your order ${l} has been delivered. We hope you love it!` },
  Cancelled: { title: 'Order cancelled', body: (l) => `Your order ${l} was cancelled. Any payment made will be refunded.` },
};

export const notifyOrderPlaced = (order: { _id: unknown; userId?: UserRef; invoiceNumber?: string | null; totalAmount?: number }) =>
  notificationService.notifyUser(userIdOf(order.userId ?? null), {
    kind: 'order',
    title: 'Order placed',
    body: `Thank you! Your order ${orderLabel(order)} has been placed.`,
    route: `/order/${String(order._id)}`,
  });

/** No notification for statuses without customer copy (e.g. Pending). */
export const notifyOrderStatus = async (order: { _id: unknown; userId?: UserRef; invoiceNumber?: string | null; status?: string }) => {
  const copy = order.status ? STATUS_COPY[order.status] : undefined;
  if (!copy) return;
  await notificationService.notifyUser(userIdOf(order.userId ?? null), {
    kind: 'order',
    title: copy.title,
    body: copy.body(orderLabel(order)),
    route: `/order/${String(order._id)}`,
  });
};

export const notifySavingsPayment = (
  userId: string,
  scheme: { passbookNumber?: string | null; planName?: string | null; totalPaid?: number },
  amount: number,
) =>
  notificationService.notifyUser(userId, {
    kind: 'savings',
    title: 'Savings payment received',
    body:
      `₹${Number(amount).toLocaleString('en-IN')} received for ${scheme.planName || 'your savings scheme'}` +
      `${scheme.passbookNumber ? ` (passbook ${scheme.passbookNumber})` : ''}. ` +
      `Total paid: ₹${Number(scheme.totalPaid ?? 0).toLocaleString('en-IN')}.`,
    route: scheme.passbookNumber
      ? `/savings-scheme/passbook/${encodeURIComponent(scheme.passbookNumber)}`
      : '/savings-scheme',
  });

const RETURN_COPY: Record<string, string> = {
  Approved: 'was approved',
  Rejected: 'was not approved',
  Completed: 'is complete',
};

export const notifyReturnStatus = async (ret: { _id: unknown; userId?: UserRef; status?: string }) => {
  const verb = ret.status ? RETURN_COPY[ret.status] : undefined;
  if (!verb) return;
  await notificationService.notifyUser(userIdOf(ret.userId ?? null), {
    kind: 'return',
    title: `Return ${ret.status!.toLowerCase()}`,
    body: `Your return request #${String(ret._id).slice(-6)} ${verb}.`,
    route: '/profile',
  });
};
