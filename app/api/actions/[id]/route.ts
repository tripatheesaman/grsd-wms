import { NextRequest, NextResponse } from 'next/server';
import pool from '../../../lib/database';
import { Action, ApiResponse } from '../../../types';
import { requireRoleAtLeast } from '@/app/api/middleware';
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = requireRoleAtLeast(request, 'admin');
  if (auth instanceof NextResponse) return auth;
  try {
    const { id } = await params;
    const actionId = parseInt(id);
    const body = await request.json();
  const { description, action_date, start_time, end_time, remarks } = body;
    if (isNaN(actionId)) {
      return NextResponse.json<ApiResponse<null>>({
        success: false,
        error: 'Invalid action ID'
      }, { status: 400 });
    }
    const client = await pool.connect();
    try {
      const currentActionQuery = await client.query(`
        SELECT a.*, f.work_order_id, wo.work_order_date
        FROM actions a
        JOIN findings f ON f.id = a.finding_id
        JOIN work_orders wo ON wo.id = f.work_order_id
        WHERE a.id = $1
      `, [actionId]);
      if (currentActionQuery.rows.length === 0) {
        return NextResponse.json<ApiResponse<null>>({
          success: false,
          error: 'Action not found'
        }, { status: 404 });
      }
      const currentAction = currentActionQuery.rows[0];
      const workOrderDate = currentAction.work_order_date;
      if (new Date(action_date) < new Date(workOrderDate)) {
        return NextResponse.json<ApiResponse<null>>({
          success: false,
          error: `Action date cannot be before work order date (${new Date(workOrderDate).toLocaleDateString('en-GB')})`
        }, { status: 400 });
      }
      const startTimestamp = `${action_date}T${start_time}:00`;
      const endTimestamp = `${action_date}T${end_time}:00`;
      try {
        const result = await client.query(`
          UPDATE actions 
          SET description = $1, action_date = $2, start_time = $3, end_time = $4, remarks = $5, updated_at = CURRENT_TIMESTAMP
          WHERE id = $6
          RETURNING *
        `, [description, action_date, startTimestamp, endTimestamp, remarks || null, actionId]);
        if (result.rows.length === 0) {
          return NextResponse.json<ApiResponse<null>>({
            success: false,
            error: 'Action not found'
          }, { status: 404 });
        }
        const action = result.rows[0];
        return NextResponse.json<ApiResponse<Action>>({
          success: true,
          data: action
        });
      } catch (err: unknown) {
        if (err && typeof err === 'object' && 'code' in err) {
          const e = err as { code?: string };
          if (e.code === '42703') {
            return NextResponse.json<ApiResponse<null>>({
              success: false,
              error: 'Database schema missing "remarks" column on actions. Please add the column `remarks text` to enable action remarks.'
            }, { status: 500 });
          }
        }
        throw err;
      }
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
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = requireRoleAtLeast(request, 'admin');
  if (auth instanceof NextResponse) return auth;
  try {
    const { id } = await params;
    const actionId = parseInt(id);
    if (isNaN(actionId)) {
      return NextResponse.json<ApiResponse<null>>({
        success: false,
        error: 'Invalid action ID'
      }, { status: 400 });
    }
    const client = await pool.connect();
    try {
      const result = await client.query(
        'DELETE FROM actions WHERE id = $1 RETURNING id',
        [actionId]
      );
      if (result.rows.length === 0) {
        return NextResponse.json<ApiResponse<null>>({
          success: false,
          error: 'Action not found'
        }, { status: 404 });
      }
      return NextResponse.json<ApiResponse<null>>({
        success: true,
        message: 'Action deleted successfully'
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