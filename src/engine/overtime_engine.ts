import { ParsedAttendance, DayType } from "./excel_parser";

export interface DailyOTRecord {
  dateStr: string;
  dayType: DayType;
  inTime: number | null;
  outTime: number | null;
  workMinutes: number;
  otMinutes: number;
  ruleApplied: "SUNDAY_FULL_OT" | "PRE_SUNDAY_6H" | "STANDARD_9H" | "WEEK_1_CAP" | "NONE";
}

export interface EmployeeOTSummary {
  employee: ParsedAttendance["employee"];
  dailyRecords: DailyOTRecord[];
  totalWorkMinutes: number;
  totalOTMinutes: number;
  week1CumulativeWorkMinutes: number;
  week1BonusOTMinutes: number;
}

export function calculateOvertime(
  parsedMap: Map<string, ParsedAttendance>
): EmployeeOTSummary[] {
  if (!parsedMap || !(parsedMap instanceof Map)) {
    throw new Error("Invalid attendance data passed to Overtime Engine.");
  }

  const summaries: EmployeeOTSummary[] = [];

  for (const [key, entry] of parsedMap.entries()) {
    const { employee, records } = entry;
    if (!records || !Array.isArray(records)) continue;

    const sundayDates = new Set(
      records.filter((r) => r.dayType === "sunday").map((r) => r.dateStr)
    );

    const dailyRecords: DailyOTRecord[] = [];
    let totalWorkMinutes = 0;
    let totalDailyOTMinutes = 0;
    let week1WorkMinutes = 0;

    for (const r of records) {
      let workMins = 0;
      if (r.inTime !== null && r.outTime !== null) {
        workMins = Math.max(0, r.outTime - r.inTime);
      }

      totalWorkMinutes += workMins;

      const dayOfMonth = parseInt(r.dateStr.split("-")[2] ?? "0", 10);
      if (dayOfMonth >= 1 && dayOfMonth <= 7) {
        week1WorkMinutes += workMins;
      }

      const currentDate = new Date(r.dateStr);
      const nextDate = new Date(currentDate);
      nextDate.setDate(currentDate.getDate() + 1);
      const nextDateStr = nextDate.toISOString().slice(0, 10);
      const isPreSunday = sundayDates.has(nextDateStr);

      let otMins = 0;
      let rule: DailyOTRecord["ruleApplied"] = "NONE";

      if (workMins > 0) {
        if (r.dayType === "sunday") {
          otMins = workMins;
          rule = "SUNDAY_FULL_OT";
        } else if (isPreSunday) {
          if (workMins > 360) {
            otMins = workMins - 360;
            rule = "PRE_SUNDAY_6H";
          }
        } else {
          if (workMins > 540) {
            otMins = workMins - 540;
            rule = "STANDARD_9H";
          }
        }
      }

      totalDailyOTMinutes += otMins;

      dailyRecords.push({
        dateStr: r.dateStr,
        dayType: r.dayType,
        inTime: r.inTime,
        outTime: r.outTime,
        workMinutes: workMins,
        otMinutes: otMins,
        ruleApplied: rule,
      });
    }

    let week1BonusOT = 0;
    if (week1WorkMinutes > 2700) {
      const totalWeek1OTRequired = week1WorkMinutes - 2700;
      const week1DailyOTCaptured = dailyRecords
        .filter((r) => {
          const d = parseInt(r.dateStr.split("-")[2] ?? "0", 10);
          return d >= 1 && d <= 7;
        })
        .reduce((sum, r) => sum + r.otMinutes, 0);

      if (totalWeek1OTRequired > week1DailyOTCaptured) {
        week1BonusOT = totalWeek1OTRequired - week1DailyOTCaptured;
      }
    }

    summaries.push({
      employee,
      dailyRecords,
      totalWorkMinutes,
      totalOTMinutes: totalDailyOTMinutes + week1BonusOT,
      week1CumulativeWorkMinutes: week1WorkMinutes,
      week1BonusOTMinutes: week1BonusOT,
    });
  }

  return summaries;
}
