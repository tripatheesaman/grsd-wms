import { NextRequest, NextResponse } from 'next/server';
import pool from '../../../../lib/database';
import { WorkOrder, ApiResponse } from '../../../../types';
import { requireRoleAtLeast } from '@/app/api/middleware';
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = requireRoleAtLeast(request, 'superadmin');
  if (auth instanceof NextResponse) return auth;
  try {
    const { id } = await params;
    const workOrderId = parseInt(id);
    const body = await request.json();
    const { approved, rejection_reason } = body;
    if (isNaN(workOrderId)) {
      return NextResponse.json<ApiResponse<null>>({
        success: false,
        error: 'Invalid work order ID'
      }, { status: 400 });
    }
    if (typeof approved !== 'boolean') {
      return NextResponse.json<ApiResponse<null>>({
        success: false,
        error: 'Approval status is required'
      }, { status: 400 });
    }
    const client = await pool.connect();
    try {
      const workOrderQuery = await client.query(`
        SELECT status, completion_requested_by, work_completed_date
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
      if (workOrder.status !== 'completion_requested') {
        return NextResponse.json<ApiResponse<null>>({
          success: false,
          error: 'No completion request pending for this work order'
        }, { status: 400 });
      }
      let updateQuery: string;
      let queryParams: (string | number)[];
      if (approved) {
        const missingEndTimes = await client.query(`
          SELECT ad.id, ad.action_id, ad.action_date
          FROM action_dates ad
          JOIN actions a ON a.id = ad.action_id
          JOIN findings f ON f.id = a.finding_id
          WHERE f.work_order_id = $1 AND (ad.end_time IS NULL OR trim(ad.end_time::text) = '')
          ORDER BY ad.action_date DESC
        `, [workOrderId]);
        if (missingEndTimes.rows.length > 0) {
          return NextResponse.json<ApiResponse<unknown>>({
            success: false,
            error: 'Cannot approve completion: some action dates are missing end time.',
            data: { missing_end_times: missingEndTimes.rows }
          }, { status: 400 });
        }
        updateQuery = `
          UPDATE work_orders 
          SET 
            status = 'completed', 
            completion_approved_by = $1,
            completion_approved_at = CURRENT_TIMESTAMP,
            updated_at = CURRENT_TIMESTAMP
          WHERE id = $2
          RETURNING *
        `;
        queryParams = [auth.user.userId, workOrderId];
      } else {
        if (!rejection_reason) {
          return NextResponse.json<ApiResponse<null>>({
            success: false,
            error: 'Rejection reason is required when rejecting completion'
          }, { status: 400 });
        }
        updateQuery = `
          UPDATE work_orders 
          SET 
            status = 'ongoing', 
            completion_rejection_reason = $1,
            updated_at = CURRENT_TIMESTAMP
          WHERE id = $2
          RETURNING *
        `;
        queryParams = [rejection_reason, workOrderId];
      }
      const result = await client.query(updateQuery, queryParams);
      const updatedWorkOrder = result.rows[0];
      if (workOrder.completion_requested_by) {
        const notificationTitle = approved ? 'Work Order Completion Approved' : 'Work Order Completion Rejected';
        const notificationMessage = approved 
          ? `Your completion request for work order has been approved.`
          : `Your completion request for work order has been rejected. Reason: ${rejection_reason}`;
        await client.query(`
          INSERT INTO notifications (user_id, title, message, type, related_entity_type, related_entity_id)
          VALUES ($1, $2, $3, $4, $5, $6)
        `, [
          workOrder.completion_requested_by,
          notificationTitle,
          notificationMessage,
          approved ? 'approval' : 'rejection',
          'work_order',
          workOrderId
        ]);
      }
      return NextResponse.json<ApiResponse<WorkOrder>>({
        success: true,
        data: updatedWorkOrder
      });
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Approve completion error:', error);
    return NextResponse.json<ApiResponse<null>>({
      success: false,
      error: 'Internal server error'
    }, { status: 500 });
  }
}
