import ExcelJS from "exceljs";

export type DayType = "normal" | "sunday" | "poya" | "public_holiday";

export interface AttendanceRecord {
  dateStr: string; // YYYY-MM-DD
  dayType: DayType;
  inTime: number | null; // minutes since midnight
  outTime: number | null;
  punches: number[];
}

export interface EmployeeInfo {
  userId: string;
  name: string;
  dept: string;
}

export interface ParsedAttendance {
  employee: EmployeeInfo;
  records: AttendanceRecord[];
}

/*const COLOR_MAP: Record<string, DayType> = {
  FF0000: "sunday",
  FFFF00: "poya",
  "0000FF": "public_holiday",
};*/

function classifyColor(fill: ExcelJS.Fill | undefined): DayType {
  if (!fill || fill.type !== "pattern" || !fill.fgColor) return "normal";

  const argb = fill.fgColor.argb ?? "";
  if (!argb || argb.length < 6) return "normal";

  // Extract RGB from ARGB (last 6 chars)
  const hex = argb.slice(-6).toUpperCase();
  const r = parseInt(hex.slice(0, 2), 16);
  const g = parseInt(hex.slice(2, 4), 16);
  const b = parseInt(hex.slice(4, 6), 16);

  // Red: high red, low green, low blue
  if (r > 150 && g < 100 && b < 100) return "sunday";

  // Yellow: high red, high green, low blue
  if (r > 150 && g > 150 && b < 100) return "poya";

  // Blue: low red, low green, high blue
  if (r < 100 && g < 100 && b > 150) return "public_holiday";

  return "normal";
}

const MONTH_MAP: Record<string, string> = {
  jan: "01", feb: "02", mar: "03", apr: "04", may: "05", jun: "06",
  jul: "07", aug: "08", sep: "09", oct: "10", nov: "11", dec: "12"
};

function parseDateCellToString(value: ExcelJS.CellValue): string | null {
  if (!value) return null;
  if (value instanceof Date) {
    const y = value.getUTCFullYear();
    const m = String(value.getUTCMonth() + 1).padStart(2, "0");
    const d = String(value.getUTCDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }
  const str = String(value).trim();
  const parts = str.split("/");
  if (parts.length === 3) {
    const day = parts[0]!.padStart(2, "0");
    const monthPart = parts[1]!.toLowerCase();
    const month = MONTH_MAP[monthPart] ?? monthPart.padStart(2, "0");
    const year = parts[2]!;
    return `${year}-${month}-${day}`;
  }
  return null;
}

function toMinutes(value: ExcelJS.CellValue): number | null {
  if (value === null || value === undefined) return null;
  if (value instanceof Date) {
    return value.getUTCHours() * 60 + value.getUTCMinutes();
  }
  if (typeof value === "number") {
    return Math.round(value * 24 * 60);
  }
  if (typeof value === "string") {
    const parts = value.trim().split(":");
    if (parts.length >= 2) {
      const h = parseInt(parts[0] ?? "0", 10);
      const m = parseInt(parts[1] ?? "0", 10);
      if (!isNaN(h) && !isNaN(m)) return h * 60 + m;
    }
  }
  return null;
}

const TIME_COL_START = 6; // Column F

export async function parseAttendanceBuffer(
  buffer: Buffer
): Promise<Map<string, ParsedAttendance>> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer as any);

  const worksheet = workbook.worksheets[0];
  if (!worksheet) throw new Error("No worksheet found in Excel file.");

  const result = new Map<string, ParsedAttendance>();

  worksheet.eachRow((row, rowNum) => {
    if (rowNum === 1) return; // Header

    const dept = String(row.getCell(1).value ?? "").trim();
    const userId = String(row.getCell(2).value ?? "").trim();
    const name = String(row.getCell(3).value ?? "").trim();
    const dateRaw = row.getCell(5).value;

    if (!userId || !dateRaw) return;

    const dateStr = parseDateCellToString(dateRaw);
    if (!dateStr) return;

    const dayType = classifyColor(row.getCell(5).fill);

    const punches: number[] = [];
    for (let colIdx = TIME_COL_START; colIdx <= row.cellCount; colIdx++) {
      const cell = row.getCell(colIdx);
      if (cell.value === null || cell.value === undefined) continue;
      const mins = toMinutes(cell.value);
      if (mins !== null && mins >= 0) {
        punches.push(mins);
      }
    }

    const inTime = punches.length >= 1 ? (punches[0] ?? null) : null;
    const outTime = punches.length >= 2 ? (punches[punches.length - 1] ?? null) : null;

    const record: AttendanceRecord = {
      dateStr,
      dayType,
      inTime,
      outTime,
      punches,
    };

    const key = `${userId}|${name}|${dept}`;

    if (!result.has(key)) {
      result.set(key, {
        employee: { userId, name, dept },
        records: [],
      });
    }

    result.get(key)!.records.push(record);
  });

  for (const entry of result.values()) {
    entry.records.sort((a, b) => a.dateStr.localeCompare(b.dateStr));
  }

  return result;
}
