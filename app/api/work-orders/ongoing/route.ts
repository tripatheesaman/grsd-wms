import { NextRequest, NextResponse } from 'next/server';
import pool from '@/app/lib/database';
import { requireRoleAtLeast } from '@/app/api/middleware';
import { ensureSectionSchema } from '@/app/lib/ensureSections';
import { appendSectionFilter } from '@/app/lib/sectionAccess';

export async function GET(request: NextRequest) {
  const auth = requireRoleAtLeast(request, 'user');
  if (auth instanceof NextResponse) return auth;

  const client = await pool.connect();
  try {
    await ensureSectionSchema(client);
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const equipment_number = searchParams.get('equipment_number');
    const work_type = searchParams.get('work_type');
    const requested_by = searchParams.get('requested_by');
    const date_from = searchParams.get('date_from');
    const date_to = searchParams.get('date_to');
    const offset = (page - 1) * limit;

    const queryParams: (string | number)[] = ['pending', 'ongoing', 'completion_requested'];
    let query = 'SELECT * FROM work_orders WHERE status IN ($1, $2, $3)';
    query += appendSectionFilter(auth, request, 'section', queryParams);
    let paramIndex = queryParams.length + 1;

    if (equipment_number) {
      query += ` AND equipment_number ILIKE $${paramIndex}`;
      queryParams.push(`%${equipment_number}%`);
      paramIndex++;
    }
    if (work_type) {
      query += ` AND work_type ILIKE $${paramIndex}`;
      queryParams.push(`%${work_type}%`);
      paramIndex++;
    }
    if (requested_by) {
      query += ` AND requested_by ILIKE $${paramIndex}`;
      queryParams.push(`%${requested_by}%`);
      paramIndex++;
    }
    if (date_from) {
      query += ` AND work_order_date >= $${paramIndex}`;
      queryParams.push(date_from);
      paramIndex++;
    }
    if (date_to) {
      query += ` AND work_order_date <= $${paramIndex}`;
      queryParams.push(date_to);
      paramIndex++;
    }

    const countQuery = query.replace('SELECT *', 'SELECT COUNT(*)');
    const countResult = await client.query(countQuery, queryParams);
    const total = parseInt(countResult.rows[0].count);

    const dataQuery = `${query} ORDER BY created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    const dataResult = await client.query(dataQuery, [...queryParams, limit, offset]);
    const totalPages = Math.ceil(total / limit);

    return NextResponse.json({
      success: true,
      data: {
        workOrders: dataResult.rows,
        total,
        page,
        totalPages,
        limit,
      },
    });
  } catch (error) {
    console.error('Error fetching ongoing work orders:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch ongoing work orders' },
      { status: 500 },
    );
  } finally {
    client.release();
  }
}
