import { NextResponse } from 'next/server';
import pool from '../../../lib/database';
import { ApiResponse } from '../../../types';

export async function POST() {
  try {
    const client = await pool.connect();
    try {
      const result = await client.query(`
        DELETE FROM notifications 
        WHERE expires_at < CURRENT_TIMESTAMP
      `);
      const deletedCount = result.rowCount || 0;
      return NextResponse.json<ApiResponse<{ deletedCount: number }>>({
        success: true,
        data: { deletedCount },
        message: `Cleaned up ${deletedCount} expired notifications`
      });
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Cleanup notifications error:', error);
    return NextResponse.json<ApiResponse<null>>({
      success: false,
      error: 'Internal server error'
    }, { status: 500 });
  }
}
