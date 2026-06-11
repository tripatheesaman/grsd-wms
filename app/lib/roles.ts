export type Role = 'user' | 'incharge' | 'admin' | 'superadmin';

export const ROLE_HIERARCHY: Role[] = ['user', 'incharge', 'admin', 'superadmin'];

export const ROLE_LABELS: Record<Role, string> = {
  user: 'User',
  incharge: 'Incharge',
  admin: 'Admin',
  superadmin: 'Super Admin',
};

export function roleAtLeast(role: Role, minRole: Role): boolean {
  return ROLE_HIERARCHY.indexOf(role) >= ROLE_HIERARCHY.indexOf(minRole);
}

/** Incharge, admin, or superadmin — operational staff below user management. */
export function isStaffRole(role: Role): boolean {
  return roleAtLeast(role, 'incharge');
}

export function canManageUsers(role: Role): boolean {
  return role === 'superadmin';
}

/** Final completion approval (admin / superadmin only). */
export function canFinalApproveCompletion(role: Role): boolean {
  return roleAtLeast(role, 'admin');
}

/** First-stage completion review (incharge and above). */
export function canInchargeReviewCompletion(role: Role): boolean {
  return roleAtLeast(role, 'incharge');
}

export function isValidRole(value: string): value is Role {
  return ROLE_HIERARCHY.includes(value as Role);
}

export function technicianApprovalStatusForRole(role: Role): 'pending' | 'approved' {
  return roleAtLeast(role, 'incharge') ? 'approved' : 'pending';
}
