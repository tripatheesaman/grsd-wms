import { NextResponse } from 'next/server';
import pool from '../../../lib/database';
import { DashboardStats, ApiResponse } from '../../../types';
export async function GET() {
  try {
    const client = await pool.connect();
    try {
      const result = await client.query(`
        SELECT 
          COUNT(*) FILTER (WHERE status = 'ongoing') as ongoing,
          COUNT(*) FILTER (WHERE status = 'completed') as completed,
          COUNT(*) as total
        FROM work_orders
      `);
      const stats: DashboardStats = {
        ongoing: parseInt(result.rows[0].ongoing) || 0,
        completed: parseInt(result.rows[0].completed) || 0,
        total: parseInt(result.rows[0].total) || 0
      };
      return NextResponse.json<ApiResponse<DashboardStats>>({
        success: true,
        data: stats
      });
    } finally {
      client.release();
    }
  } catch {
    return NextResponse.json<ApiResponse<null>>({
      success: false,
      error: 'Internal server error'
    }, { status: 500 });
  }
} 