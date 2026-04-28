import nodemailer from 'nodemailer';
import pool from '@/app/lib/database';
import { getEmailSettings, parseRecipients } from '@/app/lib/emailSettings';

interface CompletionRequestEmailPayload {
  workOrderId: number;
  workOrderNo: string;
  requestedByName: string;
  completionDate: string;
  appBaseUrl?: string;
}

function resolveAppBaseUrl(appBaseUrl?: string): string {
  return (
    appBaseUrl ||
    process.env.APP_BASE_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    'http://localhost:3000'
  ).replace(/\/$/, '');
}

function formatDateForEmail(dateValue: string): string {
  const date = new Date(dateValue);
  return Number.isNaN(date.getTime()) ? dateValue : date.toLocaleDateString('en-GB');
}

async function sendEmailInternal(options: {
  recipients: string[];
  subject: string;
  text: string;
  html: string;
}): Promise<{ sent: boolean; reason?: string }> {
  const settings = await getEmailSettings();

  if (!settings.smtp_enabled) {
    return { sent: false, reason: 'SMTP is disabled in email settings.' };
  }
  if (!settings.smtp_host || !settings.smtp_user || !settings.smtp_password || !settings.from_email) {
    return { sent: false, reason: 'SMTP credentials are incomplete in email settings.' };
  }
  if (options.recipients.length === 0) {
    return { sent: false, reason: 'No recipients configured for this email type.' };
  }

  const transporter = nodemailer.createTransport({
    host: settings.smtp_host,
    port: settings.smtp_port,
    secure: settings.smtp_secure,
    auth: {
      user: settings.smtp_user,
      pass: settings.smtp_password,
    },
  });

  await transporter.sendMail({
    from: settings.from_name ? `"${settings.from_name}" <${settings.from_email}>` : settings.from_email,
    to: options.recipients.join(', '),
    subject: options.subject,
    text: options.text,
    html: options.html,
  });

  return { sent: true };
}

export async function sendCompletionRequestEmail(
  payload: CompletionRequestEmailPayload,
): Promise<{ sent: boolean; reason?: string }> {
  const settings = await getEmailSettings();
  const recipients = parseRecipients(settings.completion_request_recipients);
  const baseUrl = resolveAppBaseUrl(payload.appBaseUrl);
  const reviewLink = `${baseUrl}/work-orders/${payload.workOrderId}`;
  const completionRequestsLink = `${baseUrl}/work-orders/completion-requests`;
  const completionDate = formatDateForEmail(payload.completionDate);

  return sendEmailInternal({
    recipients,
    subject: `Completion Request Submitted - ${payload.workOrderNo}`,
    text:
      `A completion request has been submitted.\n\n` +
      `Work Order: ${payload.workOrderNo}\n` +
      `Requested By: ${payload.requestedByName}\n` +
      `Completion Date: ${completionDate}\n\n` +
      `Review Request: ${reviewLink}\n` +
      `All Requests: ${completionRequestsLink}\n`,
    html:
      `<p>A completion request has been submitted.</p>` +
      `<p><strong>Work Order:</strong> ${payload.workOrderNo}<br/>` +
      `<strong>Requested By:</strong> ${payload.requestedByName}<br/>` +
      `<strong>Completion Date:</strong> ${completionDate}</p>` +
      `<p><a href="${reviewLink}">Open Work Order</a><br/>` +
      `<a href="${completionRequestsLink}">Open Completion Requests</a></p>`,
  });
}

export async function sendPendingCompletionReminderEmail(params?: {
  appBaseUrl?: string;
}): Promise<{ sent: boolean; reason?: string; count?: number }> {
  const settings = await getEmailSettings();
  const recipients = parseRecipients(settings.reminder_recipients);

  if (!settings.reminder_enabled) {
    return { sent: false, reason: 'Completion reminder emails are disabled.' };
  }
  if (settings.reminder_days < 0) {
    return { sent: false, reason: 'Reminder days must be zero or more.' };
  }

  const client = await pool.connect();
  try {
    const result = await client.query(
      `
      SELECT id, work_order_no, completion_requested_at
      FROM work_orders
      WHERE status = 'completion_requested'
        AND completion_requested_at IS NOT NULL
        AND completion_requested_at <= NOW() - ($1::text || ' days')::interval
      ORDER BY completion_requested_at ASC
    `,
      [settings.reminder_days],
    );

    if (result.rows.length === 0) {
      return { sent: false, reason: 'No overdue pending completion requests found.', count: 0 };
    }

    const baseUrl = resolveAppBaseUrl(params?.appBaseUrl);
    const completionRequestsLink = `${baseUrl}/work-orders/completion-requests`;
    const rowsHtml = result.rows
      .map((row) => {
        const requestedDate = formatDateForEmail(row.completion_requested_at);
        const workOrderLink = `${baseUrl}/work-orders/${row.id}`;
        return `<li><a href="${workOrderLink}">${row.work_order_no}</a> - requested on ${requestedDate}</li>`;
      })
      .join('');
    const rowsText = result.rows
      .map((row) => {
        const requestedDate = formatDateForEmail(row.completion_requested_at);
        return `- ${row.work_order_no} (requested on ${requestedDate})`;
      })
      .join('\n');

    const sendResult = await sendEmailInternal({
      recipients,
      subject: `Pending Completion Requests Reminder (${result.rows.length})`,
      text:
        `The following completion requests have been pending for at least ${settings.reminder_days} day(s):\n\n` +
        `${rowsText}\n\n` +
        `Review all requests: ${completionRequestsLink}`,
      html:
        `<p>The following completion requests have been pending for at least ${settings.reminder_days} day(s):</p>` +
        `<ul>${rowsHtml}</ul>` +
        `<p><a href="${completionRequestsLink}">Review all completion requests</a></p>`,
    });

    return { ...sendResult, count: result.rows.length };
  } finally {
    client.release();
  }
}
