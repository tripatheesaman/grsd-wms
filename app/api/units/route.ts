import { NextRequest, NextResponse } from 'next/server';
import pool from '../../lib/database';
import { ApiResponse, Unit } from '../../types';
import { requireAuth, requireRoleAtLeast } from '@/app/api/middleware';
export async function GET(request: NextRequest) {
  const auth = requireAuth(request);
  if (auth instanceof NextResponse) return auth;
  const client = await pool.connect();
  try {
    const result = await client.query('SELECT id, name, created_at, updated_at FROM units ORDER BY name ASC');
    return NextResponse.json<ApiResponse<Unit[]>>({ success: true, data: result.rows });
  } catch {
    return NextResponse.json<ApiResponse<null>>({ success: false, error: 'Failed to fetch units' }, { status: 500 });
  } finally {
    client.release();
  }
}
export async function POST(request: NextRequest) {
  const auth = requireRoleAtLeast(request, 'admin');
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
    const client = await pool.connect();
    try {
      const result = await client.query(
        'INSERT INTO units (name) VALUES ($1) ON CONFLICT (name) DO NOTHING RETURNING id, name, created_at, updated_at',
        [name]
      );
      if (result.rows.length === 0) {
        return NextResponse.json<ApiResponse<null>>({ success: false, error: 'Unit already exists' }, { status: 409 });
      }
      return NextResponse.json<ApiResponse<Unit>>({ success: true, data: result.rows[0] }, { status: 201 });
    } finally {
      client.release();
    }
  } catch {
    return NextResponse.json<ApiResponse<null>>({ success: false, error: 'Failed to create unit' }, { status: 500 });
  }
}
