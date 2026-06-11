import { NextRequest, NextResponse } from 'next/server';
import pool from '@/app/lib/database';
import { ApiResponse, WorkOrder } from '@/app/types';
import { requireRoleAtLeast } from '@/app/api/middleware';
export async function GET(request: NextRequest) {
  const auth = requireRoleAtLeast(request, 'user');
  if (auth instanceof NextResponse) return auth;
  const searchParams = request.nextUrl.searchParams;
  const page = parseInt(searchParams.get('page') || '1');
  const limit = parseInt(searchParams.get('limit') || '10');
  const status = searchParams.get('status') || '';
  const search = searchParams.get('search') || '';
  const startDate = searchParams.get('startDate') || '';
  const endDate = searchParams.get('endDate') || '';
  const sortBy = searchParams.get('sortBy') || 'work_order_date';
  const sortOrder = searchParams.get('sortOrder') || 'DESC';
  const offset = (page - 1) * limit;
  try {
    const client = await pool.connect();
    try {
      let query = `
        WITH filtered_orders AS (
          SELECT 
            wo.*,
            u.name as requested_by_name,
            COUNT(*) OVER() as total_count
          FROM work_orders wo
          LEFT JOIN users u ON wo.requested_by_id = u.id
          WHERE 1=1
      `;
      const queryParams: (string | number)[] = [];
      let paramIndex = 1;
      if (status) {
        query += ` AND wo.status = $${paramIndex}`;
        queryParams.push(status);
        paramIndex++;
      }
      if (search) {
        query += ` AND (
          wo.work_order_no ILIKE $${paramIndex}
          OR wo.equipment_number ILIKE $${paramIndex}
          OR wo.description ILIKE $${paramIndex}
        )`;
        queryParams.push(`%${search}%`);
        paramIndex++;
      }
      if (startDate) {
        query += ` AND wo.work_order_date >= $${paramIndex}`;
        queryParams.push(startDate);
        paramIndex++;
      }
      if (endDate) {
        query += ` AND wo.work_order_date <= $${paramIndex}`;
        queryParams.push(endDate);
        paramIndex++;
      }
      query += `
        )
        SELECT * FROM filtered_orders
        ORDER BY ${sortBy} ${sortOrder}
        LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
      `;
      queryParams.push(limit, offset);
      const result = await client.query(query, queryParams);
      const totalCount = result.rows[0]?.total_count || 0;
      const totalPages = Math.ceil(totalCount / limit);
      return NextResponse.json<ApiResponse<{
        workOrders: WorkOrder[];
        pagination: {
          currentPage: number;
          totalPages: number;
          totalItems: number;
          itemsPerPage: number;
        };
      }>>({
        success: true,
        data: {
          workOrders: result.rows,
          pagination: {
            currentPage: page,
            totalPages,
            totalItems: parseInt(totalCount.toString()),
            itemsPerPage: limit
          }
        }
      });
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Error fetching work orders:', error);
    return NextResponse.json<ApiResponse<null>>({
      success: false,
      error: 'Error fetching work orders'
    }, { status: 500 });
  }
}