import { NextRequest, NextResponse } from 'next/server';
import pool from '../../lib/database';
import { Finding, ApiResponse } from '../../types';
import { requireRoleAtLeast } from '@/app/api/middleware';
export async function POST(request: NextRequest) {
  const auth = requireRoleAtLeast(request, 'admin');
  if (auth instanceof NextResponse) return auth;
  try {
    const body = await request.json();
    const {
      work_order_id,
      description,
      reference_image
    } = body;
    if (!work_order_id || !description) {
      return NextResponse.json<ApiResponse<null>>({
        success: false,
        error: 'Work order ID and description are required'
      }, { status: 400 });
    }
    if (typeof work_order_id !== 'number' || work_order_id <= 0) {
      return NextResponse.json<ApiResponse<null>>({
        success: false,
        error: 'Invalid work order ID'
      }, { status: 400 });
    }
    if (description.trim().length === 0) {
      return NextResponse.json<ApiResponse<null>>({
        success: false,
        error: 'Finding description cannot be empty'
      }, { status: 400 });
    }
    if (description.length > 1000) {
      return NextResponse.json<ApiResponse<null>>({
        success: false,
        error: 'Finding description must be less than 1000 characters'
      }, { status: 400 });
    }
    const client = await pool.connect();
    try {
      const workOrderCheck = await client.query(
        'SELECT id, status FROM work_orders WHERE id = $1',
        [work_order_id]
      );
      if (workOrderCheck.rows.length === 0) {
        return NextResponse.json<ApiResponse<null>>({
          success: false,
          error: 'Work order not found'
        }, { status: 404 });
      }
      if (workOrderCheck.rows[0].status === 'completed') {
        return NextResponse.json<ApiResponse<null>>({
          success: false,
          error: 'Cannot add findings to completed work orders'
        }, { status: 400 });
      }
      const result = await client.query(`
        INSERT INTO findings (
          work_order_id, description, reference_image
        ) VALUES ($1, $2, $3)
        RETURNING *
      `, [
        work_order_id,
        description.trim(),
        reference_image || null
      ]);
      const finding = result.rows[0];
      return NextResponse.json<ApiResponse<Finding>>({
        success: true,
        data: finding
      });
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Error creating finding:', error);
    return NextResponse.json<ApiResponse<null>>({
      success: false,
      error: 'Internal server error'
    }, { status: 500 });
  }
} 