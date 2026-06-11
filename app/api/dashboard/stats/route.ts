import { NextRequest, NextResponse } from 'next/server';
import pool from '../../../lib/database';
import { DashboardStats, ApiResponse } from '../../../types';
import { requireRoleAtLeast } from '@/app/api/middleware';
import { ensureSectionSchema } from '@/app/lib/ensureSections';
import { appendSectionFilter } from '@/app/lib/sectionAccess';

export async function GET(request: NextRequest) {
  const auth = requireRoleAtLeast(request, 'user');
  if (auth instanceof NextResponse) return auth;

  try {
    const client = await pool.connect();
    try {
      await ensureSectionSchema(client);
      const params: unknown[] = [];
      let query = `
        SELECT 
          COUNT(*) FILTER (WHERE status = 'ongoing') as ongoing,
          COUNT(*) FILTER (WHERE status = 'completed') as completed,
          COUNT(*) as total
        FROM work_orders
        WHERE 1=1
      `;
      query += appendSectionFilter(auth, request, 'section', params);
      const result = await client.query(query, params);
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
