import { NextRequest, NextResponse } from 'next/server';
import pool from '../../../../lib/database';
import { WorkOrder, ApiResponse } from '../../../../types';
import { requireRoleAtLeast } from '@/app/api/middleware';
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = requireRoleAtLeast(request, 'user');
  if (auth instanceof NextResponse) return auth;
  try {
    const { id } = await params;
    const workOrderId = parseInt(id);
    const body = await request.json();
    const { work_completed_date } = body;
    if (isNaN(workOrderId)) {
      return NextResponse.json<ApiResponse<null>>({
        success: false,
        error: 'Invalid work order ID'
      }, { status: 400 });
    }
    if (!work_completed_date) {
      return NextResponse.json<ApiResponse<null>>({
        success: false,
        error: 'Completion date is required'
      }, { status: 400 });
    }
    const client = await pool.connect();
    try {
      const workOrderQuery = await client.query(`
        SELECT work_order_date, status 
        FROM work_orders 
        WHERE id = $1
      `, [workOrderId]);
      if (workOrderQuery.rows.length === 0) {
        return NextResponse.json<ApiResponse<null>>({
          success: false,
          error: 'Work order not found'
        }, { status: 404 });
      }
      const workOrder = workOrderQuery.rows[0];
      if (workOrder.status === 'completed') {
        return NextResponse.json<ApiResponse<null>>({
          success: false,
          error: 'Work order is already completed'
        }, { status: 400 });
      }
      if (workOrder.status === 'completion_requested') {
        return NextResponse.json<ApiResponse<null>>({
          success: false,
          error: 'Completion request is already pending approval'
        }, { status: 400 });
      }
      if (new Date(work_completed_date) < new Date(workOrder.work_order_date)) {
        return NextResponse.json<ApiResponse<null>>({
          success: false,
          error: `Completion date cannot be before work order date (${new Date(workOrder.work_order_date).toLocaleDateString('en-GB')})`
        }, { status: 400 });
      }
      const latestActionQuery = await client.query(`
        SELECT MAX(a.action_date) as latest_action_date
        FROM actions a
        JOIN findings f ON f.id = a.finding_id
        WHERE f.work_order_id = $1
      `, [workOrderId]);
      if (latestActionQuery.rows[0].latest_action_date) {
        const latestActionDate = latestActionQuery.rows[0].latest_action_date;
        if (new Date(work_completed_date) < new Date(latestActionDate)) {
          return NextResponse.json<ApiResponse<null>>({
            success: false,
            error: `Completion date cannot be before the last action date (${new Date(latestActionDate).toLocaleDateString('en-GB')})`
          }, { status: 400 });
        }
      }
        const incompleteActions = await client.query(`
          SELECT a.id, a.description
          FROM actions a
          JOIN findings f ON f.id = a.finding_id
          LEFT JOIN LATERAL (
            SELECT ad.is_completed
            FROM action_dates ad
            WHERE ad.action_id = a.id
            ORDER BY (ad.action_date::date) DESC
            LIMIT 1
          ) latest ON true
          WHERE f.work_order_id = $1 AND (latest.is_completed IS DISTINCT FROM TRUE)
        `, [workOrderId]);
        if (incompleteActions.rows.length > 0) {
          return NextResponse.json<ApiResponse<unknown>>({
            success: false,
            error: 'All actions must be completed before requesting completion',
            data: { incomplete_actions: incompleteActions.rows }
          }, { status: 400 });
        }
        const missingEndTimes = await client.query(`
          SELECT COUNT(*) as cnt
          FROM action_dates ad
          JOIN actions a ON a.id = ad.action_id
          JOIN findings f ON f.id = a.finding_id
          WHERE f.work_order_id = $1 AND (ad.end_time IS NULL OR trim(ad.end_time::text) = '')
        `, [workOrderId]);
        if (parseInt(missingEndTimes.rows[0].cnt, 10) > 0) {
          const missingRows = await client.query(`
            SELECT ad.id as action_date_id, a.id as action_id, ad.action_date
            FROM action_dates ad
            JOIN actions a ON a.id = ad.action_id
            JOIN findings f ON f.id = a.finding_id
            WHERE f.work_order_id = $1 AND (ad.end_time IS NULL OR trim(ad.end_time::text) = '')
          `, [workOrderId]);
          return NextResponse.json<ApiResponse<unknown>>({
            success: false,
            error: 'All action end times must be filled before requesting completion',
            data: { missing_end_times: missingRows.rows }
          }, { status: 400 });
        }
      const result = await client.query(`
        UPDATE work_orders 
        SET 
          status = 'completion_requested', 
          work_completed_date = $1, 
          completion_requested_by = $2,
          completion_requested_at = CURRENT_TIMESTAMP,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = $3
        RETURNING *
      `, [work_completed_date, auth.user.userId, workOrderId]);
      const updatedWorkOrder = result.rows[0];
      return NextResponse.json<ApiResponse<WorkOrder>>({
        success: true,
        data: updatedWorkOrder
      });
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Complete work order error:', error);
    return NextResponse.json<ApiResponse<null>>({
      success: false,
      error: 'Internal server error'
    }, { status: 500 });
  }
} 