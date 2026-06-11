import { NextRequest, NextResponse } from 'next/server';
import pool from '../../../../lib/database';
import { WorkOrder, ApiResponse } from '../../../../types';
import { requireRoleAtLeast } from '@/app/api/middleware';
import { ensureSectionSchema } from '@/app/lib/ensureSections';
import { assertWorkOrderAccess } from '@/app/lib/sectionAccess';

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = requireRoleAtLeast(request, 'incharge');
  if (auth instanceof NextResponse) return auth;
  try {
    const { id } = await params;
    const workOrderId = parseInt(id);
    const body = await request.json();
    const { approved, rejection_reason, work_completed_date } = body as {
      approved?: boolean;
      rejection_reason?: string;
      work_completed_date?: string;
    };

    if (isNaN(workOrderId)) {
      return NextResponse.json<ApiResponse<null>>({
        success: false,
        error: 'Invalid work order ID',
      }, { status: 400 });
    }
    if (typeof approved !== 'boolean') {
      return NextResponse.json<ApiResponse<null>>({
        success: false,
        error: 'Approval status is required',
      }, { status: 400 });
    }

    const client = await pool.connect();
    try {
      await ensureSectionSchema(client);
      const access = await assertWorkOrderAccess(client, auth, workOrderId);
      if (!access.ok) return access.response;

      const workOrderQuery = await client.query(`
        SELECT status, completion_review_stage, completion_requested_by, work_completed_date
        FROM work_orders
        WHERE id = $1
      `, [workOrderId]);

      if (workOrderQuery.rows.length === 0) {
        return NextResponse.json<ApiResponse<null>>({
          success: false,
          error: 'Work order not found',
        }, { status: 404 });
      }

      const workOrder = workOrderQuery.rows[0];
      if (workOrder.status !== 'completion_requested') {
        return NextResponse.json<ApiResponse<null>>({
          success: false,
          error: 'No completion request pending for this work order',
        }, { status: 400 });
      }

      const stage = workOrder.completion_review_stage || 'incharge';
      if (stage !== 'incharge') {
        return NextResponse.json<ApiResponse<null>>({
          success: false,
          error: 'This completion request is not awaiting incharge review',
        }, { status: 400 });
      }

      let updateQuery: string;
      let queryParams: (string | number | null)[];

      if (approved) {
        updateQuery = `
          UPDATE work_orders
          SET
            completion_review_stage = 'admin',
            incharge_reviewed_by = $1,
            incharge_reviewed_at = CURRENT_TIMESTAMP,
            work_completed_date = COALESCE($2, work_completed_date),
            incharge_rejection_reason = NULL,
            updated_at = CURRENT_TIMESTAMP
          WHERE id = $3
          RETURNING *
        `;
        queryParams = [auth.user.userId, work_completed_date || null, workOrderId];
      } else {
        if (!rejection_reason?.trim()) {
          return NextResponse.json<ApiResponse<null>>({
            success: false,
            error: 'Rejection reason is required when rejecting completion',
          }, { status: 400 });
        }
        updateQuery = `
          UPDATE work_orders
          SET
            status = 'ongoing',
            completion_review_stage = NULL,
            incharge_rejection_reason = $1,
            completion_rejection_reason = $1,
            updated_at = CURRENT_TIMESTAMP
          WHERE id = $2
          RETURNING *
        `;
        queryParams = [rejection_reason.trim(), workOrderId];
      }

      const result = await client.query(updateQuery, queryParams);
      const updatedWorkOrder = result.rows[0];

      if (workOrder.completion_requested_by) {
        const notificationTitle = approved
          ? 'Completion Request Forwarded to Admin'
          : 'Work Order Completion Rejected by Incharge';
        const notificationMessage = approved
          ? 'Your completion request has been reviewed by the incharge and forwarded to admin for final approval.'
          : `Your completion request was rejected by the incharge. Reason: ${rejection_reason?.trim()}`;
        await client.query(`
          INSERT INTO notifications (user_id, title, message, type, related_entity_type, related_entity_id)
          VALUES ($1, $2, $3, $4, $5, $6)
        `, [
          workOrder.completion_requested_by,
          notificationTitle,
          notificationMessage,
          approved ? 'approval' : 'rejection',
          'work_order',
          workOrderId,
        ]);
      }

      return NextResponse.json<ApiResponse<WorkOrder>>({
        success: true,
        data: updatedWorkOrder,
      });
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Incharge review completion error:', error);
    return NextResponse.json<ApiResponse<null>>({
      success: false,
      error: 'Internal server error',
    }, { status: 500 });
  }
}
