import ExcelJS from 'exceljs';
import path from 'path';
import fs from 'fs';

export interface ExcelCellStyle {
  font?: Partial<ExcelJS.Font>;
  fill?: Partial<ExcelJS.Fill>;
  border?: Partial<ExcelJS.Borders>;
  alignment?: Partial<ExcelJS.Alignment>;
}

export class ExcelHelper {
  private workbook: ExcelJS.Workbook;
  private worksheet: ExcelJS.Worksheet;

  constructor(templatePath: string, sheetName: string) {
    this.workbook = new ExcelJS.Workbook();
    this.worksheet = this.workbook.getWorksheet(sheetName) || this.workbook.addWorksheet(sheetName);
  }

  static async loadTemplate(templatePath: string, sheetName: string): Promise<ExcelHelper> {
    const helper = new ExcelHelper(templatePath, sheetName);
    await helper.workbook.xlsx.readFile(templatePath);
    helper.worksheet = helper.workbook.getWorksheet(sheetName) || helper.workbook.addWorksheet(sheetName);
    return helper;
  }

  getWorksheet(): ExcelJS.Worksheet {
    return this.worksheet;
  }

  setCellValue(cellAddress: string, value: ExcelJS.CellValue): void {
    this.worksheet.getCell(cellAddress).value = value;
  }

  safeMergeCells(range: string): void {
    try {
      const normalizedRange = range.toUpperCase();
      const existingMerges = this.worksheet.model.merges || [];

      const overlaps = existingMerges.some(existing => {
        const [start1, end1] = existing.split(':');
        const [start2, end2] = normalizedRange.split(':');
        if (!end1 || !end2) return false;
        const s1 = this.worksheet.getCell(start1);
        const e1 = this.worksheet.getCell(end1);
        const s2 = this.worksheet.getCell(start2);
        const e2 = this.worksheet.getCell(end2);
        return !(
          e1.row < s2.row ||
          s1.row > e2.row ||
          e1.col < s2.col ||
          s1.col > e2.col
        );
      });

      if (!overlaps) {
        this.worksheet.mergeCells(normalizedRange);
      }
    } catch (error) {
      console.warn(`Could not safely merge cells ${range}:`, error);
    }
  }

  forceMergeCells(range: string): void {
    try {
      const normalizedRange = range.toUpperCase();
      const [startCell, endCell] = normalizedRange.split(':');
      if (!endCell) return;

      const start = this.worksheet.getCell(startCell);
      const end = this.worksheet.getCell(endCell);
      const sRow = start.row;
      const eRow = end.row;
      const sCol = start.col;
      const eCol = end.col;

      const existingMerges = this.worksheet.model.merges || [];
      for (const existing of existingMerges) {
        const [exStart, exEnd] = existing.split(':');
        const s1 = this.worksheet.getCell(exStart);
        const e1 = this.worksheet.getCell(exEnd);
        const overlaps = !(
          e1.row < sRow || s1.row > eRow || e1.col < sCol || s1.col > eCol
        );
        if (overlaps) {
          try {
            this.worksheet.unMergeCells(existing);
          } catch {}
        }
      }

      this.worksheet.mergeCells(normalizedRange);
    } catch (error) {
      console.warn(`Could not merge cells ${range}:`, error);
    }
  }

  unmergeRowRange(startRow: number, endRow: number): void {
    const merges = [...(this.worksheet.model.merges || [])];
    for (const merge of merges) {
      try {
        const [startCell, endCell] = merge.split(':');
        const mergeStartRow = this.worksheet.getCell(startCell).row;
        const mergeEndRow = this.worksheet.getCell(endCell).row;
        if (Number(mergeStartRow) >= startRow && Number(mergeEndRow) <= endRow) {
          this.worksheet.unMergeCells(merge);
        }
      } catch {}
    }
  }

  insertRowAfter(rowNumber: number): number {
    this.worksheet.insertRow(rowNumber + 1, rowNumber + 1);
    return rowNumber + 1;
  }

  insertRowWithFormatting(sourceRow: number, insertAboveRow: number, columns: string[]): number {
    this.unmergeRowRange(insertAboveRow, insertAboveRow);
    this.worksheet.insertRow(insertAboveRow, insertAboveRow);

    const sourceRowObj = this.worksheet.getRow(sourceRow);
    const newRowObj = this.worksheet.getRow(insertAboveRow);
    if (sourceRowObj.height) newRowObj.height = sourceRowObj.height;

    columns.forEach(col => {
      const sCell = this.worksheet.getCell(`${col}${sourceRow}`);
      const tCell = this.worksheet.getCell(`${col}${insertAboveRow}`);
      tCell.value = sCell.value;
      tCell.style = JSON.parse(JSON.stringify(sCell.style || {}));
      if (sCell.border) tCell.border = JSON.parse(JSON.stringify(sCell.border));
      if (sCell.fill) tCell.fill = JSON.parse(JSON.stringify(sCell.fill));
      if (sCell.font) tCell.font = JSON.parse(JSON.stringify(sCell.font));
      if (sCell.alignment) tCell.alignment = JSON.parse(JSON.stringify(sCell.alignment));
      if (sCell.numFmt) tCell.numFmt = sCell.numFmt;
      if (sCell.protection) tCell.protection = JSON.parse(JSON.stringify(sCell.protection));
    });

    return insertAboveRow;
  }

  copyRowAndInsertAbove(sourceRow: number, insertAboveRow: number, columns: string[]): number {
    this.worksheet.insertRow(insertAboveRow, insertAboveRow);
    const sRow = this.worksheet.getRow(sourceRow);
    const tRow = this.worksheet.getRow(insertAboveRow);
    if (sRow.height) tRow.height = sRow.height;

    columns.forEach(col => {
      const sCell = this.worksheet.getCell(`${col}${sourceRow}`);
      const tCell = this.worksheet.getCell(`${col}${insertAboveRow}`);
      tCell.value = sCell.value;
      tCell.style = JSON.parse(JSON.stringify(sCell.style || {}));
      if (sCell.border) tCell.border = JSON.parse(JSON.stringify(sCell.border));
      if (sCell.fill) tCell.fill = JSON.parse(JSON.stringify(sCell.fill));
      if (sCell.font) tCell.font = JSON.parse(JSON.stringify(sCell.font));
      if (sCell.alignment) tCell.alignment = JSON.parse(JSON.stringify(sCell.alignment));
    });
    return insertAboveRow;
  }

  applyBorder(cellAddress: string, borderStyle: Partial<ExcelJS.Borders>): void {
    const cell = this.worksheet.getCell(cellAddress);
    cell.border = borderStyle;
  }

  applyBorderToCells(cellAddresses: string[], borderStyle: Partial<ExcelJS.Borders>): void {
    cellAddresses.forEach(address => this.applyBorder(address, borderStyle));
  }

  mergeCellsWithBorders(range: string, borderStyle?: Partial<ExcelJS.Borders>): void {
    try {
      this.forceMergeCells(range);
      if (borderStyle) {
        const [startCell, endCell] = range.split(':');
        const startCol = startCell.replace(/\d/g, '');
        const endCol = endCell.replace(/\d/g, '');
        const row = startCell.replace(/\D/g, '');
        for (let c = startCol.charCodeAt(0); c <= endCol.charCodeAt(0); c++) {
          const colLetter = String.fromCharCode(c);
          this.applyBorder(`${colLetter}${row}`, borderStyle);
        }
      }
    } catch (error) {
      console.warn(`Could not merge cells with borders ${range}:`, error);
    }
  }

  copyRowFormatting(sourceRow: number, targetRow: number, columns: string[]): void {
    columns.forEach(col => {
      const s = this.worksheet.getCell(`${col}${sourceRow}`);
      const t = this.worksheet.getCell(`${col}${targetRow}`);
      t.style = { ...s.style };
      if (s.border) t.border = { ...s.border };
      if (s.fill) t.fill = { ...s.fill };
      if (s.font) t.font = { ...s.font };
      if (s.alignment) t.alignment = { ...s.alignment };
    });
  }

  copyRowStructure(sourceRow: number, targetRow: number, columns: string[]): void {
    this.copyRowFormatting(sourceRow, targetRow, columns);
    const s = this.worksheet.getRow(sourceRow);
    const t = this.worksheet.getRow(targetRow);
    if (s.height) t.height = s.height;
  }

  async saveToFile(outputPath: string): Promise<void> {
    const dir = path.dirname(outputPath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    await this.workbook.xlsx.writeFile(outputPath);
  }

  getBuffer(): Promise<Buffer> {
    return this.workbook.xlsx.writeBuffer() as unknown as Promise<Buffer>;
  }
}

export function formatTime(timeString: string): string {
  if (!timeString) return '';
  if (/^\d{2}:\d{2}$/.test(timeString)) return timeString;
  if (/^\d{2}:\d{2}:\d{2}$/.test(timeString)) return timeString.substring(0, 5);
  try {
    const date = new Date(timeString);
    if (!isNaN(date.getTime())) return date.toTimeString().substring(0, 5);
  } catch {
    console.warn('Could not parse time:', timeString);
  }
  return timeString;
}

export function formatDate(dateString: string): string {
  if (!dateString) return '';
  try {
    const date = new Date(dateString);
    if (!isNaN(date.getTime())) return date.toISOString().split('T')[0];
  } catch {
    console.warn('Could not parse date:', dateString);
  }
  return dateString;
}

export function calculateDuration(startTime: string, endTime: string): string {
  if (!startTime || !endTime) return '';
  try {
    const parseTime = (timeStr: string): { hours: number; minutes: number } => {
      const parts = timeStr.split(':').map(p => parseInt(p, 10));
      return { hours: parts[0] || 0, minutes: parts[1] || 0 };
    };
    const start = parseTime(startTime);
    const end = parseTime(endTime);
    let totalMinutes = (end.hours * 60 + end.minutes) - (start.hours * 60 + start.minutes);
    if (totalMinutes < 0) {
      totalMinutes += 24 * 60;
    }
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
  } catch (error) {
    console.warn('Could not calculate duration:', error);
    return '';
  }
}

export function getWorkTypeCode(workType: string): string {
  if (!workType) return '';
  const workTypeLower = workType.toLowerCase();
  if (workTypeLower === 'mechanical') return 'M';
  if (workTypeLower === 'electrical') return 'E';
  if (workTypeLower === 'hydraulics') return 'H';
  if (workTypeLower === 'schedule check') return 'SC';
  if (workTypeLower === 'electrical repair') return 'ER';
  if (workTypeLower === 'painting') return 'P';
  if (workTypeLower === 'miscellaneous') return 'MI';
  if (workTypeLower === 'customer request') return 'CR';
  if (workTypeLower === 'other') return 'O';
  if (workTypeLower.includes('electrical')) return 'E';
  if (workTypeLower.includes('mechanical')) return 'M';
  if (workTypeLower.includes('painting') || workTypeLower.includes('paint')) return 'P';
  if (workTypeLower.includes('hydraulic')) return 'H';
  if (workTypeLower.includes('schedule') && workTypeLower.includes('check')) return 'SC';
  if (workTypeLower.includes('miscellaneous')) return 'MI';
  if (workTypeLower.includes('customer')) return 'CR';
  return workType.substring(0, 2).toUpperCase();
}

export function getTechnicianInitials(name: string): string {
  if (!name) return '';
  const nameParts = name.trim().split(/\s+/);
  if (nameParts.length === 1) {
    return nameParts[0].substring(0, 2).toUpperCase();
  }
  return nameParts.map(part => part.charAt(0).toUpperCase()).join('');
}
