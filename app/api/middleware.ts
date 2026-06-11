import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import type { Section } from '@/app/lib/sections';
import { ROLE_HIERARCHY, type Role } from '@/app/lib/roles';

export interface AuthUser {
  userId: number;
  username: string;
  role: Role;
  section?: Section;
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

export function requireRoleAtLeast(request: NextRequest, minRole: Role) {
  const auth = requireAuth(request);
  if (auth instanceof NextResponse) return auth;
  const userIndex = ROLE_HIERARCHY.indexOf(auth.user.role);
  const minIndex = ROLE_HIERARCHY.indexOf(minRole);
  if (userIndex < 0 || userIndex < minIndex) {
    return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
  }
  return auth;
}
