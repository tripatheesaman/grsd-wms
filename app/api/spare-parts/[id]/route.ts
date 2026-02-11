import { NextRequest, NextResponse } from 'next/server';
import pool from '../../../lib/database';
import { SparePart, ApiResponse } from '../../../types';
import { requireRoleAtLeast } from '@/app/api/middleware';
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = requireRoleAtLeast(request, 'admin');
  if (auth instanceof NextResponse) return auth;
  try {
    const { id } = await params;
    const sparePartId = parseInt(id);
    const body = await request.json();
    const { part_name, part_number, quantity, unit = null } = body as {
      part_name?: string;
      part_number?: string;
      quantity?: number;
      unit?: string | null;
    };
    if (isNaN(sparePartId)) {
      return NextResponse.json<ApiResponse<null>>({
        success: false,
        error: 'Invalid spare part ID'
      }, { status: 400 });
    }
    const client = await pool.connect();
    try {
      const result = await client.query(`
        UPDATE spare_parts 
        SET part_name = $1, part_number = $2, quantity = $3, unit = $4, updated_at = CURRENT_TIMESTAMP
        WHERE id = $5
        RETURNING *
      `, [part_name, part_number, quantity, unit, sparePartId]);
      if (result.rows.length === 0) {
        return NextResponse.json<ApiResponse<null>>({
          success: false,
          error: 'Spare part not found'
        }, { status: 404 });
      }
      const sparePart = result.rows[0];
      return NextResponse.json<ApiResponse<SparePart>>({
        success: true,
        data: sparePart
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
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = requireRoleAtLeast(request, 'admin');
  if (auth instanceof NextResponse) return auth;
  try {
    const { id } = await params;
    const sparePartId = parseInt(id);
    if (isNaN(sparePartId)) {
      return NextResponse.json<ApiResponse<null>>({
        success: false,
        error: 'Invalid spare part ID'
      }, { status: 400 });
    }
    const client = await pool.connect();
    try {
      const result = await client.query(
        'DELETE FROM spare_parts WHERE id = $1 RETURNING id',
        [sparePartId]
      );
      if (result.rows.length === 0) {
        return NextResponse.json<ApiResponse<null>>({
          success: false,
          error: 'Spare part not found'
        }, { status: 404 });
      }
      return NextResponse.json<ApiResponse<null>>({
        success: true,
        message: 'Spare part deleted successfully'
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