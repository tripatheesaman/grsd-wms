import { NextRequest, NextResponse } from 'next/server';
import pool from '@/app/lib/database';
import { ApiResponse } from '@/app/types';
import { requireRoleAtLeast } from '@/app/api/middleware';
import { ExcelHelper } from '@/app/utils/excel';
import path from 'path';
import { ensureSectionSchema } from '@/app/lib/ensureSections';
import { appendSectionFilter } from '@/app/lib/sectionAccess';
import { categorizeNemWorkType, NEM_WEEKLY_CATEGORIES } from '@/app/utils/workTypes';

export async function GET(request: NextRequest) {
  const auth = requireRoleAtLeast(request, 'incharge');
  if (auth instanceof NextResponse) return auth;

  try {
    const { searchParams } = new URL(request.url);
    const fromDate = searchParams.get('fromDate');
    const toDate = searchParams.get('toDate');
    if (!fromDate || !toDate) {
      return NextResponse.json<ApiResponse<null>>(
        { success: false, error: 'From date and to date are required' },
        { status: 400 },
      );
    }

    const fromDateObj = new Date(fromDate);
    const toDateObj = new Date(toDate);
    if (isNaN(fromDateObj.getTime()) || isNaN(toDateObj.getTime())) {
      return NextResponse.json<ApiResponse<null>>(
        { success: false, error: 'Invalid date format. Use YYYY-MM-DD' },
        { status: 400 },
      );
    }
    if (fromDateObj > toDateObj) {
      return NextResponse.json<ApiResponse<null>>(
        { success: false, error: 'From date cannot be after to date' },
        { status: 400 },
      );
    }

    const client = await pool.connect();
    try {
      await ensureSectionSchema(client);
      const params: unknown[] = [fromDate, toDate];
      const sectionSql = appendSectionFilter(auth, request, 'section', params);
      const workOrdersResult = await client.query(
        `
        SELECT 
          work_order_no,
          work_type,
          status,
          work_order_date,
          work_completed_date,
          completion_approved_at
        FROM work_orders
        WHERE (
          (work_order_date >= $1 AND work_order_date <= $2)
          OR
          (work_order_date < $1 AND status IN ('pending', 'ongoing', 'completion_requested'))
          OR
          (work_completed_date IS NOT NULL AND work_completed_date >= $1 AND work_completed_date <= $2)
          OR
          (completion_approved_at IS NOT NULL AND completion_approved_at >= $1 AND completion_approved_at <= $2)
        )${sectionSql}
        ORDER BY work_order_date, work_order_no
      `,
        params,
      );
      const workOrders = workOrdersResult.rows;

      const categoryData = new Map<
        string,
        {
          ongoing: { count: number; workOrderNos: string[] };
          completed: { count: number; workOrderNos: string[] };
        }
      >();
      NEM_WEEKLY_CATEGORIES.forEach((cat) => {
        categoryData.set(cat, {
          ongoing: { count: 0, workOrderNos: [] },
          completed: { count: 0, workOrderNos: [] },
        });
      });

      const reportToDate = new Date(toDate);
      workOrders.forEach((wo) => {
        const category = categorizeNemWorkType(wo.work_type);
        const data = categoryData.get(category);
        if (!data) return;

        const isCompleted = wo.status === 'completed' && wo.completion_approved_at;
        const hasCompletionDate = wo.work_completed_date;
        let isOngoing = false;
        let isCompletedForReport = false;

        if (isCompleted && hasCompletionDate) {
          const completionDate = new Date(wo.work_completed_date);
          if (completionDate <= reportToDate) {
            isCompletedForReport = true;
          } else {
            isOngoing = true;
          }
        } else if (wo.status === 'pending' || wo.status === 'ongoing' || wo.status === 'completion_requested') {
          isOngoing = true;
        } else if (wo.status === 'completed' && !hasCompletionDate) {
          isCompletedForReport = true;
        }

        if (isOngoing) {
          data.ongoing.count++;
          data.ongoing.workOrderNos.push(wo.work_order_no);
        } else if (isCompletedForReport) {
          data.completed.count++;
          data.completed.workOrderNos.push(wo.work_order_no);
        }
      });

      const templatePath = path.join(process.cwd(), 'public', 'template_weekly_nem.xlsx');
      const excelHelper = await ExcelHelper.loadTemplate(templatePath, 'Template Sheet');

      const today = new Date().toISOString().split('T')[0];
      excelHelper.setCellValue('F1', today);

      const getWeekNumber = (date: Date): number => {
        const firstDayOfYear = new Date(date.getFullYear(), 0, 1);
        const pastDaysOfYear = (date.getTime() - firstDayOfYear.getTime()) / 86400000;
        return Math.ceil((pastDaysOfYear + firstDayOfYear.getDay() + 1) / 7);
      };
      const weekNumber = getWeekNumber(new Date(toDate));
      excelHelper.setCellValue('F2', weekNumber);
      excelHelper.setCellValue('D3', fromDate);
      excelHelper.setCellValue('F3', toDate);

      const categoryRows = [
        { category: 'electrical', row: 6 },
        { category: 'hydraulic', row: 7 },
        { category: 'mechanical', row: 8 },
        { category: 'schedule_checks', row: 9 },
        { category: 'cargo_baggage', row: 10 },
        { category: 'fabrication', row: 11 },
        { category: 'paint', row: 12 },
        { category: 'miscellaneous', row: 13 },
      ];

      categoryRows.forEach(({ category, row }) => {
        const data = categoryData.get(category);
        if (!data) return;
        excelHelper.setCellValue(`C${row}`, data.ongoing.count);
        excelHelper.setCellValue(`D${row}`, data.completed.count);
        const workOrderStrings: string[] = [];
        if (data.ongoing.count > 0) {
          workOrderStrings.push(`Ongoing: ${data.ongoing.workOrderNos.join(', ')}`);
        }
        if (data.completed.count > 0) {
          workOrderStrings.push(`Completed: ${data.completed.workOrderNos.join(', ')}`);
        }
        if (workOrderStrings.length > 0) {
          excelHelper.setCellValue(`F${row}`, workOrderStrings.join('; '));
        }
      });

      const buffer = await excelHelper.getBuffer();
      return new NextResponse(new Uint8Array(buffer), {
        headers: {
          'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'Content-Disposition': `attachment; filename="WeeklySummaryReport_${fromDate}_to_${toDate}.xlsx"`,
        },
      });
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Error generating NEM weekly summary report:', error);
    return NextResponse.json<ApiResponse<null>>(
      { success: false, error: 'Internal server error' },
      { status: 500 },
    );
  }
}
