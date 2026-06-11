import { NextRequest, NextResponse } from 'next/server';
import pool from '../../lib/database';
import { Technician, ApiResponse } from '../../types';
import { requireRoleAtLeast } from '@/app/api/middleware';
import { ensureSectionSchema } from '@/app/lib/ensureSections';
import { appendSectionFilter, sectionForCreate } from '@/app/lib/sectionAccess';

export async function GET(request: NextRequest) {
  const auth = requireRoleAtLeast(request, 'user');
  if (auth instanceof NextResponse) return auth;
  try {
    const client = await pool.connect();
    try {
      await ensureSectionSchema(client);
      const params: unknown[] = [];
      let query = `
        SELECT id, name, staff_id, designation, is_available, section, created_at, updated_at
        FROM technicians
        WHERE 1=1
      `;
      query += appendSectionFilter(auth, request, 'section', params);
      query += ' ORDER BY name ASC';
      const result = await client.query(query, params);
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
  const auth = requireRoleAtLeast(request, 'incharge');
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
    const section = sectionForCreate(auth, body.section);
    const client = await pool.connect();
    try {
      await ensureSectionSchema(client);
      const existingCheck = await client.query(`
        SELECT id FROM technicians WHERE staff_id = $1 AND section = $2
      `, [staff_id, section]);
      if (existingCheck.rows.length > 0) {
        return NextResponse.json<ApiResponse<null>>({
          success: false,
          error: 'Staff ID already exists in this section'
        }, { status: 400 });
      }
      const result = await client.query(`
        INSERT INTO technicians (name, staff_id, designation, is_available, section)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING *
      `, [name, staff_id, designation, is_available, section]);
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
