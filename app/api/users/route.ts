import { NextRequest, NextResponse } from 'next/server';
import pool from '../../lib/database';
import { User, ApiResponse } from '../../types';
import { requireRoleAtLeast } from '@/app/api/middleware';
import bcrypt from 'bcryptjs';

export async function GET(request: NextRequest) {
  const auth = requireRoleAtLeast(request, 'superadmin');
  if (auth instanceof NextResponse) return auth;
  try {
    const client = await pool.connect();
    try {
      const result = await client.query(`
        SELECT id, username, first_name, last_name, role, created_at, updated_at
        FROM users 
        ORDER BY created_at DESC
      `);
      return NextResponse.json<ApiResponse<User[]>>({
        success: true,
        data: result.rows
      });
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Fetch users error:', error);
    return NextResponse.json<ApiResponse<null>>({
      success: false,
      error: 'Internal server error'
    }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const auth = requireRoleAtLeast(request, 'superadmin');
  if (auth instanceof NextResponse) return auth;
  try {
    const body = await request.json();
    const { username, first_name, last_name, password, role = 'user' } = body;
    if (!username || !first_name || !last_name || !password) {
      return NextResponse.json<ApiResponse<null>>({
        success: false,
        error: 'Username, first name, last name, and password are required'
      }, { status: 400 });
    }
    if (!['user', 'admin', 'superadmin'].includes(role)) {
      return NextResponse.json<ApiResponse<null>>({
        success: false,
        error: 'Invalid role. Must be user, admin, or superadmin'
      }, { status: 400 });
    }
    const client = await pool.connect();
    try {
      const existingCheck = await client.query(`
        SELECT id FROM users WHERE username = $1
      `, [username]);
      if (existingCheck.rows.length > 0) {
        return NextResponse.json<ApiResponse<null>>({
          success: false,
          error: 'Username already exists'
        }, { status: 400 });
      }
      const hashedPassword = await bcrypt.hash(password, 10);
      const result = await client.query(`
        INSERT INTO users (username, first_name, last_name, password_hash, role)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING id, username, first_name, last_name, role, created_at, updated_at
      `, [username, first_name, last_name, hashedPassword, role]);
      return NextResponse.json<ApiResponse<User>>({
        success: true,
        data: result.rows[0]
      });
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Create user error:', error);
    return NextResponse.json<ApiResponse<null>>({
      success: false,
      error: 'Internal server error'
    }, { status: 500 });
  }
}
