import { NextRequest, NextResponse } from 'next/server';
import pool from '../../../lib/database';
import { Technician, ApiResponse } from '../../../types';
import { requireRoleAtLeast } from '@/app/api/middleware';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = requireRoleAtLeast(request, 'admin');
  if (auth instanceof NextResponse) return auth;
  try {
    const { id } = await params;
    const technicianId = parseInt(id);
    if (isNaN(technicianId)) {
      return NextResponse.json<ApiResponse<null>>({
        success: false,
        error: 'Invalid technician ID'
      }, { status: 400 });
    }
    const client = await pool.connect();
    try {
      const result = await client.query(`
        SELECT id, name, staff_id, designation, is_available, created_at, updated_at
        FROM technicians 
        WHERE id = $1
      `, [technicianId]);
      if (result.rows.length === 0) {
        return NextResponse.json<ApiResponse<null>>({
          success: false,
          error: 'Technician not found'
        }, { status: 404 });
      }
      return NextResponse.json<ApiResponse<Technician>>({
        success: true,
        data: result.rows[0]
      });
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Fetch technician error:', error);
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
  const auth = requireRoleAtLeast(request, 'admin');
  if (auth instanceof NextResponse) return auth;
  try {
    const { id } = await params;
    const technicianId = parseInt(id);
    const body = await request.json();
    const { name, staff_id, designation, is_available } = body;
    if (isNaN(technicianId)) {
      return NextResponse.json<ApiResponse<null>>({
        success: false,
        error: 'Invalid technician ID'
      }, { status: 400 });
    }
    if (!name || !staff_id) {
      return NextResponse.json<ApiResponse<null>>({
        success: false,
        error: 'Name and Staff ID are required'
      }, { status: 400 });
    }
    const client = await pool.connect();
    try {
      const existingCheck = await client.query(`
        SELECT id FROM technicians WHERE staff_id = $1 AND id != $2
      `, [staff_id, technicianId]);
      if (existingCheck.rows.length > 0) {
        return NextResponse.json<ApiResponse<null>>({
          success: false,
          error: 'Staff ID already exists for another technician'
        }, { status: 400 });
      }
      const result = await client.query(`
        UPDATE technicians 
        SET name = $1, staff_id = $2, designation = $3, is_available = $4, updated_at = CURRENT_TIMESTAMP
        WHERE id = $5
        RETURNING *
      `, [name, staff_id, designation, is_available, technicianId]);
      if (result.rows.length === 0) {
        return NextResponse.json<ApiResponse<null>>({
          success: false,
          error: 'Technician not found'
        }, { status: 404 });
      }
      return NextResponse.json<ApiResponse<Technician>>({
        success: true,
        data: result.rows[0]
      });
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Update technician error:', error);
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
    const technicianId = parseInt(id);
    if (isNaN(technicianId)) {
      return NextResponse.json<ApiResponse<null>>({
        success: false,
        error: 'Invalid technician ID'
      }, { status: 400 });
    }
    const client = await pool.connect();
    try {
      const workOrderCheck = await client.query(`
        SELECT COUNT(*) as count FROM job_performed_by WHERE staff_id = (
          SELECT staff_id FROM technicians WHERE id = $1
        )
      `, [technicianId]);
      if (parseInt(workOrderCheck.rows[0].count) > 0) {
        return NextResponse.json<ApiResponse<null>>({
          success: false,
          error: 'Cannot delete technician who is assigned to work orders'
        }, { status: 400 });
      }
      const result = await client.query(`
        DELETE FROM technicians WHERE id = $1 RETURNING *
      `, [technicianId]);
      if (result.rows.length === 0) {
        return NextResponse.json<ApiResponse<null>>({
          success: false,
          error: 'Technician not found'
        }, { status: 404 });
      }
      return NextResponse.json<ApiResponse<Technician>>({
        success: true,
        data: result.rows[0]
      });
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Delete technician error:', error);
    return NextResponse.json<ApiResponse<null>>({
      success: false,
      error: 'Internal server error'
    }, { status: 500 });
  }
}
