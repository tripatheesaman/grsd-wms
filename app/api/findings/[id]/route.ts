import { NextRequest, NextResponse } from 'next/server';
import pool from '../../../lib/database';
import { Finding, ApiResponse } from '../../../types';
import { requireRoleAtLeast } from '@/app/api/middleware';
import { unlink } from 'fs/promises';
import { join } from 'path';
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = requireRoleAtLeast(request, 'admin');
  if (auth instanceof NextResponse) return auth;
  try {
    const { id } = await params;
    const findingId = parseInt(id);
    const body = await request.json();
    const { description, reference_image } = body;
    if (isNaN(findingId)) {
      return NextResponse.json<ApiResponse<null>>({
        success: false,
        error: 'Invalid finding ID'
      }, { status: 400 });
    }
    const client = await pool.connect();
    try {
      const existing = await client.query('SELECT reference_image FROM findings WHERE id = $1', [findingId]);
      const oldPath: string | null = existing.rows[0]?.reference_image || null;
      const result = await client.query(`
        UPDATE findings 
        SET description = $1, reference_image = $2, updated_at = CURRENT_TIMESTAMP
        WHERE id = $3
        RETURNING *
      `, [description, reference_image || null, findingId]);
      if (result.rows.length === 0) {
        return NextResponse.json<ApiResponse<null>>({
          success: false,
          error: 'Finding not found'
        }, { status: 404 });
      }
      const finding = result.rows[0];
      if (reference_image && oldPath && oldPath !== reference_image) {
        try {
          await unlink(join(process.cwd(), 'public', oldPath));
        } catch {
        }
      }
      return NextResponse.json<ApiResponse<Finding>>({
        success: true,
        data: finding
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
    const findingId = parseInt(id);
    if (isNaN(findingId)) {
      return NextResponse.json<ApiResponse<null>>({
        success: false,
        error: 'Invalid finding ID'
      }, { status: 400 });
    }
    const client = await pool.connect();
    try {
      const existing = await client.query('SELECT reference_image FROM findings WHERE id = $1', [findingId]);
      const oldPath: string | null = existing.rows[0]?.reference_image || null;
      const result = await client.query(
        'DELETE FROM findings WHERE id = $1 RETURNING id',
        [findingId]
      );
      if (result.rows.length === 0) {
        return NextResponse.json<ApiResponse<null>>({
          success: false,
          error: 'Finding not found'
        }, { status: 404 });
      }
      if (oldPath) {
        try { await unlink(join(process.cwd(), 'public', oldPath)); } catch {}
      }
      return NextResponse.json<ApiResponse<null>>({
        success: true,
        message: 'Finding deleted successfully'
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