import { NextRequest, NextResponse } from 'next/server';
import pool from '@/app/lib/database';
import { ApiResponse, TechnicianPerformance } from '@/app/types';
import { requireRoleAtLeast } from '@/app/api/middleware';
import ExcelJS from 'exceljs';
export async function GET(request: NextRequest) {
  const auth = requireRoleAtLeast(request, 'admin');
  if (auth instanceof NextResponse) return auth;
  try {
    const url = new URL(request.url);
    const sp = url.searchParams;
    const dateFrom = sp.get('date_from');
    const dateTo = sp.get('date_to');
    const exportType = sp.get('export');
    const client = await pool.connect();
    try {
      const params: unknown[] = [];
      const filters: string[] = [];
      if (dateFrom) {
        params.push(dateFrom);
        filters.push(`ad.action_date >= $${params.length}`);
      }
      if (dateTo) {
        params.push(dateTo);
        filters.push(`ad.action_date <= $${params.length}`);
      }
      const whereClause = filters.length ? `WHERE ${filters.join(' AND ')}` : '';
      const sql = `
        SELECT 
          COALESCE(at.technician_id, NULL) AS technician_id,
          at.name AS name,
          at.staff_id AS staff_id,
          COUNT(DISTINCT a.id) AS actions_worked,
          SUM(CASE WHEN ad.is_completed THEN 1 ELSE 0 END) AS completed_actions,
          SUM(
            CASE 
              WHEN ad.end_time IS NOT NULL THEN 
                EXTRACT(EPOCH FROM ((ad.end_time::time - ad.start_time::time))) / 60
              ELSE 0
            END
          )::int AS total_minutes
        FROM actions a
        JOIN action_dates ad ON ad.action_id = a.id
        JOIN action_technicians at ON at.action_id = a.id
        ${whereClause}
        GROUP BY at.technician_id, at.name, at.staff_id
        ORDER BY completed_actions DESC, total_minutes DESC
      `;
      const result = await client.query(sql, params);
      const rows: TechnicianPerformance[] = result.rows.map(r => ({
        technician_id: r.technician_id ?? undefined,
        name: r.name,
        staff_id: r.staff_id,
        actions_worked: Number(r.actions_worked) || 0,
        completed_actions: Number(r.completed_actions) || 0,
        total_minutes: Number(r.total_minutes) || 0,
      }));
      if (exportType === 'excel') {
        const workbook = new ExcelJS.Workbook();
        const ws = workbook.addWorksheet('Technician Performance');
        ws.columns = [
          { header: 'Staff ID', key: 'staff_id', width: 15 },
          { header: 'Technician Name', key: 'name', width: 30 },
          { header: 'Actions Worked', key: 'actions_worked', width: 18 },
          { header: 'Completed Actions', key: 'completed_actions', width: 20 },
          { header: 'Total Hours', key: 'total_hours', width: 14 },
        ];
        rows.forEach(r => {
          const hours = (r.total_minutes / 60);
          ws.addRow({
            staff_id: r.staff_id,
            name: r.name,
            actions_worked: r.actions_worked,
            completed_actions: r.completed_actions,
            total_hours: Math.round(hours * 100) / 100,
          });
        });
        const buffer = await workbook.xlsx.writeBuffer();
        return new NextResponse(buffer as unknown as BodyInit, {
          status: 200,
          headers: {
            'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'Content-Disposition': `attachment; filename="technician-performance.xlsx"`
          }
        });
      }
      return NextResponse.json<ApiResponse<TechnicianPerformance[]>>({ success: true, data: rows });
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Error generating technician performance:', error);
    return NextResponse.json<ApiResponse<null>>({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
