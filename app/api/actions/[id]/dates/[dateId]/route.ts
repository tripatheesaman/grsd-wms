import { NextRequest, NextResponse } from 'next/server';
import pool from '../../../../../lib/database';
import { requireAuth, requireRoleAtLeast } from '@/app/api/middleware';


export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; dateId: string }> }
) {
  const auth = requireAuth(request);
  if (auth instanceof NextResponse) return auth;
  const { user } = auth;
  try {
    const { id, dateId } = await params;
    const actionId = parseInt(id);
    const actionDateId = parseInt(dateId);
    if (isNaN(actionId) || isNaN(actionDateId)) {
      return NextResponse.json({ success: false, error: 'Invalid IDs' }, { status: 400 });
    }
    const body = await request.json();
    const { action_date, start_time, end_time, is_completed } = body as {
      action_date?: string;
      start_time?: string;
      end_time?: string | null;
      is_completed?: boolean;
    };
  const fields: string[] = [];
    const values: unknown[] = [];
    let idx = 1;
    if (action_date !== undefined) { fields.push(`action_date = $${idx++}`); values.push(action_date); }
    if (start_time !== undefined) { fields.push(`start_time = $${idx++}`); values.push(start_time); }
    if (end_time !== undefined) { fields.push(`end_time = $${idx++}`); values.push(end_time); }
  if (is_completed !== undefined) { fields.push(`is_completed = $${idx++}`); values.push(is_completed); }
    fields.push(`updated_at = CURRENT_TIMESTAMP`);
    if (values.length === 0) {
      return NextResponse.json({ success: false, error: 'No fields to update' }, { status: 400 });
    }
    const client = await pool.connect();
    try {
      if (is_completed === false) {
        const existing = await client.query('SELECT is_completed FROM action_dates WHERE id = $1 AND action_id = $2', [actionDateId, actionId]);
        if (existing.rows.length === 0) {
          return NextResponse.json({ success: false, error: 'Action date not found' }, { status: 404 });
        }
        const prev = existing.rows[0];
        if (prev.is_completed === true && !(user.role === 'admin' || user.role === 'superadmin')) {
          return NextResponse.json({ success: false, error: 'Only admins can revert completion' }, { status: 403 });
        }
      }
        if (action_date !== undefined) {
          const dup = await client.query('SELECT id FROM action_dates WHERE action_id = $1 AND action_date = $2 AND id != $3', [actionId, action_date, actionDateId]);
          if (dup.rows.length > 0) {
            return NextResponse.json({ success: false, error: 'Another entry for this action with the same date already exists' }, { status: 409 });
          }
        }
        if (is_completed === true) {
          const latestRes = await client.query(
            `SELECT id FROM action_dates WHERE action_id = $1 ORDER BY (action_date::date) DESC LIMIT 1`,
            [actionId]
          );
          const latestId = latestRes.rows[0]?.id;
          if (!latestId) {
            return NextResponse.json({ success: false, error: 'No action dates found' }, { status: 400 });
          }
          if (latestId !== actionDateId) {
            return NextResponse.json({ success: false, error: 'Only the latest date may be marked completed' }, { status: 400 });
          }
        }
      const query = `UPDATE action_dates SET ${fields.join(', ')} WHERE id = $${idx} AND action_id = $${idx + 1} RETURNING *`;
      values.push(actionDateId, actionId);
      const result = await client.query(query, values);
      if (result.rows.length === 0) {
        return NextResponse.json({ success: false, error: 'Action date not found' }, { status: 404 });
      }
      return NextResponse.json({ success: true, data: result.rows[0] });
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Error updating action date:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; dateId: string }> }
) {
  const auth = requireRoleAtLeast(request, 'admin');
  if (auth instanceof NextResponse) return auth;
  try {
    const { id, dateId } = await params;
    const actionId = parseInt(id);
    const actionDateId = parseInt(dateId);
    if (isNaN(actionId) || isNaN(actionDateId)) {
      return NextResponse.json({ success: false, error: 'Invalid IDs' }, { status: 400 });
    }
    const client = await pool.connect();
    try {
      const result = await client.query(
        'DELETE FROM action_dates WHERE id = $1 AND action_id = $2 RETURNING id',
        [actionDateId, actionId]
      );
      if (result.rows.length === 0) {
        return NextResponse.json({ success: false, error: 'Action date not found' }, { status: 404 });
      }
      return NextResponse.json({ success: true, message: 'Action date deleted successfully' });
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Error deleting action date:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
