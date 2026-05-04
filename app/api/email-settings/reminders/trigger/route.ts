import { NextRequest, NextResponse } from 'next/server';
import { requireRoleAtLeast } from '@/app/api/middleware';
import { ApiResponse } from '@/app/types';
import { sendPendingCompletionReminderEmail } from '@/app/lib/email';
import { publicOriginFromRequest } from '@/app/utils/publicUrl';

export async function POST(request: NextRequest) {
  const cronSecret = process.env.REMINDER_CRON_SECRET;
  const providedSecret = request.headers.get('x-reminder-secret');
  if (!(cronSecret && providedSecret && cronSecret === providedSecret)) {
    const auth = requireRoleAtLeast(request, 'admin');
    if (auth instanceof NextResponse) return auth;
  }

  try {
    const result = await sendPendingCompletionReminderEmail({
      appBaseUrl: publicOriginFromRequest(request),
    });

    return NextResponse.json<ApiResponse<typeof result>>({
      success: true,
      data: result,
      message: result.sent
        ? `Reminder email sent for ${result.count || 0} completion request(s).`
        : result.reason,
    });
  } catch (error) {
    console.error('Trigger reminder email error:', error);
    return NextResponse.json<ApiResponse<null>>(
      { success: false, error: 'Internal server error' },
      { status: 500 },
    );
  }
}
