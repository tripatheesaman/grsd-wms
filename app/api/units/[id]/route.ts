import { NextRequest, NextResponse } from 'next/server';
import pool from '../../../lib/database';
import { ApiResponse, Unit } from '../../../types';
import { requireRoleAtLeast } from '@/app/api/middleware';
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = requireRoleAtLeast(request, 'admin');
  if (auth instanceof NextResponse) return auth;
  try {
    const { id } = await params;
    const unitId = parseInt(id);
    if (isNaN(unitId)) {
      return NextResponse.json<ApiResponse<null>>({ success: false, error: 'Invalid unit ID' }, { status: 400 });
    }
    const body = await request.json();
    const name = (body?.name || '').trim();
    if (!name) {
      return NextResponse.json<ApiResponse<null>>({ success: false, error: 'Unit name is required' }, { status: 400 });
    }
    if (name.length > 32) {
      return NextResponse.json<ApiResponse<null>>({ success: false, error: 'Unit name too long' }, { status: 400 });
    }
    const client = await pool.connect();
    try {
      const result = await client.query(
        'UPDATE units SET name = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 RETURNING id, name, created_at, updated_at',
        [name, unitId]
      );
      if (result.rows.length === 0) {
        return NextResponse.json<ApiResponse<null>>({ success: false, error: 'Unit not found' }, { status: 404 });
      }
      return NextResponse.json<ApiResponse<Unit>>({ success: true, data: result.rows[0] });
    } finally {
      client.release();
    }
  } catch {
    return NextResponse.json<ApiResponse<null>>({ success: false, error: 'Failed to update unit' }, { status: 500 });
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
    const unitId = parseInt(id);
    if (isNaN(unitId)) {
      return NextResponse.json<ApiResponse<null>>({ success: false, error: 'Invalid unit ID' }, { status: 400 });
    }
    const client = await pool.connect();
    try {
      const inUse = await client.query('SELECT 1 FROM spare_parts WHERE unit = (SELECT name FROM units WHERE id = $1) LIMIT 1', [unitId]);
      if (inUse.rows.length > 0) {
        return NextResponse.json<ApiResponse<null>>({ success: false, error: 'Unit is in use and cannot be deleted' }, { status: 409 });
      }
      const result = await client.query('DELETE FROM units WHERE id = $1 RETURNING id', [unitId]);
      if (result.rows.length === 0) {
        return NextResponse.json<ApiResponse<null>>({ success: false, error: 'Unit not found' }, { status: 404 });
      }
      return NextResponse.json<ApiResponse<null>>({ success: true, message: 'Unit deleted' });
    } finally {
      client.release();
    }
  } catch {
    return NextResponse.json<ApiResponse<null>>({ success: false, error: 'Failed to delete unit' }, { status: 500 });
  }
}
