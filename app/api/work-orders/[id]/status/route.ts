import { NextRequest, NextResponse } from 'next/server';
import pool from '../../../../lib/database';
import { WorkOrder, ApiResponse } from '../../../../types';
import { requireRoleAtLeast } from '@/app/api/middleware';
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = requireRoleAtLeast(request, 'admin');
  if (auth instanceof NextResponse) return auth;
  try {
    const { id } = await params;
    const workOrderId = parseInt(id);
    const body = await request.json();
    const { status } = body;
    if (isNaN(workOrderId)) {
      return NextResponse.json<ApiResponse<null>>({
        success: false,
        error: 'Invalid work order ID'
      }, { status: 400 });
    }
    if (!status || !['pending', 'ongoing', 'completed','rejected'].includes(status)) {
      return NextResponse.json<ApiResponse<null>>({
        success: false,
        error: 'Valid status is required'
      }, { status: 400 });
    }
    const client = await pool.connect();
    try {
      const result = await client.query(`
        UPDATE work_orders 
        SET status = $1, updated_at = CURRENT_TIMESTAMP
        WHERE id = $2
        RETURNING *
      `, [status, workOrderId]);
      if (result.rows.length === 0) {
        return NextResponse.json<ApiResponse<null>>({
          success: false,
          error: 'Work order not found'
        }, { status: 404 });
      }
      const workOrder = result.rows[0];
      return NextResponse.json<ApiResponse<WorkOrder>>({
        success: true,
        data: workOrder
      });
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Update work order status error:', error);
    return NextResponse.json<ApiResponse<null>>({
      success: false,
      error: 'Internal server error'
    }, { status: 500 });
  }
} 