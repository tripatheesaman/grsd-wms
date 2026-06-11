import { NextRequest, NextResponse } from 'next/server';
import pool from '../../lib/database';
import { ApiResponse, Unit } from '../../types';
import { requireAuth, requireRoleAtLeast } from '@/app/api/middleware';
import { ensureSectionSchema } from '@/app/lib/ensureSections';
import { appendSectionFilter, sectionForCreate } from '@/app/lib/sectionAccess';

export async function GET(request: NextRequest) {
  const auth = requireAuth(request);
  if (auth instanceof NextResponse) return auth;
  const client = await pool.connect();
  try {
    await ensureSectionSchema(client);
    const params: unknown[] = [];
    let query = 'SELECT id, name, section, created_at, updated_at FROM units WHERE 1=1';
    query += appendSectionFilter(auth, request, 'section', params);
    query += ' ORDER BY name ASC';
    const result = await client.query(query, params);
    return NextResponse.json<ApiResponse<Unit[]>>({ success: true, data: result.rows });
  } catch {
    return NextResponse.json<ApiResponse<null>>({ success: false, error: 'Failed to fetch units' }, { status: 500 });
  } finally {
    client.release();
  }
}

export async function POST(request: NextRequest) {
  const auth = requireRoleAtLeast(request, 'incharge');
  if (auth instanceof NextResponse) return auth;
  try {
    const body = await request.json();
    const name = (body?.name || '').trim();
    if (!name) {
      return NextResponse.json<ApiResponse<null>>({ success: false, error: 'Unit name is required' }, { status: 400 });
    }
    if (name.length > 32) {
      return NextResponse.json<ApiResponse<null>>({ success: false, error: 'Unit name too long' }, { status: 400 });
    }
    const section = sectionForCreate(auth, body.section);
    const client = await pool.connect();
    try {
      await ensureSectionSchema(client);
      const existing = await client.query(
        'SELECT id FROM units WHERE name = $1 AND section = $2',
        [name, section],
      );
      if (existing.rows.length > 0) {
        return NextResponse.json<ApiResponse<null>>({ success: false, error: 'Unit already exists in this section' }, { status: 409 });
      }
      const result = await client.query(
        'INSERT INTO units (name, section) VALUES ($1, $2) RETURNING id, name, section, created_at, updated_at',
        [name, section],
      );
      return NextResponse.json<ApiResponse<Unit>>({ success: true, data: result.rows[0] }, { status: 201 });
    } finally {
      client.release();
    }
  } catch {
    return NextResponse.json<ApiResponse<null>>({ success: false, error: 'Failed to create unit' }, { status: 500 });
  }
}
