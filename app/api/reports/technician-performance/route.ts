import { NextRequest, NextResponse } from 'next/server';
import pool from '@/app/lib/database';
import { ApiResponse, TechnicianPerformance } from '@/app/types';
import { requireRoleAtLeast } from '@/app/api/middleware';
import { formatTechnicianNameWithDesignation } from '@/app/utils/textFormat';
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
          tech_rows.technician_id AS technician_id,
          tech_rows.name AS name,
          tech_rows.staff_id AS staff_id,
          MAX(tech_rows.designation) AS designation,
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
        JOIN LATERAL (
          SELECT adt.technician_id, adt.name, adt.staff_id,
            COALESCE(
              NULLIF(trim(t_adt.designation), ''),
              (
                SELECT NULLIF(trim(tx.designation), '')
                FROM technicians tx
                WHERE trim(tx.staff_id) = trim(adt.staff_id)
                  AND NULLIF(trim(tx.designation), '') IS NOT NULL
                ORDER BY tx.id
                LIMIT 1
              )
            ) AS designation,
            adt.created_at
          FROM action_date_technicians adt
          LEFT JOIN technicians t_adt ON t_adt.id = adt.technician_id
          WHERE adt.action_date_id = ad.id

          UNION ALL

          SELECT at.technician_id, at.name, at.staff_id,
            COALESCE(
              NULLIF(trim(t_at.designation), ''),
              (
                SELECT NULLIF(trim(tx.designation), '')
                FROM technicians tx
                WHERE trim(tx.staff_id) = trim(at.staff_id)
                  AND NULLIF(trim(tx.designation), '') IS NOT NULL
                ORDER BY tx.id
                LIMIT 1
              )
            ) AS designation,
            at.created_at
          FROM action_technicians at
          LEFT JOIN technicians t_at ON t_at.id = at.technician_id
          WHERE at.action_id = a.id
            AND NOT EXISTS (
              SELECT 1
              FROM action_date_technicians adt_existing
              WHERE adt_existing.action_date_id = ad.id
            )
        ) AS tech_rows ON TRUE
        ${whereClause}
        GROUP BY tech_rows.technician_id, tech_rows.name, tech_rows.staff_id
        ORDER BY completed_actions DESC, total_minutes DESC
      `;
      const result = await client.query(sql, params);
      const rows: TechnicianPerformance[] = result.rows.map(r => ({
        technician_id: r.technician_id ?? undefined,
        name: r.name,
        staff_id: r.staff_id,
        designation: r.designation ?? null,
        actions_worked: Number(r.actions_worked) || 0,
        completed_actions: Number(r.completed_actions) || 0,
        total_minutes: Number(r.total_minutes) || 0,
      }));
      if (exportType === 'excel') {
        const workbook = new ExcelJS.Workbook();
        const ws = workbook.addWorksheet('Technician Performance');
        ws.columns = [
          { header: 'Staff ID', key: 'staff_id', width: 15 },
          { header: 'Technician Name', key: 'name', width: 40 },
          { header: 'Actions Worked', key: 'actions_worked', width: 18 },
          { header: 'Completed Actions', key: 'completed_actions', width: 20 },
          { header: 'Total Hours', key: 'total_hours', width: 14 },
        ];
        rows.forEach(r => {
          const hours = (r.total_minutes / 60);
          ws.addRow({
            staff_id: r.staff_id,
            name: formatTechnicianNameWithDesignation(r.name, r.designation),
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
