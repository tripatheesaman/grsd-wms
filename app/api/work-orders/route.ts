import { NextRequest, NextResponse } from 'next/server';
import pool from '../../lib/database';
import { WorkOrder, ApiResponse } from '../../types';
import { requireRoleAtLeast } from '@/app/api/middleware';

export async function POST(request: NextRequest) {
  const auth = requireRoleAtLeast(request, 'user');
  if (auth instanceof NextResponse) return auth;

  try {
    const body = await request.json();
    const {
      work_order_no,
      work_order_date,
      equipment_number,
      km_hrs,
      requested_by,
      work_type,
      job_allocation_time,
      description,
      reference_document
    } = body;

    const client = await pool.connect();
    try {
      const existingOrder = await client.query(
        'SELECT id, work_order_no FROM work_orders WHERE work_order_no = $1',
        [work_order_no]
      );

      if (existingOrder.rows.length > 0) {
        return NextResponse.json<ApiResponse<null>>({
          success: false,
          error: `Work order number "${work_order_no}" already exists. Please use a unique number.`
        }, { status: 400 });
      }

      const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
      if (!dateRegex.test(work_order_date)) {
        return NextResponse.json<ApiResponse<null>>({
          success: false,
          error: 'Invalid work order date format. Expected YYYY-MM-DD format.'
        }, { status: 400 });
      }

      const result = await client.query(`
        INSERT INTO work_orders (
          work_order_no, work_order_date, equipment_number, km_hrs,
          requested_by, requested_by_id, work_type, job_allocation_time, description, reference_document, status
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        RETURNING *
      `, [
        work_order_no,
        work_order_date,
        equipment_number,
        km_hrs,
        requested_by,
        auth.user.userId,
        work_type,
        job_allocation_time,
        (description ?? '').toString().trim(),
        reference_document || null,
        'pending'
      ]);

      const workOrder = result.rows[0];

      return NextResponse.json<ApiResponse<WorkOrder>>({
        success: true,
        data: workOrder
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

export async function GET(request: NextRequest) {
  const auth = requireRoleAtLeast(request, 'user');
  if (auth instanceof NextResponse) return auth;

  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');

    const client = await pool.connect();
    try {
      let query = 'SELECT * FROM work_orders ORDER BY created_at DESC';
      let params: string[] = [];

      if (status && status !== 'all') {
        if (status.includes(',')) {
          const statusArray = status.split(',').map(s => s.trim());
          const placeholders = statusArray.map((_, index) => `$${index + 1}`).join(', ');
          query = `SELECT * FROM work_orders WHERE status IN (${placeholders}) ORDER BY created_at DESC`;
          params = statusArray;
        } else {
          query = 'SELECT * FROM work_orders WHERE status = $1 ORDER BY created_at DESC';
          params = [status];
        }
      }

      const result = await client.query(query, params);
      const workOrders = result.rows;

      return NextResponse.json<ApiResponse<WorkOrder[]>>({
        success: true,
        data: workOrders
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