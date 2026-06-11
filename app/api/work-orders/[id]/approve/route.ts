import { NextRequest, NextResponse } from 'next/server';
import pool from '@/app/lib/database';
import { ApiResponse, WorkOrder } from '@/app/types';
import { requireRoleAtLeast } from '@/app/api/middleware';
import { createWorkOrderApprovalNotification } from '@/app/lib/notifications';

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

  const body = await request.json();
  const { reference_document } = body as { reference_document?: string };

  const client = await pool.connect();
  try {
    const updateFields = [
      'status = $1',
      'approved_by = $2', 
      'approved_at = CURRENT_TIMESTAMP',
      'rejection_reason = NULL',
      'updated_at = CURRENT_TIMESTAMP'
    ];
    const values = ['ongoing', auth.user.userId];
    let paramIndex = 3;

    if (reference_document !== undefined) {
      updateFields.push(`reference_document = $${paramIndex++}`);
      values.push(reference_document);
    }

    values.push(workOrderId);

    const result = await client.query(
      `UPDATE work_orders
       SET ${updateFields.join(', ')}
       WHERE id = $${paramIndex} AND status = 'pending'
       RETURNING *`,
      values
    );
    if (result.rows.length === 0) {
      return NextResponse.json({ success: false, error: 'Work order not found or not pending' }, { status: 400 });
    }

    const approvedWorkOrder = result.rows[0];

    try {
      await createWorkOrderApprovalNotification(workOrderId, auth.user.userId);
    } catch (notificationError) {
      console.error('Failed to create notification:', notificationError);
    }

    return NextResponse.json<ApiResponse<WorkOrder>>({ 
      success: true, 
      data: approvedWorkOrder,
      message: 'Work order approved successfully'
    });
  } catch (e) {
    console.error('Approve work order error:', e);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  } finally {
    client.release();
  }
}

