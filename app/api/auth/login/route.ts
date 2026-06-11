import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import pool from '../../../lib/database';
import { LoginRequest, LoginResponse, ApiResponse } from '../../../types';
export async function POST(request: NextRequest) {
  try {
    const body: LoginRequest = await request.json();
    const { username, password } = body;
    if (!username || !password) {
      return NextResponse.json<ApiResponse<null>>({
        success: false,
        error: 'Username and password are required'
      }, { status: 400 });
    }
    const client = await pool.connect();
    try {
      const result = await client.query(
        'SELECT * FROM users WHERE username = $1',
        [username]
      );
      if (result.rows.length === 0) {
        return NextResponse.json<ApiResponse<null>>({
          success: false,
          error: 'Invalid credentials'
        }, { status: 401 });
      }      
      const user = result.rows[0];
      const isValidPassword = await bcrypt.compare(password, user.password_hash);
      if (!isValidPassword) {
        return NextResponse.json<ApiResponse<null>>({
          success: false,
          error: 'Invalid credentials'
        }, { status: 401 });
      }
      const token = jwt.sign(
        { userId: user.id, username: user.username, role: user.role },
        process.env.JWT_SECRET || 'fallback-secret',
        { expiresIn: '24h' }
      );
      const { password_hash, ...userWithoutPassword } = user;
      void password_hash;
      const response: LoginResponse = {
        user: userWithoutPassword,
        token
      };
      return NextResponse.json<ApiResponse<LoginResponse>>({
        success: true,
        data: response
      });
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Login error:', error);
    return NextResponse.json<ApiResponse<null>>({
      success: false,
      error: 'Internal server error'
    }, { status: 500 });
  }
} 