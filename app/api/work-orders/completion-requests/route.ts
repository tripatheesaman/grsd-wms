import { NextRequest, NextResponse } from 'next/server';
import pool from '../../../lib/database';
import { WorkOrder, ApiResponse } from '../../../types';
import { requireRoleAtLeast } from '@/app/api/middleware';
export async function GET(request: NextRequest) {
  const auth = requireRoleAtLeast(request, 'admin');
  if (auth instanceof NextResponse) return auth;
  try {
    const client = await pool.connect();
    try {
      const result = await client.query(`
        SELECT 
          wo.*,
          u.username as completion_requested_by_username,
          u.first_name as completion_requested_by_first_name,
          u.last_name as completion_requested_by_last_name
        FROM work_orders wo
        LEFT JOIN users u ON wo.completion_requested_by = u.id
        WHERE wo.status = 'completion_requested'
        ORDER BY wo.completion_requested_at DESC
      `);
      return NextResponse.json<ApiResponse<WorkOrder[]>>({
        success: true,
        data: result.rows
      });
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Fetch completion requests error:', error);
    return NextResponse.json<ApiResponse<null>>({
      success: false,
      error: 'Internal server error'
    }, { status: 500 });
  }
}
