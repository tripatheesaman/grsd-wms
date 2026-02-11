import { NextRequest, NextResponse } from 'next/server';
import pool from '../../lib/database';
import { Notification, ApiResponse } from '../../types';
import { requireRoleAtLeast } from '@/app/api/middleware';

export async function GET(request: NextRequest) {
  const auth = requireRoleAtLeast(request, 'user');
  if (auth instanceof NextResponse) return auth;
  try {
    const client = await pool.connect();
    try {
      await client.query(`
        DELETE FROM notifications 
        WHERE expires_at < CURRENT_TIMESTAMP
      `);
      const result = await client.query(`
        SELECT * FROM notifications 
        WHERE user_id = $1 
        ORDER BY created_at DESC
      `, [auth.user.userId]);
      return NextResponse.json<ApiResponse<Notification[]>>({
        success: true,
        data: result.rows
      });
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Fetch notifications error:', error);
    return NextResponse.json<ApiResponse<null>>({
      success: false,
      error: 'Internal server error'
    }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const auth = requireRoleAtLeast(request, 'admin');
  if (auth instanceof NextResponse) return auth;
  try {
    const body = await request.json();
    const { user_id, title, message, type, related_entity_type, related_entity_id } = body;
    if (!user_id || !title || !message || !type) {
      return NextResponse.json<ApiResponse<null>>({
        success: false,
        error: 'User ID, title, message, and type are required'
      }, { status: 400 });
    }
    const client = await pool.connect();
    try {
      const result = await client.query(`
        INSERT INTO notifications (user_id, title, message, type, related_entity_type, related_entity_id)
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING *
      `, [user_id, title, message, type, related_entity_type, related_entity_id]);
      return NextResponse.json<ApiResponse<Notification>>({
        success: true,
        data: result.rows[0]
      });
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Create notification error:', error);
    return NextResponse.json<ApiResponse<null>>({
      success: false,
      error: 'Internal server error'
    }, { status: 500 });
  }
}
