import Logger from './logger';
import { sendEmail } from './email';
import { config } from '../config';

const ADMIN_EMAIL = 'kvszchennai@gmail.com';

function formatCurrency(amount: number): string {
  return `Rs. ${Number(amount || 0).toLocaleString('en-IN')}`;
}

interface EmailDetailRow {
  label: string;
  value: string;
  highlight?: boolean;
}

function buildDetailsTable(rows: EmailDetailRow[]): string {
  const renderedRows = rows
    .map((row, index) => {
      const isLast = index === rows.length - 1;
      return `
        <tr>
          <td style="padding:12px 14px;width:36%;font-size:13px;color:#6b7280;${!isLast ? 'border-bottom:1px solid #e5e7eb;' : ''}">${row.label}</td>
          <td style="padding:12px 14px;font-size:14px;color:${row.highlight ? '#0f766e' : '#111827'};font-weight:${row.highlight ? '700' : '600'};${!isLast ? 'border-bottom:1px solid #e5e7eb;' : ''}">${row.value}</td>
        </tr>
      `;
    })
    .join('');

  return `
    <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="border-collapse:collapse;background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;">
      ${renderedRows}
    </table>
  `;
}

function buildLightThemeEmail(input: {
  title: string;
  intro: string;
  detailsTable?: string;
  closing?: string;
}): string {
  return `
    <div style="margin:0;padding:24px;background:#f5f7fb;font-family:Arial,Helvetica,sans-serif;color:#1f2937;">
      <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="max-width:620px;margin:0 auto;background:#ffffff;border:1px solid #e5e7eb;border-radius:12px;overflow:hidden;">
        <tr>
          <td style="padding:20px 24px;background:#ffffff;border-bottom:1px solid #e5e7eb;">
            <p style="margin:0;font-size:12px;letter-spacing:0.08em;color:#6b7280;text-transform:uppercase;">KV Silver Zone</p>
            <h2 style="margin:8px 0 0 0;font-size:24px;line-height:1.3;color:#111827;">${input.title}</h2>
          </td>
        </tr>
        <tr>
          <td style="padding:24px;">
            <p style="margin:0 0 18px 0;font-size:15px;line-height:1.6;color:#374151;">${input.intro}</p>
            ${input.detailsTable || ''}
            ${input.closing ? `<p style="margin:18px 0 0 0;font-size:14px;line-height:1.6;color:#4b5563;">${input.closing}</p>` : ''}
          </td>
        </tr>
      </table>
    </div>
  `;
}

export async function sendOrderCreatedEmails(input: {
  userEmail?: string;
  userName?: string;
  orderId: string;
  totalAmount: number;
  itemCount: number;
}): Promise<void> {
  const subject = `Order Confirmed: ${input.orderId}`;
  const userName = input.userName || 'Customer';

  const userHtml = buildLightThemeEmail({
    title: 'Order Confirmed',
    intro: `Hi ${userName}, your order has been created successfully.`,
    detailsTable: buildDetailsTable([
      { label: 'Order ID', value: input.orderId },
      { label: 'Items', value: String(input.itemCount) },
      { label: 'Total', value: formatCurrency(input.totalAmount), highlight: true },
    ]),
    closing: 'Thank you for shopping with KV Silver Zone.',
  });

  const adminHtml = buildLightThemeEmail({
    title: 'New Order Received',
    intro: 'A new order has been placed by a customer.',
    detailsTable: buildDetailsTable([
      { label: 'Order ID', value: input.orderId },
      { label: 'Customer', value: `${userName} (${input.userEmail || 'no-email'})` },
      { label: 'Items', value: String(input.itemCount) },
      { label: 'Total', value: formatCurrency(input.totalAmount), highlight: true },
    ]),
  });

  const tasks: Array<Promise<unknown>> = [
    sendEmail({
      to: [{ email: ADMIN_EMAIL, name: 'KV Silver Zone Admin' }],
      subject: `[Admin] ${subject}`,
      htmlContent: adminHtml,
    }),
  ];

  if (input.userEmail) {
    tasks.push(
      sendEmail({
        to: [{ email: input.userEmail, name: userName }],
        subject,
        htmlContent: userHtml,
      }),
    );
  }

  const results = await Promise.allSettled(tasks);
  results.forEach((result) => {
    if (result.status === 'rejected') {
      Logger.error(`Order email failed: ${result.reason instanceof Error ? result.reason.message : String(result.reason)}`);
    }
  });
}

interface OrderConfirmationItem {
  productName: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  isGiftVoucher?: boolean;
}

interface OrderConfirmationAddress {
  name?: string;
  phone?: string;
  line1?: string;
  line2?: string;
  city?: string;
  state?: string;
  pincode?: string;
  country?: string;
}

export interface OrderConfirmationInput {
  userEmail?: string;
  userName?: string;
  orderId: string;
  items: OrderConfirmationItem[];
  subtotal: number;
  taxAmount: number;
  deliveryFee: number;
  discount?: number;
  grandTotal: number;
  shippingAddress?: OrderConfirmationAddress;
  paymentMethod?: string;
  status?: string;
  orderUrl?: string;
}

function buildItemsTable(items: OrderConfirmationItem[]): string {
  const rows = items
    .map(
      (item) => `
        <tr>
          <td style="padding:10px 14px;font-size:13px;color:#111827;border-bottom:1px solid #e5e7eb;">${item.productName}${item.isGiftVoucher ? ' <span style="color:#0f766e;">(Gift Voucher)</span>' : ''}</td>
          <td style="padding:10px 14px;font-size:13px;color:#6b7280;text-align:center;border-bottom:1px solid #e5e7eb;">${item.quantity}</td>
          <td style="padding:10px 14px;font-size:13px;color:#111827;text-align:right;border-bottom:1px solid #e5e7eb;">${formatCurrency(item.totalPrice)}</td>
        </tr>`,
    )
    .join('');

  return `
    <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="border-collapse:collapse;background:#ffffff;border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;margin-bottom:16px;">
      <tr>
        <td style="padding:10px 14px;font-size:12px;color:#6b7280;text-transform:uppercase;letter-spacing:0.05em;background:#f9fafb;border-bottom:1px solid #e5e7eb;">Item</td>
        <td style="padding:10px 14px;font-size:12px;color:#6b7280;text-transform:uppercase;letter-spacing:0.05em;text-align:center;background:#f9fafb;border-bottom:1px solid #e5e7eb;">Qty</td>
        <td style="padding:10px 14px;font-size:12px;color:#6b7280;text-transform:uppercase;letter-spacing:0.05em;text-align:right;background:#f9fafb;border-bottom:1px solid #e5e7eb;">Amount</td>
      </tr>
      ${rows}
    </table>
  `;
}

function formatAddress(address?: OrderConfirmationAddress): string {
  if (!address) return '';
  const parts = [
    address.name,
    address.line1,
    address.line2,
    [address.city, address.state, address.pincode].filter(Boolean).join(', '),
    address.country,
    address.phone ? `Phone: ${address.phone}` : '',
  ].filter(Boolean);
  return parts.join('<br/>');
}

/**
 * Map a persisted order document into the confirmation email payload, including
 * a storefront order link when FRONTEND_URL is configured.
 */
export function buildOrderConfirmationInput(
  order: any,
  opts: { userEmail?: string; userName?: string } = {},
): OrderConfirmationInput {
  const orderId = String(order?._id ?? order?.id ?? '');
  const items: OrderConfirmationItem[] = Array.isArray(order?.items)
    ? order.items.map((i: any) => ({
        productName: i.productName || i.name || 'Item',
        quantity: Number(i.quantity) || 1,
        unitPrice: Number(i.unitPrice) || 0,
        totalPrice: Number(i.totalPrice ?? (Number(i.unitPrice) || 0) * (Number(i.quantity) || 1)),
        isGiftVoucher: Boolean(i.isGiftVoucher),
      }))
    : [];

  const base = config.frontendUrl ? config.frontendUrl.replace(/\/$/, '') : '';

  return {
    userEmail: opts.userEmail,
    userName: opts.userName,
    orderId,
    items,
    subtotal: Number(order?.subtotal) || 0,
    taxAmount: Number(order?.taxAmount ?? order?.tax) || 0,
    deliveryFee: Number(order?.deliveryFee) || 0,
    discount: Number(order?.couponDiscount) || 0,
    grandTotal: Number(order?.grandTotal ?? order?.totalAmount) || 0,
    shippingAddress: order?.shippingAddress,
    paymentMethod: order?.paymentMethod ? String(order.paymentMethod).toUpperCase() : undefined,
    status: order?.status,
    orderUrl: base ? `${base}/order/${orderId}` : undefined,
  };
}

/**
 * Customer order confirmation (sent on order creation for both razorpay and COD).
 * Includes line items, the totals breakdown, the shipping address, and a link to
 * the order page. Best-effort: failures are logged, never thrown.
 */
export async function sendOrderConfirmationEmail(input: OrderConfirmationInput): Promise<void> {
  const userName = input.userName || 'Customer';
  const subject = `Order Confirmation: ${input.orderId}`;

  const totalsRows: EmailDetailRow[] = [
    { label: 'Subtotal', value: formatCurrency(input.subtotal) },
    { label: 'Tax', value: formatCurrency(input.taxAmount) },
  ];
  if (input.discount && input.discount > 0) {
    totalsRows.push({ label: 'Discount', value: `- ${formatCurrency(input.discount)}` });
  }
  totalsRows.push({ label: 'Delivery', value: formatCurrency(input.deliveryFee) });
  totalsRows.push({ label: 'Grand Total', value: formatCurrency(input.grandTotal), highlight: true });

  const addressHtml = formatAddress(input.shippingAddress);
  const orderLink = input.orderUrl
    ? `<p style="margin:18px 0 0 0;font-size:14px;"><a href="${input.orderUrl}" style="color:#0f766e;font-weight:600;text-decoration:none;">View your order &rarr;</a></p>`
    : '';

  const bodyHtml = `
    ${buildItemsTable(input.items)}
    ${buildDetailsTable(totalsRows)}
    ${addressHtml ? `<p style="margin:18px 0 6px 0;font-size:12px;color:#6b7280;text-transform:uppercase;letter-spacing:0.05em;">Shipping to</p><p style="margin:0;font-size:14px;line-height:1.6;color:#374151;">${addressHtml}</p>` : ''}
    ${orderLink}
  `;

  const userHtml = buildLightThemeEmail({
    title: 'Order Confirmed',
    intro: `Hi ${userName}, thank you for your order. Here is your confirmation${input.paymentMethod ? ` (paid via ${input.paymentMethod})` : ''}.`,
    detailsTable: `${buildDetailsTable([{ label: 'Order ID', value: input.orderId }])}<div style="height:16px;"></div>${bodyHtml}`,
    closing: 'We will notify you when your order ships. Thank you for shopping with KV Silver Zone.',
  });

  const adminHtml = buildLightThemeEmail({
    title: 'New Order Received',
    intro: `A new order has been placed by ${userName} (${input.userEmail || 'no-email'}).`,
    detailsTable: `${buildDetailsTable([
      { label: 'Order ID', value: input.orderId },
      { label: 'Payment', value: input.paymentMethod || 'n/a' },
      { label: 'Grand Total', value: formatCurrency(input.grandTotal), highlight: true },
    ])}<div style="height:16px;"></div>${buildItemsTable(input.items)}`,
  });

  const tasks: Array<Promise<unknown>> = [
    sendEmail({
      to: [{ email: ADMIN_EMAIL, name: 'KV Silver Zone Admin' }],
      subject: `[Admin] ${subject}`,
      htmlContent: adminHtml,
    }),
  ];

  if (input.userEmail) {
    tasks.push(
      sendEmail({
        to: [{ email: input.userEmail, name: userName }],
        subject,
        htmlContent: userHtml,
      }),
    );
  }

  const results = await Promise.allSettled(tasks);
  results.forEach((result) => {
    if (result.status === 'rejected') {
      Logger.error(`Order confirmation email failed: ${result.reason instanceof Error ? result.reason.message : String(result.reason)}`);
    }
  });
}

/** One-time login code, valid for a few minutes. */
export async function sendOtpEmail(input: { email: string; name?: string; code: string; expiryMinutes: number }): Promise<void> {
  const html = buildLightThemeEmail({
    title: 'Your Login Code',
    intro: `Hi ${input.name || 'there'}, use the code below to sign in to KV Silver Zone. It expires in ${input.expiryMinutes} minutes.`,
    detailsTable: `
      <div style="text-align:center;padding:16px 0;">
        <span style="display:inline-block;font-size:32px;font-weight:700;letter-spacing:0.3em;color:#0f766e;">${input.code}</span>
      </div>
    `,
    closing: "If you didn't request this code, you can safely ignore this email.",
  });

  await sendEmail({
    to: [{ email: input.email, name: input.name }],
    subject: `${input.code} is your KV Silver Zone login code`,
    htmlContent: html,
  });
}

export async function sendPasswordResetEmail(input: {
  email: string;
  name?: string;
  code: string;
  expiryMinutes: number;
}): Promise<void> {
  const html = buildLightThemeEmail({
    title: 'Reset Your Password',
    intro: `Hi ${input.name || 'there'}, use the code below to set a new KV Silver Zone password. It expires in ${input.expiryMinutes} minutes.`,
    detailsTable: `
      <div style="text-align:center;padding:16px 0;">
        <span style="display:inline-block;font-size:32px;font-weight:700;letter-spacing:0.3em;color:#0f766e;">${input.code}</span>
      </div>
    `,
    closing:
      "If you didn't request a password reset, you can safely ignore this email — your password stays unchanged.",
  });

  await sendEmail({
    to: [{ email: input.email, name: input.name }],
    subject: `${input.code} is your KV Silver Zone password reset code`,
    htmlContent: html,
  });
}

export async function sendContactUsEmail(input: {
  name: string;
  email: string;
  subject: string;
  message: string;
}): Promise<void> {
  await sendEmail({
    to: [{ email: ADMIN_EMAIL, name: 'KV Silver Zone Admin' }],
    replyTo: { email: input.email, name: input.name },
    subject: `[Contact] ${input.subject}`,
    htmlContent: buildLightThemeEmail({
      title: 'Contact Enquiry',
      intro: 'A customer has submitted a new contact message.',
      detailsTable: buildDetailsTable([
        { label: 'Name', value: input.name },
        { label: 'Email', value: input.email },
        { label: 'Subject', value: input.subject },
        { label: 'Message', value: input.message },
      ]),
    }),
  });
}

export async function sendPaymentCompletedEmails(input: {
  userEmail?: string;
  userName?: string;
  orderId: string;
  amount: number;
  paymentMethod: string;
}): Promise<void> {
  const userName = input.userName || 'Customer';
  const subject = `Payment Received: ${input.orderId}`;

  const adminHtml = buildLightThemeEmail({
    title: 'Payment Completed',
    intro: 'A payment has been completed for an order.',
    detailsTable: buildDetailsTable([
      { label: 'Order ID', value: input.orderId },
      { label: 'Customer', value: `${userName} (${input.userEmail || 'no-email'})` },
      { label: 'Amount', value: formatCurrency(input.amount), highlight: true },
      { label: 'Method', value: input.paymentMethod },
    ]),
  });

  const userHtml = buildLightThemeEmail({
    title: 'Payment Received',
    intro: `Hi ${userName}, we have received your payment successfully.`,
    detailsTable: buildDetailsTable([
      { label: 'Order ID', value: input.orderId },
      { label: 'Amount', value: formatCurrency(input.amount), highlight: true },
      { label: 'Method', value: input.paymentMethod },
    ]),
    closing: 'Thank you for shopping with KV Silver Zone.',
  });

  const tasks: Array<Promise<unknown>> = [
    sendEmail({
      to: [{ email: ADMIN_EMAIL, name: 'KV Silver Zone Admin' }],
      subject: `[Admin] ${subject}`,
      htmlContent: adminHtml,
    }),
  ];

  if (input.userEmail) {
    tasks.push(
      sendEmail({
        to: [{ email: input.userEmail, name: userName }],
        subject,
        htmlContent: userHtml,
      }),
    );
  }

  const results = await Promise.allSettled(tasks);
  results.forEach((result) => {
    if (result.status === 'rejected') {
      Logger.error(`Payment email failed: ${result.reason instanceof Error ? result.reason.message : String(result.reason)}`);
    }
  });
}

export async function sendNewProductPromotion(input: {
  productName: string;
  category: string;
  price: number;
  recipients: string[];
}): Promise<void> {
  if (!input.recipients.length) return;

  const subject = `New Arrival: ${input.productName}`;
  const htmlContent = buildLightThemeEmail({
    title: 'New Product Added',
    intro: 'We just added a new product to KV Silver Zone. Here are the details:',
    detailsTable: buildDetailsTable([
      { label: 'Product', value: input.productName },
      { label: 'Category', value: input.category },
      { label: 'Price', value: formatCurrency(input.price), highlight: true },
    ]),
    closing: 'Visit our store to check it out.',
  });

  const chunkSize = 50;
  for (let i = 0; i < input.recipients.length; i += chunkSize) {
    const batch = input.recipients.slice(i, i + chunkSize);
    try {
      await sendEmail({
        to: batch.map((email) => ({ email })),
        subject,
        htmlContent,
      });
    } catch (error) {
      Logger.error(`Promotional email batch failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}
