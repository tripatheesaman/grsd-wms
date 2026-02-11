import { NextRequest, NextResponse } from 'next/server';
import pool from '@/app/lib/database';
import { ApiResponse, WorkOrder } from '@/app/types';
import { requireRoleAtLeast } from '@/app/api/middleware';
import { createWorkOrderRejectionNotification } from '@/app/lib/notifications';

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = requireRoleAtLeast(request, 'admin');
  if (auth instanceof NextResponse) return auth;
  const { id } = await params;
  const workOrderId = parseInt(id);
  if (isNaN(workOrderId)) {
    return NextResponse.json({ success: false, error: 'Invalid work order ID' }, { status: 400 });
  }

  const { reason } = await request.json().catch(() => ({ reason: null as string | null }));

  if (!reason || reason.trim().length === 0) {
    return NextResponse.json({ 
      success: false, 
      error: 'Rejection reason is required' 
    }, { status: 400 });
  }

  const client = await pool.connect();
  try {
    const result = await client.query(
      `UPDATE work_orders
       SET status = 'rejected', approved_by = NULL, approved_at = NULL, rejection_reason = $1, updated_at = CURRENT_TIMESTAMP
       WHERE id = $2 AND status IN ('pending','ongoing')
       RETURNING *`,
      [reason.trim(), workOrderId]
    );
    if (result.rows.length === 0) {
      return NextResponse.json({ success: false, error: 'Work order not found' }, { status: 404 });
    }

    const rejectedWorkOrder = result.rows[0];

    try {
      await createWorkOrderRejectionNotification(workOrderId, auth.user.userId, reason.trim());
    } catch (notificationError) {
      console.error('Failed to create notification:', notificationError);
    }

    return NextResponse.json<ApiResponse<WorkOrder>>({ 
      success: true, 
      data: rejectedWorkOrder,
      message: 'Work order rejected successfully'
    });
  } catch (e) {
    console.error('Reject work order error:', e);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  } finally {
    client.release();
  }
}

