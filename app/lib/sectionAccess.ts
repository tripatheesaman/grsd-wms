import { NextRequest, NextResponse } from 'next/server';
import type { PoolClient } from 'pg';
import type { AuthUser } from '@/app/api/middleware';
import { DEFAULT_SECTION, normalizeSection, Section } from '@/app/lib/sections';

export function isSuperAdmin(user: AuthUser): boolean {
  return user.role === 'superadmin';
}

export function userSection(user: AuthUser): Section {
  return normalizeSection(user.section) ?? DEFAULT_SECTION;
}

/** AND clause for section-scoped list queries. Superadmin sees all unless ?section= is set. */
export function appendSectionFilter(
  auth: { user: AuthUser },
  request: NextRequest | null,
  columnRef: string,
  params: unknown[],
): string {
  if (isSuperAdmin(auth.user)) {
    if (request) {
      const filtered = normalizeSection(request.nextUrl.searchParams.get('section'));
      if (filtered) {
        params.push(filtered);
        return ` AND ${columnRef} = $${params.length}`;
      }
    }
    return '';
  }
  params.push(userSection(auth.user));
  return ` AND ${columnRef} = $${params.length}`;
}

export function sectionForCreate(auth: { user: AuthUser }, bodySection?: unknown): Section {
  if (isSuperAdmin(auth.user)) {
    return normalizeSection(bodySection) ?? userSection(auth.user);
  }
  return userSection(auth.user);
}

export function forbidUnlessSameSection(
  auth: { user: AuthUser },
  resourceSection: Section,
): NextResponse | null {
  if (isSuperAdmin(auth.user)) return null;
  if (userSection(auth.user) !== resourceSection) {
    return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
  }
  return null;
}

export async function getWorkOrderSection(
  client: PoolClient,
  workOrderId: number,
): Promise<Section | null> {
  const result = await client.query('SELECT section FROM work_orders WHERE id = $1', [workOrderId]);
  if (result.rows.length === 0) return null;
  return normalizeSection(result.rows[0].section) ?? DEFAULT_SECTION;
}

export async function assertWorkOrderAccess(
  client: PoolClient,
  auth: { user: AuthUser },
  workOrderId: number,
): Promise<{ ok: true; section: Section } | { ok: false; response: NextResponse }> {
  const section = await getWorkOrderSection(client, workOrderId);
  if (section === null) {
    return {
      ok: false,
      response: NextResponse.json({ success: false, error: 'Work order not found' }, { status: 404 }),
    };
  }
  const forbidden = forbidUnlessSameSection(auth, section);
  if (forbidden) return { ok: false, response: forbidden };
  return { ok: true, section };
}

export async function assertFindingAccess(
  client: PoolClient,
  auth: { user: AuthUser },
  findingId: number,
): Promise<{ ok: true; workOrderId: number; section: Section } | { ok: false; response: NextResponse }> {
  const result = await client.query(
    `SELECT f.work_order_id, wo.section
     FROM findings f
     JOIN work_orders wo ON wo.id = f.work_order_id
     WHERE f.id = $1`,
    [findingId],
  );
  if (result.rows.length === 0) {
    return {
      ok: false,
      response: NextResponse.json({ success: false, error: 'Finding not found' }, { status: 404 }),
    };
  }
  const section = normalizeSection(result.rows[0].section) ?? DEFAULT_SECTION;
  const forbidden = forbidUnlessSameSection(auth, section);
  if (forbidden) return { ok: false, response: forbidden };
  return { ok: true, workOrderId: result.rows[0].work_order_id, section };
}

export async function assertActionAccess(
  client: PoolClient,
  auth: { user: AuthUser },
  actionId: number,
): Promise<{ ok: true; section: Section } | { ok: false; response: NextResponse }> {
  const result = await client.query(
    `SELECT wo.section
     FROM actions a
     JOIN findings f ON f.id = a.finding_id
     JOIN work_orders wo ON wo.id = f.work_order_id
     WHERE a.id = $1`,
    [actionId],
  );
  if (result.rows.length === 0) {
    return {
      ok: false,
      response: NextResponse.json({ success: false, error: 'Action not found' }, { status: 404 }),
    };
  }
  const section = normalizeSection(result.rows[0].section) ?? DEFAULT_SECTION;
  const forbidden = forbidUnlessSameSection(auth, section);
  if (forbidden) return { ok: false, response: forbidden };
  return { ok: true, section };
}

export async function assertTechnicianAccess(
  client: PoolClient,
  auth: { user: AuthUser },
  technicianId: number,
): Promise<{ ok: true; section: Section } | { ok: false; response: NextResponse }> {
  const result = await client.query('SELECT section FROM technicians WHERE id = $1', [technicianId]);
  if (result.rows.length === 0) {
    return {
      ok: false,
      response: NextResponse.json({ success: false, error: 'Technician not found' }, { status: 404 }),
    };
  }
  const section = normalizeSection(result.rows[0].section) ?? DEFAULT_SECTION;
  const forbidden = forbidUnlessSameSection(auth, section);
  if (forbidden) return { ok: false, response: forbidden };
  return { ok: true, section };
}

export async function assertSparePartAccess(
  client: PoolClient,
  auth: { user: AuthUser },
  sparePartId: number,
): Promise<{ ok: true; section: Section } | { ok: false; response: NextResponse }> {
  const result = await client.query(
    `SELECT wo.section
     FROM spare_parts sp
     JOIN actions a ON a.id = sp.action_id
     JOIN findings f ON f.id = a.finding_id
     JOIN work_orders wo ON wo.id = f.work_order_id
     WHERE sp.id = $1`,
    [sparePartId],
  );
  if (result.rows.length === 0) {
    return {
      ok: false,
      response: NextResponse.json({ success: false, error: 'Spare part not found' }, { status: 404 }),
    };
  }
  const section = normalizeSection(result.rows[0].section) ?? DEFAULT_SECTION;
  const forbidden = forbidUnlessSameSection(auth, section);
  if (forbidden) return { ok: false, response: forbidden };
  return { ok: true, section };
}

export async function assertUnitAccess(
  client: PoolClient,
  auth: { user: AuthUser },
  unitId: number,
): Promise<{ ok: true; section: Section } | { ok: false; response: NextResponse }> {
  const result = await client.query('SELECT section FROM units WHERE id = $1', [unitId]);
  if (result.rows.length === 0) {
    return {
      ok: false,
      response: NextResponse.json({ success: false, error: 'Unit not found' }, { status: 404 }),
    };
  }
  const section = normalizeSection(result.rows[0].section) ?? DEFAULT_SECTION;
  const forbidden = forbidUnlessSameSection(auth, section);
  if (forbidden) return { ok: false, response: forbidden };
  return { ok: true, section };
}

/** Work-order tree filter for reports (alias wo.section). */
export function workOrderSectionJoinFilter(
  auth: { user: AuthUser },
  request: NextRequest | null,
  params: unknown[],
): string {
  return appendSectionFilter(auth, request, 'wo.section', params);
}
