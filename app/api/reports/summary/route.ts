import { NextRequest, NextResponse } from 'next/server';
import pool from '@/app/lib/database';
import { ApiResponse } from '@/app/types';
import { requireRoleAtLeast } from '@/app/api/middleware';
import ExcelJS from 'exceljs';
import path from 'path';
import fs from 'fs';
export async function POST(request: NextRequest) {
  const auth = requireRoleAtLeast(request, 'user');
  if (auth instanceof NextResponse) return auth;
  try {
    const { searchTerm, dateFrom, dateTo } = await request.json();
    const client = await pool.connect();
    try {
      let query = `
        SELECT 
          wo.*,
          u.username as requested_by_username,
          u.first_name,
          u.last_name,
          COUNT(DISTINCT f.id) as findings_count,
          COUNT(DISTINCT a.id) as actions_count,
          COUNT(DISTINCT sp.id) as spare_parts_count,
          COUNT(DISTINCT jpb.id) as technicians_count
        FROM work_orders wo
        LEFT JOIN users u ON wo.requested_by_id = u.id
        LEFT JOIN findings f ON wo.id = f.work_order_id
        LEFT JOIN actions a ON f.id = a.finding_id
        LEFT JOIN spare_parts sp ON a.id = sp.action_id
        LEFT JOIN job_performed_by jpb ON wo.id = jpb.work_order_id
      `;
      const whereConditions = [];
      const queryParams = [];
      let paramCount = 0;
      if (searchTerm) {
        paramCount++;
        whereConditions.push(`(
          wo.work_order_no ILIKE $${paramCount} OR 
          wo.equipment_number ILIKE $${paramCount} OR 
          wo.work_type ILIKE $${paramCount} OR
          wo.requested_by ILIKE $${paramCount}
        )`);
        queryParams.push(`%${searchTerm}%`);
      }
      if (dateFrom) {
        paramCount++;
        whereConditions.push(`wo.work_order_date >= $${paramCount}`);
        queryParams.push(dateFrom);
      }
      if (dateTo) {
        paramCount++;
        whereConditions.push(`wo.work_order_date <= $${paramCount}`);
        queryParams.push(dateTo);
      }
      if (whereConditions.length > 0) {
        query += ` WHERE ${whereConditions.join(' AND ')}`;
      }
      query += `
        GROUP BY wo.id, u.username, u.first_name, u.last_name
        ORDER BY wo.created_at DESC
      `;
      const result = await client.query(query, queryParams);
      const workOrders = result.rows;
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet('Work Orders Summary');
      worksheet.columns = [
        { header: 'Work Order No.', key: 'work_order_no', width: 15 },
        { header: 'Date', key: 'work_order_date', width: 12 },
        { header: 'Equipment No.', key: 'equipment_number', width: 15 },
        { header: 'KM/Hrs', key: 'km_hrs', width: 10 },
        { header: 'Work Type', key: 'work_type', width: 15 },
        { header: 'Requested By', key: 'requested_by', width: 20 },
        { header: 'Status', key: 'status', width: 12 },
        { header: 'Findings', key: 'findings_count', width: 10 },
        { header: 'Actions', key: 'actions_count', width: 10 },
        { header: 'Spare Parts', key: 'spare_parts_count', width: 12 },
        { header: 'Technicians', key: 'technicians_count', width: 12 },
        { header: 'Created', key: 'created_at', width: 15 }
      ];
      const headerRow = worksheet.getRow(1);
      headerRow.font = { bold: true, color: { argb: 'FFFFFF' } };
      headerRow.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: '08398F' }
      };
      workOrders.forEach((wo, index) => {
        const row = worksheet.addRow({
          work_order_no: wo.work_order_no,
          work_order_date: wo.work_order_date,
          equipment_number: wo.equipment_number,
          km_hrs: wo.km_hrs || 'N/A',
          work_type: wo.work_type,
          requested_by: wo.requested_by || `${wo.first_name} ${wo.last_name}`,
          status: wo.status,
          findings_count: wo.findings_count,
          actions_count: wo.actions_count,
          spare_parts_count: wo.spare_parts_count,
          technicians_count: wo.technicians_count,
          created_at: new Date(wo.created_at).toLocaleDateString()
        });
        if (index % 2 === 1) {
          row.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'F8F9FA' }
          };
        }
        const statusCell = row.getCell('status');
        switch (wo.status) {
          case 'pending':
            statusCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF3CD' } };
            statusCell.font = { color: { argb: '856404' } };
            break;
          case 'ongoing':
            statusCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'D1ECF1' } };
            statusCell.font = { color: { argb: '0C5460' } };
            break;
          case 'completed':
            statusCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'D4EDDA' } };
            statusCell.font = { color: { argb: '155724' } };
            break;
          case 'rejected':
            statusCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'F8D7DA' } };
            statusCell.font = { color: { argb: '721C24' } };
            break;
        }
      });
      worksheet.eachRow((row) => {
        row.eachCell((cell) => {
          cell.border = {
            top: { style: 'thin' },
            left: { style: 'thin' },
            bottom: { style: 'thin' },
            right: { style: 'thin' }
          };
        });
      });
      worksheet.addRow([]);
      const totalFindings = workOrders.reduce((sum, wo) => sum + parseInt(wo.findings_count), 0);
      const totalActions = workOrders.reduce((sum, wo) => sum + parseInt(wo.actions_count), 0);
      const totalSpareParts = workOrders.reduce((sum, wo) => sum + parseInt(wo.spare_parts_count), 0);
      const totalTechnicians = workOrders.reduce((sum, wo) => sum + parseInt(wo.technicians_count), 0);
      worksheet.addRow(['Total Work Orders:', workOrders.length, '', '', '', '', '', totalFindings, totalActions, totalSpareParts, totalTechnicians, '']);
      worksheet.addRow(['Total Findings:', totalFindings, '', '', '', '', '', '', '', '', '', '']);
      worksheet.addRow(['Total Actions:', totalActions, '', '', '', '', '', '', '', '', '', '']);
      worksheet.addRow(['Total Spare Parts:', totalSpareParts, '', '', '', '', '', '', '', '', '', '']);
      for (let i = workOrders.length + 2; i <= workOrders.length + 5; i++) {
        const row = worksheet.getRow(i);
        row.font = { bold: true };
        row.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'E9ECEF' }
        };
      }
      const timestamp = Date.now();
      const filename = `ReportSummary_${timestamp}.xlsx`;
      const outputPath = path.join(process.cwd(), 'public', 'uploads', filename);
      const uploadsDir = path.dirname(outputPath);
      if (!fs.existsSync(uploadsDir)) {
        fs.mkdirSync(uploadsDir, { recursive: true });
      }
      await workbook.xlsx.writeFile(outputPath);
      const apiBase = (process.env.NEXT_PUBLIC_API_BASE_URL || '/wms/api').replace(/\/$/, '');
      const basePath = apiBase.endsWith('/api') ? apiBase.slice(0, -4) : '';
      const downloadUrl = `${basePath}/uploads/${filename}`;
      return NextResponse.json<ApiResponse<{ downloadUrl: string }>>({
        success: true,
        data: { downloadUrl }
      });
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Error generating summary report:', error);
    return NextResponse.json<ApiResponse<null>>({
      success: false,
      error: 'Internal server error'
    }, { status: 500 });
  }
}
