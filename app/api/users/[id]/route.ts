import { NextRequest, NextResponse } from 'next/server';
import pool from '../../../lib/database';
import { User, ApiResponse } from '../../../types';
import { requireRoleAtLeast } from '@/app/api/middleware';
import bcrypt from 'bcryptjs';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = requireRoleAtLeast(request, 'superadmin');
  if (auth instanceof NextResponse) return auth;
  try {
    const { id } = await params;
    const userId = parseInt(id);
    if (isNaN(userId)) {
      return NextResponse.json<ApiResponse<null>>({
        success: false,
        error: 'Invalid user ID'
      }, { status: 400 });
    }
    const client = await pool.connect();
    try {
      const result = await client.query(`
        SELECT id, username, first_name, last_name, role, created_at, updated_at
        FROM users 
        WHERE id = $1
      `, [userId]);
      if (result.rows.length === 0) {
        return NextResponse.json<ApiResponse<null>>({
          success: false,
          error: 'User not found'
        }, { status: 404 });
      }
      return NextResponse.json<ApiResponse<User>>({
        success: true,
        data: result.rows[0]
      });
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Fetch user error:', error);
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
  const auth = requireRoleAtLeast(request, 'superadmin');
  if (auth instanceof NextResponse) return auth;
  try {
    const { id } = await params;
    const userId = parseInt(id);
    const body = await request.json();
    const { username, first_name, last_name, password, role } = body;
    if (isNaN(userId)) {
      return NextResponse.json<ApiResponse<null>>({
        success: false,
        error: 'Invalid user ID'
      }, { status: 400 });
    }
    if (!username || !first_name || !last_name) {
      return NextResponse.json<ApiResponse<null>>({
        success: false,
        error: 'Username, first name, and last name are required'
      }, { status: 400 });
    }
    if (role && !['user', 'admin', 'superadmin'].includes(role)) {
      return NextResponse.json<ApiResponse<null>>({
        success: false,
        error: 'Invalid role. Must be user, admin, or superadmin'
      }, { status: 400 });
    }
    const client = await pool.connect();
    try {
      const existingCheck = await client.query(`
        SELECT id FROM users WHERE username = $1 AND id != $2
      `, [username, userId]);
      if (existingCheck.rows.length > 0) {
        return NextResponse.json<ApiResponse<null>>({
          success: false,
          error: 'Username already exists for another user'
        }, { status: 400 });
      }
      const updateFields = ['username = $1', 'first_name = $2', 'last_name = $3'];
      const updateValues = [username, first_name, last_name];
      let paramIndex = 4;
      if (role) {
        updateFields.push(`role = $${paramIndex}`);
        updateValues.push(role);
        paramIndex++;
      }
      if (password) {
        const hashedPassword = await bcrypt.hash(password, 10);
        updateFields.push(`password_hash = $${paramIndex}`);
        updateValues.push(hashedPassword);
        paramIndex++;
      }
      updateFields.push(`updated_at = CURRENT_TIMESTAMP`);
      updateValues.push(userId);
      const updateQuery = `
        UPDATE users 
        SET ${updateFields.join(', ')}
        WHERE id = $${paramIndex}
        RETURNING id, username, first_name, last_name, role, created_at, updated_at
      `;
      const result = await client.query(updateQuery, updateValues);
      if (result.rows.length === 0) {
        return NextResponse.json<ApiResponse<null>>({
          success: false,
          error: 'User not found'
        }, { status: 404 });
      }
      return NextResponse.json<ApiResponse<User>>({
        success: true,
        data: result.rows[0]
      });
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Update user error:', error);
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
  const auth = requireRoleAtLeast(request, 'superadmin');
  if (auth instanceof NextResponse) return auth;
  try {
    const { id } = await params;
    const userId = parseInt(id);
    if (isNaN(userId)) {
      return NextResponse.json<ApiResponse<null>>({
        success: false,
        error: 'Invalid user ID'
      }, { status: 400 });
    }
    if (userId === auth.user.userId) {
      return NextResponse.json<ApiResponse<null>>({
        success: false,
        error: 'Cannot delete your own account'
      }, { status: 400 });
    }
    const client = await pool.connect();
    try {
      const workOrderCheck = await client.query(`
        SELECT COUNT(*) as count FROM work_orders WHERE requested_by_id = $1
      `, [userId]);
      if (parseInt(workOrderCheck.rows[0].count) > 0) {
        return NextResponse.json<ApiResponse<null>>({
          success: false,
          error: 'Cannot delete user who has created work orders'
        }, { status: 400 });
      }
      const result = await client.query(`
        DELETE FROM users WHERE id = $1 RETURNING id, username, first_name, last_name, role
      `, [userId]);
      if (result.rows.length === 0) {
        return NextResponse.json<ApiResponse<null>>({
          success: false,
          error: 'User not found'
        }, { status: 404 });
      }
      return NextResponse.json<ApiResponse<User>>({
        success: true,
        data: result.rows[0]
      });
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Delete user error:', error);
    return NextResponse.json<ApiResponse<null>>({
      success: false,
      error: 'Internal server error'
    }, { status: 500 });
  }
}
