import { NextRequest, NextResponse } from 'next/server';
import pool from '@/app/lib/database';
import { ApiResponse } from '@/app/types';
import { requireRoleAtLeast } from '@/app/api/middleware';
import { ExcelHelper, formatTime, formatDate } from '@/app/utils/excel';
import path from 'path';

export async function GET(request: NextRequest) {
  const auth = requireRoleAtLeast(request, 'user');
  if (auth instanceof NextResponse) return auth;

  try {
    const { searchParams } = new URL(request.url);
    const workOrderId = searchParams.get('workOrderId');
    if (!workOrderId) {
      return NextResponse.json<ApiResponse<null>>({
        success: false,
        error: 'Work order ID is required'
      }, { status: 400 });
    }

    const client = await pool.connect();
    try {
      const workOrderResult = await client.query(`
        SELECT 
          wo.*,
          u.username as requested_by_username,
          u.first_name,
          u.last_name
        FROM work_orders wo
        LEFT JOIN users u ON wo.requested_by_id = u.id
        WHERE wo.id = $1
      `, [workOrderId]);

      if (workOrderResult.rows.length === 0) {
        return NextResponse.json<ApiResponse<null>>({
          success: false,
          error: 'Work order not found'
        }, { status: 404 });
      }

      const workOrder = workOrderResult.rows[0];

      const findingsResult = await client.query(`
        SELECT 
          f.*,
          json_agg(
            json_build_object(
              'id', a.id,
              'description', a.description,
              'action_date', a.action_date,
              'start_time', a.start_time,
              'end_time', a.end_time,
              'spare_parts', (
                SELECT json_agg(
                  json_build_object(
                    'id', sp.id,
                    'part_name', sp.part_name,
                    'part_number', sp.part_number,
                    'quantity', sp.quantity
                  )
                )
                FROM spare_parts sp
                WHERE sp.action_id = a.id
              ),
              'action_dates', (
                SELECT json_agg(
                  json_build_object(
                    'id', ad.id,
                    'action_id', ad.action_id,
                    'action_date', ad.action_date,
                    'start_time', ad.start_time,
                    'end_time', ad.end_time,
                    'is_completed', ad.is_completed
                  ) ORDER BY ad.action_date ASC
                )
                FROM action_dates ad
                WHERE ad.action_id = a.id
              )
            )
          ) as actions
        FROM findings f
        LEFT JOIN actions a ON f.id = a.finding_id
        WHERE f.work_order_id = $1
        GROUP BY f.id
        ORDER BY f.id
      `, [workOrderId]);

      const techniciansResult = await client.query(`
        SELECT at.name, at.staff_id, a.id as action_id
        FROM action_technicians at
        JOIN actions a ON a.id = at.action_id
        JOIN findings f ON f.id = a.finding_id
        WHERE f.work_order_id = $1
        ORDER BY at.name, at.staff_id
      `, [workOrderId]);

      const templatePath = path.join(process.cwd(), 'public', 'template_file.xlsx');
      const excelHelper = await ExcelHelper.loadTemplate(templatePath, 'Template Sheet');

      excelHelper.setCellValue('E1', workOrder.work_order_no);
      excelHelper.setCellValue('E2', formatDate(workOrder.work_order_date));
      excelHelper.setCellValue('E3', workOrder.equipment_number);
      excelHelper.setCellValue('E4', workOrder.km_hrs || 'N/A');
      excelHelper.setCellValue('E5', workOrder.work_type);
      excelHelper.setCellValue('C12', `Job Requested By: ${workOrder.requested_by}`);
      excelHelper.setCellValue('A12', `Job Allocated By: ${workOrder.first_name} ${workOrder.last_name}`);

      const findings = findingsResult.rows.filter(finding => finding && finding.description && finding.description.trim() !== '');
      let currentRow = 8;
      let findingsExceededLimit = false;
      let findingsEndRow = 7; 
      const firstFindingDataRow = 8;
      for (let i = 0; i < Math.min(findings.length, 3); i++) {
        const finding = findings[i];
        excelHelper.setCellValue(`A${currentRow}`, i + 1);
        excelHelper.setCellValue(`B${currentRow}`, finding.description);
        excelHelper.safeMergeCells(`B${currentRow}:E${currentRow}`);
        currentRow++;
      }
      findingsEndRow = currentRow - 1;

      if (findings.length > 3) {
        findingsExceededLimit = true;
        for (let i = 3; i < findings.length; i++) {
          const newRowNumber = excelHelper.copyRowAndInsertAbove(firstFindingDataRow, currentRow, ['A', 'B', 'C', 'D', 'E']);
          excelHelper.setCellValue(`A${newRowNumber}`, i + 1);
          excelHelper.setCellValue(`B${newRowNumber}`, findings[i].description);
          excelHelper.safeMergeCells(`B${newRowNumber}:E${newRowNumber}`);
          currentRow = newRowNumber + 1;
        }
        findingsEndRow = currentRow - 1;
      }

      let actionRow = 15; 
      let actionsExceededLimit = false;
  type ActionDateRecord = { action_date: string; start_time?: string | null; end_time?: string | null; };

  const allActions: Array<{ id: number; description: string; action_date: string; start_time: string; end_time: string; action_dates?: Array<ActionDateRecord> }> = [];
      for (const finding of findings) {
        if (finding.actions && Array.isArray(finding.actions)) {
          for (const action of finding.actions) {
            if (action && action.id && action.description && action.description.trim() !== '') {
              allActions.push(action);
            }
          }
        }
      }
      const actionIdToSymbolNumber = new Map<number, number>();
      if (allActions.length > 0) {
        if (findings.length <= 3) {
          actionRow = 15;
        } else {
          actionRow = findingsEndRow + 4; 
        }
        const firstActionDataRow = actionRow;

        for (let i = 0; i < Math.min(allActions.length, 3); i++) {
          const action = allActions[i];
          excelHelper.setCellValue(`A${actionRow}`, i + 1);
          actionIdToSymbolNumber.set(action.id, i + 1);
          excelHelper.setCellValue(`B${actionRow}`, action.description);
            if (action.action_dates && Array.isArray(action.action_dates) && action.action_dates.length > 0) {
            const sortedDates = (action.action_dates as ActionDateRecord[]).slice().sort((a: ActionDateRecord, b: ActionDateRecord) => new Date(a.action_date).getTime() - new Date(b.action_date).getTime());
            const startDate = sortedDates[0].action_date;
            const endDate = sortedDates[sortedDates.length - 1].action_date;
            const startTime = sortedDates.find((d: ActionDateRecord) => d.start_time)?.start_time || action.start_time;
            let endTime: string | null | undefined = action.end_time;
            for (let idx = sortedDates.length - 1; idx >= 0; idx--) {
              if (sortedDates[idx].end_time) { endTime = sortedDates[idx].end_time; break; }
            }
            excelHelper.setCellValue(`C${actionRow}`, formatTime(startTime));
            excelHelper.setCellValue(`D${actionRow}`, formatTime(endTime || ''));
            if (startDate === endDate) {
              excelHelper.setCellValue(`E${actionRow}`, formatDate(startDate));
            } else {
              excelHelper.setCellValue(`E${actionRow}`, `${formatDate(startDate)}-${formatDate(endDate)}`);
            }
          } else {
            excelHelper.setCellValue(`C${actionRow}`, formatTime(action.start_time));
            excelHelper.setCellValue(`D${actionRow}`, formatTime(action.end_time));
            excelHelper.setCellValue(`E${actionRow}`, formatDate(action.action_date));
          }
          actionRow++;
        }


        if (allActions.length > 3) {
          actionsExceededLimit = true;
          for (let i = 3; i < allActions.length; i++) {
            const newRowNumber = excelHelper.copyRowAndInsertAbove(firstActionDataRow, actionRow, ['A', 'B', 'C', 'D', 'E']);
            const action = allActions[i];
            excelHelper.setCellValue(`A${newRowNumber}`, i + 1);
            actionIdToSymbolNumber.set(action.id, i + 1);
            excelHelper.setCellValue(`B${newRowNumber}`, action.description);
              if (action.action_dates && Array.isArray(action.action_dates) && action.action_dates.length > 0) {
              const sortedDates = (action.action_dates as ActionDateRecord[]).slice().sort((a: ActionDateRecord, b: ActionDateRecord) => new Date(a.action_date).getTime() - new Date(b.action_date).getTime());
              const startDate = sortedDates[0].action_date;
              const endDate = sortedDates[sortedDates.length - 1].action_date;
              const startTime = sortedDates.find((d: ActionDateRecord) => d.start_time)?.start_time || action.start_time;
              let endTime: string | null | undefined = action.end_time;
              for (let idx = sortedDates.length - 1; idx >= 0; idx--) {
                if (sortedDates[idx].end_time) { endTime = sortedDates[idx].end_time; break; }
              }
              excelHelper.setCellValue(`C${newRowNumber}`, formatTime(startTime));
              excelHelper.setCellValue(`D${newRowNumber}`, formatTime(endTime || ''));
              if (startDate === endDate) {
                excelHelper.setCellValue(`E${newRowNumber}`, formatDate(startDate));
              } else {
                excelHelper.setCellValue(`E${newRowNumber}`, `${formatDate(startDate)}-${formatDate(endDate)}`);
              }
            } else {
              excelHelper.setCellValue(`C${newRowNumber}`, formatTime(action.start_time));
              excelHelper.setCellValue(`D${newRowNumber}`, formatTime(action.end_time));
              excelHelper.setCellValue(`E${newRowNumber}`, formatDate(action.action_date));
            }
            actionRow = newRowNumber + 1;
          }

        }
      }

      let sparePartRow = 20; 
      let sparePartsExceededLimit = false;
       const allSpareParts = [];
       for (const finding of findings) {
         if (finding.actions && Array.isArray(finding.actions)) {
           for (const action of finding.actions) {
             if (action && action.id && action.spare_parts && Array.isArray(action.spare_parts)) {
               for (const sparePart of action.spare_parts) {
                 if (sparePart && sparePart.id && sparePart.part_name && sparePart.part_name.trim() !== '') {
                   allSpareParts.push(sparePart);
                 }
               }
             }
           }
         }
       }
      if (allSpareParts.length > 0) {
         if (!findingsExceededLimit && !actionsExceededLimit && allSpareParts.length <= 4) {
           sparePartRow = 20;
         } else {
           const extraFindingsRows = findings.length > 3 ? findings.length - 3 : 0;
           const extraActionsRows = allActions.length > 3 ? allActions.length - 3 : 0;
           sparePartRow = 20 + extraFindingsRows + extraActionsRows;
         }
         const firstSparePartDataRow = sparePartRow;
        for (let i = 0; i < Math.min(allSpareParts.length, 4); i++) {
          const sparePart = allSpareParts[i];
          excelHelper.setCellValue(`A${sparePartRow}`, i + 1);
          excelHelper.setCellValue(`B${sparePartRow}`, sparePart.part_name);
          excelHelper.setCellValue(`C${sparePartRow}`, sparePart.part_number);
          const quantityDisplay = sparePart.unit ? `${sparePart.quantity} ${sparePart.unit}` : sparePart.quantity;
          excelHelper.setCellValue(`D${sparePartRow}`, quantityDisplay);
           sparePartRow++;
         }


        if (allSpareParts.length > 4) {
          sparePartsExceededLimit = true;
          for (let i = 4; i < allSpareParts.length; i++) {
            const newRowNumber = excelHelper.copyRowAndInsertAbove(firstSparePartDataRow, sparePartRow, ['A', 'B', 'C', 'D', 'E']);
            const sparePart = allSpareParts[i];
            excelHelper.setCellValue(`A${newRowNumber}`, i + 1);
            excelHelper.setCellValue(`B${newRowNumber}`, sparePart.part_name);
            excelHelper.setCellValue(`C${newRowNumber}`, sparePart.part_number);
            const quantityDisplay = sparePart.unit ? `${sparePart.quantity} ${sparePart.unit}` : sparePart.quantity;
            excelHelper.setCellValue(`D${newRowNumber}`, quantityDisplay);
             sparePartRow = newRowNumber + 1;
           }

         }
       }

      let technicianRow = 26; 
      const perActionTechRows = techniciansResult.rows as Array<{ name: string; staff_id: string; action_id: number }>; 
      const techKeyToData = new Map<string, { name: string; staff_id: string; symbols: number[] }>();
      for (const row of perActionTechRows) {
        if (!row || !row.name || row.name.trim() === '') continue;
        const key = `${row.staff_id}||${row.name.trim()}`;
        const symbol = actionIdToSymbolNumber.get(row.action_id);
        if (symbol === undefined) continue;
        if (!techKeyToData.has(key)) {
          techKeyToData.set(key, { name: row.name.trim(), staff_id: row.staff_id, symbols: [symbol] });
        } else {
          const entry = techKeyToData.get(key)!;
          if (!entry.symbols.includes(symbol)) entry.symbols.push(symbol);
        }
      }
      const technicians = Array.from(techKeyToData.values()).map(t => ({
        name: t.name,
        staff_id: t.staff_id,
        symbolsCsv: t.symbols.sort((a, b) => a - b).join(',')
      }));
      if (!findingsExceededLimit && !actionsExceededLimit && !sparePartsExceededLimit && technicians.length <= 3) {
        technicianRow = 26;
      } else {
        const extraFindingsRows = findings.length > 3 ? findings.length - 3 : 0;
        const extraActionsRows = allActions.length > 3 ? allActions.length - 3 : 0;
        const extraSparePartsRows = allSpareParts.length > 4 ? allSpareParts.length - 4 : 0;
        technicianRow = 26 + extraFindingsRows + extraActionsRows + extraSparePartsRows;
      }
         const firstTechnicianDataRow = technicianRow;
        for (let i = 0; i < Math.min(technicians.length, 3); i++) {
          const technician = technicians[i];
          excelHelper.setCellValue(`A${technicianRow}`, i + 1);
          excelHelper.setCellValue(`B${technicianRow}`, technician.name);
          excelHelper.setCellValue(`C${technicianRow}`, technician.symbolsCsv);
          excelHelper.setCellValue(`D${technicianRow}`, technician.staff_id);
           technicianRow++;
         }


      if (technicians.length > 3) {
        for (let i = 3; i < technicians.length; i++) {
          const newRowNumber = excelHelper.copyRowAndInsertAbove(firstTechnicianDataRow, technicianRow, ['A', 'B', 'C', 'D', 'E']);
          const technician = technicians[i];
          excelHelper.setCellValue(`A${newRowNumber}`, i + 1);
          excelHelper.setCellValue(`B${newRowNumber}`, technician.name);
          excelHelper.setCellValue(`C${newRowNumber}`, technician.symbolsCsv);
          excelHelper.setCellValue(`D${newRowNumber}`, technician.staff_id);
           technicianRow = newRowNumber + 1;
         }

       }

      const buffer = await excelHelper.getBuffer();

      return new NextResponse(new Uint8Array(buffer), {
        headers: {
          'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'Content-Disposition': `attachment; filename="WorkOrderReport_${workOrder.work_order_no}_${Date.now()}.xlsx"`
        }
      });

    } finally {
      client.release();
    }

  } catch (error) {
    console.error('Error generating work order report:', error);
    return NextResponse.json<ApiResponse<null>>({
      success: false,
      error: 'Internal server error'
    }, { status: 500 });
  }
}
