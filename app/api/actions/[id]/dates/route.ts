import { NextRequest, NextResponse } from 'next/server';
import pool from '../../../../lib/database';
import { requireAuth } from '@/app/api/middleware';
import { ApiResponse } from '../../../../types';
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = requireAuth(request);
  if (auth instanceof NextResponse) return auth;
  const { id: actionId } = await params;
  const client = await pool.connect();
  try {
    const result = await client.query(
      `SELECT id, action_id, action_date, start_time, end_time, is_completed, created_at, updated_at
       FROM action_dates
       WHERE action_id = $1
       ORDER BY action_date DESC`,
      [actionId]
    );
    return NextResponse.json({
      success: true,
      data: result.rows
    });
  } catch (error) {
    console.error('Error fetching action dates:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch action dates' },
      { status: 500 }
    );
  } finally {
    client.release();
  }
}
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = requireAuth(request);
  if (auth instanceof NextResponse) return auth;
  const { id: actionId } = await params;
  try {
    const body = await request.json();
    const raw = body as {
      action_date?: string;
      start_time?: string;
      end_time?: string | null;
      is_completed?: boolean;
    };
    const { action_date, start_time, is_completed = false, end_time: _end_time = null } = raw;
    let end_time = _end_time;
    if (end_time === '') end_time = null;
    if (!action_date || !start_time) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields: action_date, start_time' },
        { status: 400 }
      );
    }
    const client = await pool.connect();
    try {
      const prevRes = await client.query(
        `SELECT id, action_date, end_time FROM action_dates WHERE action_id = $1 ORDER BY (action_date::date) DESC LIMIT 1`,
        [actionId]
      );
      if (prevRes.rows.length > 0) {
        const prev = prevRes.rows[0];
        if (prev.end_time === null || String(prev.end_time).trim() === '') {
          return NextResponse.json<ApiResponse<unknown>>({
            success: false,
            error: 'Cannot start again: previous action date is missing an end time',
            data: { previous_action_date: prev }
          }, { status: 400 });
        }
      }
      const insertRes = await client.query(
        `INSERT INTO action_dates (action_id, action_date, start_time, end_time, is_completed)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING id, action_id, action_date, start_time, end_time, is_completed, created_at, updated_at`,
        [actionId, action_date, start_time, end_time, is_completed]
      );
      const inserted = insertRes.rows[0];
      await client.query(
        `UPDATE action_dates SET is_completed = TRUE, updated_at = CURRENT_TIMESTAMP WHERE action_id = $1 AND id != $2`,
        [actionId, inserted.id]
      );
      return NextResponse.json({
        success: true,
        data: inserted
      }, { status: 201 });
    } finally {
      client.release();
    }
    } catch (error: unknown) {
    console.error('Error adding action date:', error);
    if (error && typeof error === 'object' && 'code' in error) {
      const e = error as { code?: string };
      if (e.code === '23505') {
        return NextResponse.json(
          { success: false, error: 'An entry for this action and date already exists' },
          { status: 409 }
        );
      }
    }
    return NextResponse.json(
      { success: false, error: 'Failed to add action date' },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = requireAuth(request);
  if (auth instanceof NextResponse) return auth;
  const { user } = auth;
  const { id: actionId } = await params;
  try {
    const body = await request.json();
    const { action_date, is_completed } = body;
    if (!action_date || is_completed === undefined) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields: action_date, is_completed' },
        { status: 400 }
      );
    }
    const client = await pool.connect();
    try {
      if (is_completed === false && !(user.role === 'admin' || user.role === 'superadmin')) {
        return NextResponse.json({ success: false, error: 'Only admins can revert completion' }, { status: 403 });
      }
        if (is_completed === true) {
          const targetRes = await client.query(
            `SELECT id FROM action_dates WHERE action_id = $1 AND (action_date::date) = ($2::date) LIMIT 1`,
            [actionId, action_date]
          );
          const targetId = targetRes.rows[0]?.id;
          if (!targetId) {
            return NextResponse.json({ success: false, error: 'Action date not found for the provided date' }, { status: 404 });
          }
          const latestRes = await client.query(
            `SELECT id FROM action_dates WHERE action_id = $1 ORDER BY (action_date::date) DESC LIMIT 1`,
            [actionId]
          );
          const latestId = latestRes.rows[0]?.id;
          if (!latestId) {
            return NextResponse.json({ success: false, error: 'No action dates found' }, { status: 400 });
          }
          if (latestId !== targetId) {
            return NextResponse.json({ success: false, error: 'Only the latest date may be marked completed' }, { status: 400 });
          }
        }
      const result = await client.query(
        `UPDATE action_dates
         SET is_completed = $1, updated_at = CURRENT_TIMESTAMP
         WHERE action_id = $2 AND action_date = $3
         RETURNING id, action_id, action_date, start_time, end_time, is_completed, created_at, updated_at`,
        [is_completed, actionId, action_date]
      );
      if (result.rows.length === 0) {
        return NextResponse.json(
          { success: false, error: 'Action date not found' },
          { status: 404 }
        );
      }
      return NextResponse.json({
        success: true,
        data: result.rows[0]
      });
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Error updating action date:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update action date' },
      { status: 500 }
    );
  }
}
export async function DELETE() {
  return NextResponse.json({ success: false, error: 'Use /api/actions/:id/dates/:dateId' }, { status: 405 });
}
