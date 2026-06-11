import { NextRequest, NextResponse } from 'next/server';
import pool from '../../../lib/database';
import { WorkOrder, ApiResponse } from '../../../types';
import { requireRoleAtLeast } from '@/app/api/middleware';
import { ensureSectionSchema } from '@/app/lib/ensureSections';
import { appendSectionFilter } from '@/app/lib/sectionAccess';

export async function GET(request: NextRequest) {
  const auth = requireRoleAtLeast(request, 'incharge');
  if (auth instanceof NextResponse) return auth;
  try {
    const client = await pool.connect();
    try {
      await ensureSectionSchema(client);
      const params: unknown[] = [];
      let query = `
        SELECT 
          wo.*,
          u.username as completion_requested_by_username,
          u.first_name as completion_requested_by_first_name,
          u.last_name as completion_requested_by_last_name
        FROM work_orders wo
        LEFT JOIN users u ON wo.completion_requested_by = u.id
        WHERE wo.status = 'completion_requested'
      `;

      if (auth.user.role === 'incharge') {
        query += ` AND COALESCE(wo.completion_review_stage, 'incharge') = 'incharge'`;
      } else {
        query += ` AND COALESCE(wo.completion_review_stage, 'admin') = 'admin'`;
      }

      query += appendSectionFilter(auth, request, 'wo.section', params);
      query += ' ORDER BY wo.completion_requested_at DESC';
      const result = await client.query(query, params);
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
