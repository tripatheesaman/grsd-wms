import { NextRequest, NextResponse } from 'next/server';
import pool from '@/app/lib/database';
import bcrypt from 'bcryptjs';
import { requireAuth } from '@/app/api/middleware';
export async function PUT(request: NextRequest) {
  const auth = requireAuth(request);
  if (auth instanceof NextResponse) return auth;
  try {
    const { currentPassword, newPassword } = await request.json();
    if (!currentPassword || !newPassword) {
      return NextResponse.json({ 
        success: false, 
        error: 'Current password and new password are required' 
      }, { status: 400 });
    }
    if (newPassword.length < 6) {
      return NextResponse.json({ 
        success: false, 
        error: 'New password must be at least 6 characters long' 
      }, { status: 400 });
    }
    const client = await pool.connect();
    try {
      const userResult = await client.query(
        'SELECT password_hash, first_login FROM users WHERE id = $1',
        [auth.user.userId]
      );
      if (userResult.rows.length === 0) {
        return NextResponse.json({ 
          success: false, 
          error: 'User not found' 
        }, { status: 404 });
      }
      const user = userResult.rows[0];
      const isCurrentPasswordValid = await bcrypt.compare(currentPassword, user.password_hash);
      if (!isCurrentPasswordValid) {
        return NextResponse.json({ 
          success: false, 
          error: 'Current password is incorrect' 
        }, { status: 400 });
      }
      const saltRounds = 12;
      const newPasswordHash = await bcrypt.hash(newPassword, saltRounds);
      await client.query(
        'UPDATE users SET password_hash = $1, first_login = FALSE, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
        [newPasswordHash, auth.user.userId]
      );
      return NextResponse.json({ 
        success: true, 
        message: 'Password changed successfully' 
      });
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Error changing password:', error);
    return NextResponse.json({ 
      success: false, 
      error: 'Internal server error' 
    }, { status: 500 });
  }
}
