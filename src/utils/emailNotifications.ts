import Logger from './logger';
import { sendEmail } from './email';

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
        tags: ['promotion', 'new-product'],
      });
    } catch (error) {
      Logger.error(`Promotional email batch failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}
