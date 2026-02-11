import { NextRequest, NextResponse } from 'next/server';
import pool from '@/app/lib/database';
export async function GET(request: NextRequest) {
  const client = await pool.connect();
  try {
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const equipment_number = searchParams.get('equipment_number');
    const work_type = searchParams.get('work_type');
    const requested_by = searchParams.get('requested_by');
    const date_from = searchParams.get('date_from');
    const date_to = searchParams.get('date_to');
    const offset = (page - 1) * limit;
    const whereConditions = ['status = $1'];
    const queryParams: (string | number)[] = ['ongoing'];
    let paramIndex = 2;
    if (equipment_number) {
      whereConditions.push(`equipment_number ILIKE $${paramIndex}`);
      queryParams.push(`%${equipment_number}%`);
      paramIndex++;
    }
    if (work_type) {
      whereConditions.push(`work_type ILIKE $${paramIndex}`);
      queryParams.push(`%${work_type}%`);
      paramIndex++;
    }
    if (requested_by) {
      whereConditions.push(`requested_by ILIKE $${paramIndex}`);
      queryParams.push(`%${requested_by}%`);
      paramIndex++;
    }
    if (date_from) {
      whereConditions.push(`work_order_date >= $${paramIndex}`);
      queryParams.push(date_from);
      paramIndex++;
    }
    if (date_to) {
      whereConditions.push(`work_order_date <= $${paramIndex}`);
      queryParams.push(date_to);
      paramIndex++;
    }
    const whereClause = whereConditions.join(' AND ');
    const countQuery = `SELECT COUNT(*) FROM work_orders WHERE ${whereClause}`;
    const countResult = await client.query(countQuery, queryParams);
    const total = parseInt(countResult.rows[0].count);
    const dataQuery = `
      SELECT * FROM work_orders 
      WHERE ${whereClause}
      ORDER BY created_at DESC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;
    const dataParams = [...queryParams, limit, offset];
    const dataResult = await client.query(dataQuery, dataParams);
    const totalPages = Math.ceil(total / limit);
    return NextResponse.json({
      success: true,
      data: {
        workOrders: dataResult.rows,
        total,
        page,
        totalPages,
        limit
      }
    });
  } catch (error) {
    console.error('Error fetching ongoing work orders:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch ongoing work orders' },
      { status: 500 }
    );
  } finally {
    client.release();
  }
} 