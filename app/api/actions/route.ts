import { NextRequest, NextResponse } from 'next/server';
import pool from '../../lib/database';
import { Action, ApiResponse } from '../../types';
import { requireRoleAtLeast } from '@/app/api/middleware';
import { toPastTenseText } from '@/app/utils/textFormat';
export async function POST(request: NextRequest) {
  const auth = requireRoleAtLeast(request, 'admin');
  if (auth instanceof NextResponse) return auth;
  try {
    const body = await request.json();
    const raw = body as {
      finding_id: number;
      description: string;
      action_date: string;
      start_time: string;
      end_time?: string | null;
      is_completed?: boolean;
      remarks?: string | null;
      technician_ids?: number[];
    };
    const { finding_id, description, action_date, start_time, is_completed = false, remarks = null, end_time: _end_time = null, technician_ids = [] } = raw;
    let end_time = _end_time;
    if (end_time === '') end_time = null;
    if (!finding_id || !description || !action_date || !start_time) {
      return NextResponse.json<ApiResponse<null>>({
        success: false,
        error: 'finding_id, description, action_date and start_time are required'
      }, { status: 400 });
    }
    if (typeof finding_id !== 'number' || finding_id <= 0) {
      return NextResponse.json<ApiResponse<null>>({
        success: false,
        error: 'Invalid finding ID'
      }, { status: 400 });
    }
    if (description.trim().length === 0) {
      return NextResponse.json<ApiResponse<null>>({
        success: false,
        error: 'Action description cannot be empty'
      }, { status: 400 });
    }
    if (description.length > 1000) {
      return NextResponse.json<ApiResponse<null>>({
        success: false,
        error: 'Action description must be less than 1000 characters'
      }, { status: 400 });
    }
    const timeRegex = /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/;
    if (!timeRegex.test(start_time)) {
      return NextResponse.json<ApiResponse<null>>({
        success: false,
        error: 'Invalid start time format. Use HH:MM format'
      }, { status: 400 });
    }
    if (end_time && !timeRegex.test(end_time)) {
      return NextResponse.json<ApiResponse<null>>({
        success: false,
        error: 'Invalid end time format. Use HH:MM format'
      }, { status: 400 });
    }
    if (end_time) {
      const start = new Date(`2000-01-01T${start_time}`);
      const end = new Date(`2000-01-01T${end_time}`);
      if (start >= end) {
        return NextResponse.json<ApiResponse<null>>({
          success: false,
          error: 'End time must be after start time'
        }, { status: 400 });
      }
    }
    const client = await pool.connect();
    try {
      const findingCheck = await client.query(
        'SELECT id FROM findings WHERE id = $1',
        [finding_id]
      );
      if (findingCheck.rows.length === 0) {
        return NextResponse.json<ApiResponse<null>>({
          success: false,
          error: 'Finding not found'
        }, { status: 404 });
      }
      const workOrderQuery = await client.query(`
        SELECT wo.work_order_date 
        FROM work_orders wo 
        JOIN findings f ON f.work_order_id = wo.id 
        WHERE f.id = $1
      `, [finding_id]);
      if (workOrderQuery.rows.length === 0) {
        return NextResponse.json<ApiResponse<null>>({
          success: false,
          error: 'Work order not found'
        }, { status: 404 });
      }
      const workOrderDate = workOrderQuery.rows[0].work_order_date;
      if (new Date(action_date) < new Date(workOrderDate)) {
        return NextResponse.json<ApiResponse<null>>({
          success: false,
          error: `Action date cannot be before work order date (${new Date(workOrderDate).toLocaleDateString('en-GB')})`
        }, { status: 400 });
      }
      const startTimestamp = `${action_date}T${start_time}:00`;
      const endTimestamp = end_time ? `${action_date}T${end_time}:00` : null;
  let insertSql = '';
  let insertParams: unknown[] = [];
      try {
        insertSql = `
        INSERT INTO actions (
          finding_id, description, action_date, start_time, end_time, remarks
        ) VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING *
      `;
        insertParams = [
          finding_id,
          toPastTenseText(description),
          action_date,
          startTimestamp,
          endTimestamp,
          remarks ? toPastTenseText(remarks) : null
        ];
      const result = await client.query(insertSql, insertParams);
      const action = result.rows[0];
      const actionDateResult = await client.query(`
        INSERT INTO action_dates (
          action_id, action_date, start_time, end_time, is_completed
        ) VALUES ($1, $2, $3, $4, $5)
        RETURNING id
      `, [
        action.id,
        action_date,
        start_time, 
        end_time, 
        is_completed
      ]);
      const actionDateId = actionDateResult.rows[0]?.id;

      await client.query(`
        CREATE TABLE IF NOT EXISTS action_date_technicians (
          id SERIAL PRIMARY KEY,
          action_date_id INTEGER NOT NULL REFERENCES action_dates(id) ON DELETE CASCADE,
          technician_id INTEGER REFERENCES technicians(id) ON DELETE SET NULL,
          name VARCHAR(255) NOT NULL,
          staff_id VARCHAR(255) NOT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          UNIQUE(action_date_id, staff_id)
        )
      `);

      const validTechnicianIds = Array.isArray(technician_ids)
        ? technician_ids.filter((id): id is number => typeof id === 'number' && id > 0)
        : [];
      if (actionDateId && validTechnicianIds.length > 0) {
        const techResult = await client.query(
          `SELECT id, name, staff_id FROM technicians WHERE id = ANY($1::int[])`,
          [validTechnicianIds]
        );
        for (const tech of techResult.rows) {
          await client.query(
            `INSERT INTO action_date_technicians (action_date_id, technician_id, name, staff_id)
             VALUES ($1, $2, $3, $4)
             ON CONFLICT (action_date_id, staff_id) DO NOTHING`,
            [actionDateId, tech.id, tech.name, tech.staff_id]
          );
        }
      }
      return NextResponse.json<ApiResponse<Action>>({
        success: true,
        data: action
      });
      } catch (err: unknown) {
        if (err && typeof err === 'object' && 'code' in err) {
          const e = err as { code?: string };
          if (e.code === '42703') {
            return NextResponse.json<ApiResponse<null>>({
              success: false,
              error: 'Database schema does not have "remarks" column on actions. Please add the column `remarks text` to the actions table or ask an admin to run the migration.'
            }, { status: 500 });
          }
        }
        throw err;
      }
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Error creating action:', error);
    return NextResponse.json<ApiResponse<null>>({
      success: false,
      error: 'Internal server error'
    }, { status: 500 });
  }
} 