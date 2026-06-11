import { NextRequest, NextResponse } from 'next/server';
import pool from '../../../lib/database';
import { ApiResponse } from '../../../types';
import { requireRoleAtLeast } from '@/app/api/middleware';
import { ensureSectionSchema } from '@/app/lib/ensureSections';

export async function PUT(request: NextRequest) {
  const auth = requireRoleAtLeast(request, 'incharge');
  if (auth instanceof NextResponse) return auth;

  try {
    const body = await request.json();
    const { assignment_id, assignment_type, approved } = body as {
      assignment_id?: number;
      assignment_type?: 'action_date' | 'action';
      approved?: boolean;
    };

    if (!assignment_id || !assignment_type || typeof approved !== 'boolean') {
      return NextResponse.json<ApiResponse<null>>({
        success: false,
        error: 'assignment_id, assignment_type, and approved are required',
      }, { status: 400 });
    }

    const client = await pool.connect();
    try {
      await ensureSectionSchema(client);
      const status = approved ? 'approved' : 'rejected';

      if (assignment_type === 'action_date') {
        const result = await client.query(
          `UPDATE action_date_technicians SET approval_status = $1 WHERE id = $2 RETURNING id`,
          [status, assignment_id]
        );
        if (result.rows.length === 0) {
          return NextResponse.json<ApiResponse<null>>({
            success: false,
            error: 'Assignment not found',
          }, { status: 404 });
        }
      } else if (assignment_type === 'action') {
        const result = await client.query(
          `UPDATE action_technicians SET approval_status = $1 WHERE id = $2 RETURNING id`,
          [status, assignment_id]
        );
        if (result.rows.length === 0) {
          return NextResponse.json<ApiResponse<null>>({
            success: false,
            error: 'Assignment not found',
          }, { status: 404 });
        }
      } else {
        return NextResponse.json<ApiResponse<null>>({
          success: false,
          error: 'Invalid assignment_type',
        }, { status: 400 });
      }

      return NextResponse.json<ApiResponse<null>>({
        success: true,
        message: approved ? 'Technician assignment approved' : 'Technician assignment rejected',
      });
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Review technician assignment error:', error);
    return NextResponse.json<ApiResponse<null>>({
      success: false,
      error: 'Internal server error',
    }, { status: 500 });
  }
}
