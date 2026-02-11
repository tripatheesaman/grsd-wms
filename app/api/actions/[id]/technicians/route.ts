import { NextRequest, NextResponse } from 'next/server';
import pool from '@/app/lib/database';
import { ActionTechnician, ApiResponse } from '@/app/types';
import { requireRoleAtLeast } from '@/app/api/middleware';
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const actionId = parseInt(id);
    if (isNaN(actionId)) {
      return NextResponse.json<ApiResponse<null>>({ success: false, error: 'Invalid action ID' }, { status: 400 });
    }
    const client = await pool.connect();
    try {
      const result = await client.query(
        'SELECT id, action_id, technician_id, name, staff_id, created_at FROM action_technicians WHERE action_id = $1 ORDER BY created_at ASC',
        [actionId]
      );
      return NextResponse.json<ApiResponse<ActionTechnician[]>>({ success: true, data: result.rows });
    } finally {
      client.release();
    }
  } catch {
    return NextResponse.json<ApiResponse<null>>({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = requireRoleAtLeast(request, 'user');
  if (auth instanceof NextResponse) return auth;
  try {
    const { id } = await params;
    const actionId = parseInt(id);
    if (isNaN(actionId)) {
      return NextResponse.json<ApiResponse<null>>({ success: false, error: 'Invalid action ID' }, { status: 400 });
    }
    const body = await request.json();
    const { technician_id, name, staff_id } = body || {};
    if ((!technician_id || typeof technician_id !== 'number') && (!name || !staff_id)) {
      return NextResponse.json<ApiResponse<null>>({ success: false, error: 'Provide technician_id or name and staff_id' }, { status: 400 });
    }
    const client = await pool.connect();
    try {
      let insertName = name;
      let insertStaffId = staff_id;
      const insertTechnicianId = technician_id;
      if (technician_id) {
        const tech = await client.query('SELECT id, name, staff_id FROM technicians WHERE id = $1', [technician_id]);
        if (tech.rows.length === 0) {
          return NextResponse.json<ApiResponse<null>>({ success: false, error: 'Technician not found' }, { status: 404 });
        }
        insertName = tech.rows[0].name;
        insertStaffId = tech.rows[0].staff_id;
      }
      if (!insertName || !insertStaffId) {
        return NextResponse.json<ApiResponse<null>>({ success: false, error: 'Name and staff_id are required' }, { status: 400 });
      }
      const result = await client.query(
        `INSERT INTO action_technicians (action_id, technician_id, name, staff_id)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (action_id, staff_id) DO NOTHING
         RETURNING id, action_id, technician_id, name, staff_id, created_at`,
        [actionId, insertTechnicianId || null, insertName.trim(), insertStaffId.trim()]
      );
      if (result.rows.length === 0) {
        return NextResponse.json<ApiResponse<null>>({ success: false, error: 'Technician already added' }, { status: 409 });
      }
      return NextResponse.json<ApiResponse<ActionTechnician>>({ success: true, data: result.rows[0] });
    } finally {
      client.release();
    }
  } catch {
    return NextResponse.json<ApiResponse<null>>({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = requireRoleAtLeast(request, 'admin');
  if (auth instanceof NextResponse) return auth;
  try {
    const { id } = await params;
    const actionId = parseInt(id);
    const searchParams = new URL(request.url).searchParams;
    const atId = parseInt(searchParams.get('action_technician_id') || '');
    if (isNaN(actionId) || isNaN(atId)) {
      return NextResponse.json<ApiResponse<null>>({ success: false, error: 'Invalid IDs' }, { status: 400 });
    }
    const client = await pool.connect();
    try {
      const result = await client.query('DELETE FROM action_technicians WHERE id = $1 AND action_id = $2 RETURNING id', [atId, actionId]);
      if (result.rows.length === 0) {
        return NextResponse.json<ApiResponse<null>>({ success: false, error: 'Assignment not found' }, { status: 404 });
      }
      return NextResponse.json<ApiResponse<null>>({ success: true, message: 'Technician removed' });
    } finally {
      client.release();
    }
  } catch {
    return NextResponse.json<ApiResponse<null>>({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
