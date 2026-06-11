import { NextRequest, NextResponse } from 'next/server';
import pool from '@/app/lib/database';
import { ApiResponse } from '@/app/types';
import { requireRoleAtLeast } from '@/app/api/middleware';
import { ExcelHelper, formatTime, calculateDuration, getTechnicianInitials } from '@/app/utils/excel';
import path from 'path';
import { ensureSectionSchema } from '@/app/lib/ensureSections';
import { appendSectionFilter } from '@/app/lib/sectionAccess';

export async function GET(request: NextRequest) {
  const auth = requireRoleAtLeast(request, 'incharge');
  if (auth instanceof NextResponse) return auth;

  const { searchParams } = request.nextUrl;
  const fromDate = searchParams.get('fromDate');
  const toDate = searchParams.get('toDate');

  if (!fromDate || !toDate) {
    return NextResponse.json<ApiResponse<null>>(
      { success: false, error: 'fromDate and toDate are required' },
      { status: 400 },
    );
  }

  const client = await pool.connect();
  try {
    await ensureSectionSchema(client);

    const params: unknown[] = [fromDate, toDate];
    let query = `
      SELECT 
        ad.id as action_date_id,
        ad.action_date,
        ad.start_time,
        ad.end_time,
        ad.is_completed,
        a.id as action_id,
        a.description as action_description,
        f.id as finding_id,
        f.work_order_id,
        wo.work_order_no,
        wo.equipment_number,
        wo.work_type,
        wo.km_hrs
      FROM action_dates ad
      JOIN actions a ON ad.action_id = a.id
      JOIN findings f ON a.finding_id = f.id
      JOIN work_orders wo ON f.work_order_id = wo.id
      WHERE ad.action_date BETWEEN $1 AND $2
    `;
    query += appendSectionFilter(auth, request, 'wo.section', params);
    query += `
      ORDER BY ad.action_date ASC, wo.work_order_no ASC, a.id ASC
    `;

    const result = await client.query(query, params);

    if (result.rows.length === 0) {
      return NextResponse.json<ApiResponse<null>>(
        { success: false, error: 'No actions found for the selected date range' },
        { status: 404 },
      );
    }

    const workOrderIds = Array.from(
      new Set(result.rows.map((row) => Number(row.work_order_id)).filter((id) => !Number.isNaN(id))),
    );
    const completionByWorkOrder = new Map<number, boolean>();
    if (workOrderIds.length > 0) {
      const completionResult = await client.query(
        `SELECT id AS work_order_id, status
         FROM work_orders
         WHERE id = ANY($1::int[])`,
        [workOrderIds],
      );
      for (const row of completionResult.rows) {
        completionByWorkOrder.set(Number(row.work_order_id), row.status === 'completed');
      }
    }

    const actionData: Array<{
      action_date_id: number;
      action_date: string;
      start_time: string;
      end_time: string;
      is_completed: boolean;
      action_id: number;
      action_description: string;
      finding_id: number;
      work_order_id: number;
      work_order_no: string;
      equipment_number: string;
      work_type: string;
      km_hrs: string | number | null;
      spare_parts: Array<{ part_number: string; quantity: string | number }>;
      technicians: Array<{ name: string; staff_id: string }>;
    }> = [];

    for (const row of result.rows) {
      const sparePartsResult = await client.query(
        `SELECT part_number, quantity FROM spare_parts WHERE action_id = $1`,
        [row.action_id],
      );

      const techniciansResult = await client.query(
        `SELECT DISTINCT tech_rows.name, tech_rows.staff_id
         FROM (
           SELECT adt.name, adt.staff_id, adt.created_at
           FROM action_date_technicians adt
           WHERE adt.action_date_id = $1

           UNION ALL

           SELECT at.name, at.staff_id, at.created_at
           FROM action_technicians at
           WHERE at.action_id = $2
             AND NOT EXISTS (
               SELECT 1
               FROM action_date_technicians adt_existing
               WHERE adt_existing.action_date_id = $1
             )
         ) AS tech_rows
         ORDER BY tech_rows.name ASC`,
        [row.action_date_id, row.action_id],
      );

      actionData.push({
        ...row,
        spare_parts: sparePartsResult.rows,
        technicians: techniciansResult.rows,
      });
    }

    const templatePath = path.join(process.cwd(), 'public', 'job_allocation_template_file.xlsx');
    const excelHelper = await ExcelHelper.loadTemplate(templatePath, 'Template Sheet');

    let currentRow = 5;
    const templateRow = 5;

    for (let i = 0; i < actionData.length; i++) {
      const data = actionData[i];

      if (i > 0) {
        currentRow++;
        excelHelper.copyRowAndInsertAbove(templateRow, currentRow, [
          'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M',
        ]);
      }

      excelHelper.setCellValue(`A${currentRow}`, data.equipment_number || '');
      excelHelper.setCellValue(`B${currentRow}`, data.work_order_no || '');
      excelHelper.setCellValue(`C${currentRow}`, data.action_description || '');
      excelHelper.setCellValue(`D${currentRow}`, formatTime(data.start_time));
      excelHelper.setCellValue(`E${currentRow}`, formatTime(data.end_time));
      excelHelper.setCellValue(`F${currentRow}`, calculateDuration(data.start_time, data.end_time));
      excelHelper.setCellValue(`G${currentRow}`, data.km_hrs || '');
      excelHelper.setCellValue(
        `H${currentRow}`,
        data.spare_parts.map((sp) => sp.part_number).join(', '),
      );
      excelHelper.setCellValue(
        `I${currentRow}`,
        data.spare_parts.map((sp) => sp.quantity).join(', '),
      );
      excelHelper.setCellValue(`J${currentRow}`, data.is_completed ? '✓' : '');
      excelHelper.setCellValue(
        `L${currentRow}`,
        completionByWorkOrder.get(Number(data.work_order_id)) ? 'R' : '',
      );
      excelHelper.setCellValue(
        `M${currentRow}`,
        data.technicians.map((tech) => getTechnicianInitials(tech.name)).join(', '),
      );
    }

    const buffer = await excelHelper.getBuffer();
    return new NextResponse(buffer as BodyInit, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="JobAllocationReport_${fromDate}_to_${toDate}_${Date.now()}.xlsx"`,
      },
    });
  } catch (error) {
    console.error('Error generating job allocation report:', error);
    return NextResponse.json<ApiResponse<null>>(
      { success: false, error: 'Failed to generate job allocation report' },
      { status: 500 },
    );
  } finally {
    client.release();
  }
}
