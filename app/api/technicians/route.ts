import { NextRequest, NextResponse } from 'next/server';
import pool from '../../lib/database';
import { Technician, ApiResponse } from '../../types';
import { requireRoleAtLeast } from '@/app/api/middleware';

export async function GET(request: NextRequest) {
  const auth = requireRoleAtLeast(request, 'admin');
  if (auth instanceof NextResponse) return auth;
  try {
    const client = await pool.connect();
    try {
      const result = await client.query(`
        SELECT id, name, staff_id, designation, is_available, created_at, updated_at
        FROM technicians 
        ORDER BY name ASC
      `);
      return NextResponse.json<ApiResponse<Technician[]>>({
        success: true,
        data: result.rows
      });
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Fetch technicians error:', error);
    return NextResponse.json<ApiResponse<null>>({
      success: false,
      error: 'Internal server error'
    }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const auth = requireRoleAtLeast(request, 'admin');
  if (auth instanceof NextResponse) return auth;
  try {
    const body = await request.json();
    const { name, staff_id, designation, is_available = true } = body;
    if (!name || !staff_id) {
      return NextResponse.json<ApiResponse<null>>({
        success: false,
        error: 'Name and Staff ID are required'
      }, { status: 400 });
    }
    const client = await pool.connect();
    try {
      const existingCheck = await client.query(`
        SELECT id FROM technicians WHERE staff_id = $1
      `, [staff_id]);
      if (existingCheck.rows.length > 0) {
        return NextResponse.json<ApiResponse<null>>({
          success: false,
          error: 'Staff ID already exists'
        }, { status: 400 });
      }
      const result = await client.query(`
        INSERT INTO technicians (name, staff_id, designation, is_available)
        VALUES ($1, $2, $3, $4)
        RETURNING *
      `, [name, staff_id, designation, is_available]);
      return NextResponse.json<ApiResponse<Technician>>({
        success: true,
        data: result.rows[0]
      });
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Create technician error:', error);
    return NextResponse.json<ApiResponse<null>>({
      success: false,
      error: 'Internal server error'
    }, { status: 500 });
  }
}