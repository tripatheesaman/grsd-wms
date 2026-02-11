import { NextRequest, NextResponse } from 'next/server';
import pool from '../../../lib/database';
import { Notification, ApiResponse } from '../../../types';
import { requireRoleAtLeast } from '@/app/api/middleware';

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = requireRoleAtLeast(request, 'user');
  if (auth instanceof NextResponse) return auth;
  try {
    const { id } = await params;
    const notificationId = parseInt(id);
    if (isNaN(notificationId)) {
      return NextResponse.json<ApiResponse<null>>({
        success: false,
        error: 'Invalid notification ID'
      }, { status: 400 });
    }
    const client = await pool.connect();
    try {
      const result = await client.query(`
        UPDATE notifications 
        SET is_read = true 
        WHERE id = $1 AND user_id = $2
        RETURNING *
      `, [notificationId, auth.user.userId]);
      if (result.rows.length === 0) {
        return NextResponse.json<ApiResponse<null>>({
          success: false,
          error: 'Notification not found'
        }, { status: 404 });
      }
      return NextResponse.json<ApiResponse<Notification>>({
        success: true,
        data: result.rows[0]
      });
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Mark notification read error:', error);
    return NextResponse.json<ApiResponse<null>>({
      success: false,
      error: 'Internal server error'
    }, { status: 500 });
  }
}
