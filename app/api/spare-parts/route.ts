import { NextRequest, NextResponse } from 'next/server';
import pool from '../../lib/database';
import { SparePart, ApiResponse } from '../../types';
import { requireRoleAtLeast } from '@/app/api/middleware';
export async function POST(request: NextRequest) {
  const auth = requireRoleAtLeast(request, 'admin');
  if (auth instanceof NextResponse) return auth;
  try {
    const body = await request.json();
    const raw = body as {
      action_id: number;
      part_name: string;
      part_number: string;
      quantity: number;
      unit?: string | null;
    };
    const { action_id, part_name, part_number, quantity, unit: _unit = null } = raw;
    let unit = _unit;
    if (unit === '') unit = null;
    if (!action_id || !part_name || !part_number || !quantity) {
      return NextResponse.json<ApiResponse<null>>({
        success: false,
        error: 'All fields are required'
      }, { status: 400 });
    }
    if (typeof action_id !== 'number' || action_id <= 0) {
      return NextResponse.json<ApiResponse<null>>({
        success: false,
        error: 'Invalid action ID'
      }, { status: 400 });
    }
    if (part_name.trim().length === 0) {
      return NextResponse.json<ApiResponse<null>>({
        success: false,
        error: 'Part name cannot be empty'
      }, { status: 400 });
    }
    if (part_name.length > 200) {
      return NextResponse.json<ApiResponse<null>>({
        success: false,
        error: 'Part name must be less than 200 characters'
      }, { status: 400 });
    }
    if (part_number.trim().length === 0) {
      return NextResponse.json<ApiResponse<null>>({
        success: false,
        error: 'Part number cannot be empty'
      }, { status: 400 });
    }
    if (part_number.length > 100) {
      return NextResponse.json<ApiResponse<null>>({
        success: false,
        error: 'Part number must be less than 100 characters'
      }, { status: 400 });
    }
    if (typeof quantity !== 'number' || quantity <= 0) {
      return NextResponse.json<ApiResponse<null>>({
        success: false,
        error: 'Quantity must be a positive number'
      }, { status: 400 });
    }
    const client = await pool.connect();
    try {
      const actionCheck = await client.query(
        'SELECT id FROM actions WHERE id = $1',
        [action_id]
      );
      if (actionCheck.rows.length === 0) {
        return NextResponse.json<ApiResponse<null>>({
          success: false,
          error: 'Action not found'
        }, { status: 404 });
      }
      const result = await client.query(`
        INSERT INTO spare_parts (
          action_id, part_name, part_number, quantity, unit
        ) VALUES ($1, $2, $3, $4, $5)
        RETURNING *
      `, [
        action_id,
        part_name.trim(),
        part_number.trim(),
        quantity,
        unit
      ]);
      const sparePart = result.rows[0];
      return NextResponse.json<ApiResponse<SparePart>>({
        success: true,
        data: sparePart
      });
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Error creating spare part:', error);
    return NextResponse.json<ApiResponse<null>>({
      success: false,
      error: 'Internal server error'
    }, { status: 500 });
  }
} 