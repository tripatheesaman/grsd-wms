import { NextRequest, NextResponse } from 'next/server';
import pool from '@/app/lib/database';
import { ApiResponse } from '@/app/types';
import { requireRoleAtLeast } from '@/app/api/middleware';
import { ExcelHelper } from '@/app/utils/excel';
import path from 'path';
export async function GET(request: NextRequest) {
  const auth = requireRoleAtLeast(request, 'admin');
  if (auth instanceof NextResponse) return auth;
  try {
    const { searchParams } = new URL(request.url);
    const fromDate = searchParams.get('fromDate');
    const toDate = searchParams.get('toDate');
    if (!fromDate || !toDate) {
      return NextResponse.json<ApiResponse<null>>({
        success: false,
        error: 'From date and to date are required'
      }, { status: 400 });
    }
    const fromDateObj = new Date(fromDate);
    const toDateObj = new Date(toDate);
    if (isNaN(fromDateObj.getTime()) || isNaN(toDateObj.getTime())) {
      return NextResponse.json<ApiResponse<null>>({
        success: false,
        error: 'Invalid date format. Use YYYY-MM-DD'
      }, { status: 400 });
    }
    if (fromDateObj > toDateObj) {
      return NextResponse.json<ApiResponse<null>>({
        success: false,
        error: 'From date cannot be after to date'
      }, { status: 400 });
    }
    const client = await pool.connect();
    try {
      const workOrdersResult = await client.query(`
        SELECT 
          work_order_no,
          work_type,
          status,
          work_order_date,
          work_completed_date,
          completion_approved_at
        FROM work_orders
        WHERE (
          -- Work orders that started within the date range
          (work_order_date >= $1 AND work_order_date <= $2)
          OR
          -- Work orders that started before the date range but are still ongoing
          (work_order_date < $1 AND status IN ('pending', 'ongoing', 'completion_requested'))
          OR
          -- Work orders that completed within the date range
          (work_completed_date IS NOT NULL AND work_completed_date >= $1 AND work_completed_date <= $2)
          OR
          -- Work orders that were approved for completion within the date range
          (completion_approved_at IS NOT NULL AND completion_approved_at >= $1 AND completion_approved_at <= $2)
        )
        ORDER BY work_order_date, work_order_no
      `, [fromDate, toDate]);
      const workOrders = workOrdersResult.rows;
      const categorizeWorkType = (workType: string): string => {
        const type = workType.toLowerCase().trim();
        if (type === 'fabrication') return 'fabrication';
        if (type === 'wheel' || type === 'tyre') return 'wheel_tyre';
        if (type === 'dent' || type === 'paint') return 'dent_paint';
        if (type === 'battery' || type === 'electrical') return 'battery_electrical';
        if (type === 'uld containers') return 'uld_containers';
        if (type === 'mechanical') return 'mechanical';
        if (type.includes('fabrication')) return 'fabrication';
        if (type.includes('wheel') || type.includes('tyre') || type.includes('tire')) return 'wheel_tyre';
        if (type.includes('dent') || type.includes('paint')) return 'dent_paint';
        if (type.includes('battery') || type.includes('electrical')) return 'battery_electrical';
        if (type.includes('uld') || type.includes('container')) return 'uld_containers';
        if (type.includes('mechanical')) return 'mechanical';
        return 'miscellaneous';
      };
      const categories = [
        'fabrication',
        'wheel_tyre', 
        'dent_paint',
        'battery_electrical',
        'uld_containers',
        'mechanical',
        'miscellaneous'
      ];
      const categoryData = new Map<string, {
        ongoing: { count: number; workOrderNos: string[] };
        completed: { count: number; workOrderNos: string[] };
      }>();
      categories.forEach(cat => {
        categoryData.set(cat, {
          ongoing: { count: 0, workOrderNos: [] },
          completed: { count: 0, workOrderNos: [] }
        });
      });
      workOrders.forEach(wo => {
        const category = categorizeWorkType(wo.work_type);
        const data = categoryData.get(category);
        if (data) {
          const isCompleted = wo.status === 'completed' && wo.completion_approved_at;
          const hasCompletionDate = wo.work_completed_date;
          const toDateObj = new Date(toDate);
          let isOngoing = false;
          let isCompletedForReport = false;
          if (isCompleted && hasCompletionDate) {
            const completionDate = new Date(wo.work_completed_date);
            if (completionDate <= toDateObj) {
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
        }
      });
      const templatePath = path.join(process.cwd(), 'public', 'template_weekly.xlsx');
      const excelHelper = await ExcelHelper.loadTemplate(templatePath, 'Template Sheet');
      const today = new Date().toISOString().split('T')[0];
      excelHelper.setCellValue('F1', today);
      const getWeekNumber = (date: Date): number => {
        const firstDayOfYear = new Date(date.getFullYear(), 0, 1);
        const pastDaysOfYear = (date.getTime() - firstDayOfYear.getTime()) / 86400000;
        return Math.ceil((pastDaysOfYear + firstDayOfYear.getDay() + 1) / 7);
      };
      const toDateForWeek = new Date(toDate);
      const weekNumber = getWeekNumber(toDateForWeek);
      excelHelper.setCellValue('F2', weekNumber);
      excelHelper.setCellValue('D3', fromDate);
      excelHelper.setCellValue('F3', toDate);
      const categoryRows = [
        { category: 'fabrication', row: 6 },
        { category: 'wheel_tyre', row: 7 },
        { category: 'dent_paint', row: 8 },
        { category: 'battery_electrical', row: 9 },
        { category: 'uld_containers', row: 10 },
        { category: 'mechanical', row: 11 },
        { category: 'miscellaneous', row: 12 }
      ];
      categoryRows.forEach(({ category, row }) => {
        const data = categoryData.get(category);
        if (!data) return;
        excelHelper.setCellValue(`C${row}`, data.ongoing.count);
        excelHelper.setCellValue(`D${row}`, data.completed.count);
        const workOrderStrings = [];
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
          'Content-Disposition': `attachment; filename="ProgressReport_${fromDate}_to_${toDate}.xlsx"`
        }
      });
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Error generating progress report:', error);
    return NextResponse.json<ApiResponse<null>>({
      success: false,
      error: 'Internal server error'
    }, { status: 500 });
  }
}
