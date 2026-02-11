import { NextRequest, NextResponse } from 'next/server';
import pool from '@/app/lib/database';
import { ApiResponse, WorkOrder } from '@/app/types';
import { requireRoleAtLeast } from '@/app/api/middleware';
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = requireRoleAtLeast(request, 'user');
  if (auth instanceof NextResponse) return auth;
  const { id } = await params;
  const workOrderId = parseInt(id);
  if (isNaN(workOrderId)) {
    return NextResponse.json({ success: false, error: 'Invalid work order ID' }, { status: 400 });
  }
  const client = await pool.connect();
  try {
    const workOrderResult = await client.query(
      'SELECT * FROM work_orders WHERE id = $1',
      [workOrderId]
    );
    if (workOrderResult.rows.length === 0) {
      return NextResponse.json({ success: false, error: 'Work order not found' }, { status: 404 });
    }
    const workOrder = workOrderResult.rows[0];
    if (workOrder.status !== 'rejected') {
      return NextResponse.json({ 
        success: false, 
        error: 'Only rejected work orders can be resubmitted' 
      }, { status: 400 });
    }
    if (workOrder.requested_by_id !== auth.user.userId) {
      return NextResponse.json({ 
        success: false, 
        error: 'Only the work order creator can resubmit it' 
      }, { status: 403 });
    }
    const result = await client.query(
      `UPDATE work_orders
       SET status = 'pending', 
           rejection_reason = NULL,
           approved_by = NULL,
           approved_at = NULL,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $1 AND status = 'rejected'
       RETURNING *`,
      [workOrderId]
    );
    if (result.rows.length === 0) {
      return NextResponse.json({ 
        success: false, 
        error: 'Failed to resubmit work order' 
      }, { status: 500 });
    }
    const resubmittedWorkOrder = result.rows[0];
    return NextResponse.json<ApiResponse<WorkOrder>>({ 
      success: true, 
      data: resubmittedWorkOrder,
      message: 'Work order resubmitted successfully'
    });
  } catch (error) {
    console.error('Resubmit work order error:', error);
    return NextResponse.json<ApiResponse<null>>({ 
      success: false, 
      error: 'Internal server error' 
    }, { status: 500 });
  } finally {
    client.release();
  }
}
