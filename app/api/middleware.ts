import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
export interface AuthUser {
  userId: number;
  username: string;
  role: 'superadmin' | 'admin' | 'user';
}
export function requireAuth(request: NextRequest): { user: AuthUser } | NextResponse {
  const authHeader = request.headers.get('authorization') || request.headers.get('Authorization');
  let token: string | null = null;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.slice('Bearer '.length);
  }
  if (!token) {
    token = request.headers.get('x-access-token') || null;
  }
  if (!token) {
    const cookie = request.cookies.get('token');
    token = cookie?.value || null;
  }
  if (!token) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'fallback-secret') as AuthUser;
    return { user: decoded };
  } catch {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }
}
export function requireRoleAtLeast(request: NextRequest, minRole: 'user' | 'admin' | 'superadmin') {
  const auth = requireAuth(request);
  if (auth instanceof NextResponse) return auth;
  const hierarchy = ['user', 'admin', 'superadmin'] as const;
  const userIndex = hierarchy.indexOf(auth.user.role);
  const minIndex = hierarchy.indexOf(minRole);
  if (userIndex < minIndex) {
    return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
  }
  return auth;
}
