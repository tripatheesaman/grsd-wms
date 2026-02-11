import { NextRequest, NextResponse } from 'next/server';
import pool from '../../../lib/database';
import { WorkOrder, ApiResponse } from '../../../types';
import { requireAuth } from '@/app/api/middleware';
import { unlink } from 'fs/promises';
import { join } from 'path';

interface WorkOrderDetail extends WorkOrder {
  completion_approved_by_name?: string;
  completion_requested_by_name?: string;
  findings: Array<{
    id: number;
    work_order_id: number;
    description: string;
    reference_image?: string;
    created_at: string;
    updated_at: string;
    actions: Array<{
      id: number;
      finding_id: number;
      description: string;
      action_date: string;
      start_time: string;
      end_time: string;
      created_at: string;
      updated_at: string;
      spare_parts: Array<{
        id: number;
        action_id: number;
        part_name: string;
        part_number: string;
        quantity: number;
        unit?: string;
        created_at: string;
        updated_at: string;
      }>;
      technicians: Array<{
        id: number;
        action_id: number;
        technician_id?: number;
        name: string;
        staff_id: string;
        created_at: string;
      }>;
    }>;
  }>;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const workOrderId = parseInt(id);
    if (isNaN(workOrderId)) {
      return NextResponse.json<ApiResponse<null>>({
        success: false,
        error: 'Invalid work order ID'
      }, { status: 400 });
    }

    const client = await pool.connect();
    try {
      const workOrderResult = await client.query(`
        SELECT wo.*, 
               CONCAT(approver.first_name, ' ', approver.last_name) as completion_approved_by_name,
               CONCAT(requester.first_name, ' ', requester.last_name) as completion_requested_by_name
        FROM work_orders wo
        LEFT JOIN users approver ON wo.completion_approved_by = approver.id
        LEFT JOIN users requester ON wo.completion_requested_by = requester.id
        WHERE wo.id = $1
      `, [workOrderId]);

      if (workOrderResult.rows.length === 0) {
        return NextResponse.json<ApiResponse<null>>({
          success: false,
          error: 'Work order not found'
        }, { status: 404 });
      }

      const workOrder = workOrderResult.rows[0];

      const findingsResult = await client.query(`
        SELECT f.*, 
               COALESCE(
                 json_agg(
                   json_build_object(
                     'id', a.id,
                     'finding_id', a.finding_id,
                     'description', a.description,
                     'action_date', a.action_date,
                     'start_time', a.start_time,
                     'end_time', a.end_time,
                     'remarks', a.remarks,
                     'created_at', a.created_at,
                     'updated_at', a.updated_at,
                     'spare_parts', COALESCE(
                       (SELECT json_agg(
                         json_build_object(
                           'id', sp.id,
                           'action_id', sp.action_id,
                           'part_name', sp.part_name,
                           'part_number', sp.part_number,
                           'quantity', sp.quantity,
                           'unit', sp.unit,
                           'created_at', sp.created_at,
                           'updated_at', sp.updated_at
                         )
                       ) FROM spare_parts sp WHERE sp.action_id = a.id), 
                       '[]'::json
                     ),
                     'technicians', COALESCE(
                       (SELECT json_agg(
                         json_build_object(
                           'id', at.id,
                           'action_id', at.action_id,
                           'technician_id', at.technician_id,
                           'name', at.name,
                           'staff_id', at.staff_id,
                           'created_at', at.created_at
                         )
                       ) FROM action_technicians at WHERE at.action_id = a.id),
                       '[]'::json
                     )
                   )
                 ) FILTER (WHERE a.id IS NOT NULL), 
                 '[]'::json
               ) as actions
        FROM findings f
        LEFT JOIN actions a ON f.id = a.finding_id
        WHERE f.work_order_id = $1
        GROUP BY f.id, f.work_order_id, f.description, f.reference_image, f.created_at, f.updated_at
        ORDER BY f.created_at DESC
      `, [workOrderId]);

      const workOrderDetail: WorkOrderDetail = {
        ...workOrder,
        findings: findingsResult.rows || []
      } as unknown as WorkOrderDetail;

      return NextResponse.json<ApiResponse<WorkOrderDetail>>({
        success: true,
        data: workOrderDetail
      });

    } finally {
      client.release();
    }

  } catch (error) {
    console.error('Get work order detail error:', error);
    return NextResponse.json<ApiResponse<null>>({
      success: false,
      error: 'Internal server error'
    }, { status: 500 });
  }
} 

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = requireAuth(request);
  if (auth instanceof NextResponse) return auth;
  const { user } = auth;

  try {
    const { id } = await params;
    const workOrderId = parseInt(id);
    if (isNaN(workOrderId)) {
      return NextResponse.json<ApiResponse<null>>({ success: false, error: 'Invalid work order ID' }, { status: 400 });
    }

    const body = await request.json();
    const {
      work_order_no,
      work_order_date,
      equipment_number,
      km_hrs,
      requested_by,
      work_type,
      job_allocation_time,
      reference_document,
      status,
    } = body as Partial<WorkOrder & { status: 'pending' | 'ongoing' | 'completed' | 'rejected' }>;

    const client = await pool.connect();
    try {
      const existing = await client.query('SELECT reference_document, requested_by_id, status FROM work_orders WHERE id = $1', [workOrderId]);
      if (existing.rows.length === 0) {
        return NextResponse.json({ success: false, error: 'Work order not found' }, { status: 404 });
      }

      const workOrder = existing.rows[0];
      const isAdmin = user.role === 'admin' || user.role === 'superadmin';
      const isCreatorOfRejected = user.userId === workOrder.requested_by_id && workOrder.status === 'rejected';
      if (!isAdmin && !isCreatorOfRejected) {
        return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
      }
      const oldDoc: string | null = existing.rows[0].reference_document || null;

      const fields: string[] = [];
      const values: unknown[] = [];
      let idx = 1;
      if (work_order_no !== undefined) { fields.push(`work_order_no = $${idx++}`); values.push(work_order_no); }
      if (work_order_date !== undefined) { fields.push(`work_order_date = $${idx++}`); values.push(work_order_date); }
      if (equipment_number !== undefined) { fields.push(`equipment_number = $${idx++}`); values.push(equipment_number); }
      if (km_hrs !== undefined) { fields.push(`km_hrs = $${idx++}`); values.push(km_hrs); }
      if (requested_by !== undefined) { fields.push(`requested_by = $${idx++}`); values.push(requested_by); }
      if (work_type !== undefined) { fields.push(`work_type = $${idx++}`); values.push(work_type); }
      if (job_allocation_time !== undefined) { fields.push(`job_allocation_time = $${idx++}`); values.push(job_allocation_time); }
      if (reference_document !== undefined) { fields.push(`reference_document = $${idx++}`); values.push(reference_document); }
      if (status !== undefined) { fields.push(`status = $${idx++}`); values.push(status); }
      fields.push(`updated_at = CURRENT_TIMESTAMP`);

      const query = `UPDATE work_orders SET ${fields.join(', ')} WHERE id = $${idx} RETURNING *`;
      values.push(workOrderId);
      const result = await client.query(query, values);
      const updated: WorkOrder = result.rows[0];

      if (reference_document && oldDoc && oldDoc !== reference_document) {
        try { await unlink(join(process.cwd(), 'public', oldDoc)); } catch {}
      }

      return NextResponse.json<ApiResponse<WorkOrder>>({ success: true, data: updated });
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Update work order error:', error);
    return NextResponse.json<ApiResponse<null>>({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = requireAuth(request);
  if (auth instanceof NextResponse) return auth;
  const { user } = auth;
  if (user.role !== 'admin' && user.role !== 'superadmin') {
    return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
  }
  try {
    const { id } = await params;
    const workOrderId = parseInt(id);
    if (isNaN(workOrderId)) {
      return NextResponse.json<ApiResponse<null>>({ success: false, error: 'Invalid work order ID' }, { status: 400 });
    }

    const client = await pool.connect();
    try {
      const docRes = await client.query('SELECT reference_document FROM work_orders WHERE id = $1', [workOrderId]);
      if (docRes.rows.length === 0) {
        return NextResponse.json({ success: false, error: 'Work order not found' }, { status: 404 });
      }
      const workDoc: string | null = docRes.rows[0].reference_document || null;
      const findImgs = await client.query('SELECT reference_image FROM findings WHERE work_order_id = $1', [workOrderId]);
      const imgPaths: string[] = findImgs.rows.map((r: { reference_image?: string }) => r.reference_image).filter((img): img is string => img !== null && img !== undefined);

      await client.query('DELETE FROM work_orders WHERE id = $1', [workOrderId]);

      const toDelete = [...imgPaths, ...(workDoc ? [workDoc] : [])];
      await Promise.all(toDelete.map(async (p) => {
        try { await unlink(join(process.cwd(), 'public', p)); } catch {}
      }));

      return NextResponse.json({ success: true, message: 'Work order deleted' });
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Delete work order error:', error);
    return NextResponse.json<ApiResponse<null>>({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}