import { NextRequest, NextResponse } from 'next/server';
import pool from '@/app/lib/database';
import { ApiResponse } from '@/app/types';
import { requireRoleAtLeast } from '@/app/api/middleware';
import { ensureEmailSettingsTable, getEmailSettings } from '@/app/lib/emailSettings';

interface UpdateEmailSettingsPayload {
  smtp_enabled: boolean;
  smtp_host: string;
  smtp_port: number;
  smtp_secure: boolean;
  smtp_user: string;
  smtp_password: string;
  from_email: string;
  from_name: string;
  completion_request_recipients: string;
  reminder_recipients: string;
  reminder_days: number;
  reminder_enabled: boolean;
}

export async function GET(request: NextRequest) {
  const auth = requireRoleAtLeast(request, 'superadmin');
  if (auth instanceof NextResponse) return auth;

  try {
    const settings = await getEmailSettings();
    return NextResponse.json<ApiResponse<typeof settings>>({
      success: true,
      data: settings,
    });
  } catch (error) {
    console.error('Fetch email settings error:', error);
    return NextResponse.json<ApiResponse<null>>(
      { success: false, error: 'Internal server error' },
      { status: 500 },
    );
  }
}

export async function PUT(request: NextRequest) {
  const auth = requireRoleAtLeast(request, 'superadmin');
  if (auth instanceof NextResponse) return auth;

  try {
    const body = (await request.json()) as Partial<UpdateEmailSettingsPayload>;
    const smtpPort = Number(body.smtp_port);
    const reminderDays = Number(body.reminder_days);

    if (!Number.isFinite(smtpPort) || smtpPort < 1 || smtpPort > 65535) {
      return NextResponse.json<ApiResponse<null>>(
        { success: false, error: 'SMTP port must be between 1 and 65535.' },
        { status: 400 },
      );
    }

    if (!Number.isFinite(reminderDays) || reminderDays < 0 || reminderDays > 365) {
      return NextResponse.json<ApiResponse<null>>(
        { success: false, error: 'Reminder days must be between 0 and 365.' },
        { status: 400 },
      );
    }

    const client = await pool.connect();
    try {
      await ensureEmailSettingsTable(client);
      await client.query(
        `
          UPDATE email_settings
          SET
            smtp_enabled = $1,
            smtp_host = $2,
            smtp_port = $3,
            smtp_secure = $4,
            smtp_user = $5,
            smtp_password = $6,
            from_email = $7,
            from_name = $8,
            completion_request_recipients = $9,
            reminder_recipients = $10,
            reminder_days = $11,
            reminder_enabled = $12,
            updated_by = $13,
            updated_at = CURRENT_TIMESTAMP
          WHERE id = 1
        `,
        [
          Boolean(body.smtp_enabled),
          (body.smtp_host || '').trim(),
          smtpPort,
          Boolean(body.smtp_secure),
          (body.smtp_user || '').trim(),
          body.smtp_password || '',
          (body.from_email || '').trim(),
          (body.from_name || '').trim() || 'WMS Notifications',
          body.completion_request_recipients || '',
          body.reminder_recipients || '',
          reminderDays,
          Boolean(body.reminder_enabled),
          auth.user.userId,
        ],
      );

      const result = await client.query('SELECT * FROM email_settings WHERE id = 1');
      return NextResponse.json<ApiResponse<typeof result.rows[0]>>({
        success: true,
        data: result.rows[0],
      });
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Update email settings error:', error);
    return NextResponse.json<ApiResponse<null>>(
      { success: false, error: 'Internal server error' },
      { status: 500 },
    );
  }
}
