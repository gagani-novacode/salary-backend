import { IAttendanceRecord } from "../models/Attendance";
import { IEmployee } from "../models/Employee";
import { ILoan } from "../models/Loan";

export interface SalaryInput {
  employee: IEmployee;
  attendanceRecords: IAttendanceRecord[];
  activeLoans: ILoan[];
  workingDaysInMonth?: number;
  incentive?: number;
  commissionSales?: number;
  advanceDeduction?: number;
  entitledHolidays?: number;
  totalUsedLeavesPrevious?: number; // used leaves before this month
  companyHolidaysSet?: Set<string>;
}

export interface SalaryCalculationResult {
  workingDaysInMonth: number;
  entitledHolidays: number;
  totalUsedLeaves: number;
  usedLeavesThisMonth: number;
  noPayDays: number;
  weekdays: number;
  poyaDays: number;
  sundays: number;
  publicHolidays: number;

  normalOTHours: number;
  normalOTAmount: number;
  doubleOTHours: number;
  doubleOTAmount: number;

  basicSalary: number;
  holidayWages: number;
  salaryForEPF: number;
  attendanceAllowance: number;
  incentive: number;
  commissionSales: number;
  grossSalary: number;

  noPayAmount: number;
  epfEmployee8: number;
  loanDeductions: number;
  advanceDeduction: number;
  totalDeductions: number;

  epfEmployer12: number;
  etf3: number;

  netPay: number;
}

export function calculateEmployeeSalary(input: SalaryInput): SalaryCalculationResult {
  const {
    employee,
    attendanceRecords,
    activeLoans,
    workingDaysInMonth = 26,
    incentive = 0,
    commissionSales = 0,
    advanceDeduction = 0,
    entitledHolidays = 21,
    totalUsedLeavesPrevious = 0,
    companyHolidaysSet = new Set(),
  } = input;

  const basicSalary = employee.basicSalary || 0;
  const dailyRate = basicSalary / 30; // always divide by 30 per formula
  const hourlyRate = basicSalary / 240;

  // Build sunday dates set for pre-sunday (saturday) detection
  const sundayDates = new Set(
    attendanceRecords
      .filter((r) => r.dayType === "sunday")
      .map((r) => r.dateStr)
  );

  // Day counters
  let weekdays = 0;
  let poyaDays = 0;
  let sundays = 0;
  let publicHolidays = 0;

  // Worked on holiday counters (for holiday wages)
  let poyaDaysWorked = 0;
  let sundayAndHolidayDaysWorked = 0;

  // Absent days (no punch on a normal/weekday) = used leaves this month
  let usedLeavesThisMonth = 0;

  let normalOTMinutes = 0;
  let doubleOTMinutes = 0;
  let week1WorkMinutes = 0;

  for (const r of attendanceRecords) {
    const isPoya = r.dayType === "poya";
    const isSunday = r.dayType === "sunday";
    const isPublicHoliday =
      r.dayType === "public_holiday" || companyHolidaysSet.has(r.dateStr);
    const isWeekday = !isSunday && !isPoya && !isPublicHoliday;

    // Don't count future dates
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (new Date(r.dateStr) > today) continue;

    // Count day types
    if (isSunday) sundays++;
    else if (isPoya) poyaDays++;
    else if (isPublicHoliday) publicHolidays++;
    else weekdays++;


    // Work minutes for the day
    let workMins = 0;
    if (r.inTime !== null && r.outTime !== null) {
      workMins = Math.max(0, r.outTime - r.inTime);
    }

    if (isWeekday) {
      const nextDate = new Date(r.dateStr);
      nextDate.setDate(nextDate.getDate() + 1);
      const nextDateStr = nextDate.toISOString().slice(0, 10);
      const isPreSunday = sundayDates.has(nextDateStr);
      const fullDayMins = isPreSunday ? 360 : 540; // Saturday = 6h, Weekday = 9h

      if (workMins === 0) {
        usedLeavesThisMonth += 1; // full day absent
      } else if (workMins < fullDayMins / 2) {
        usedLeavesThisMonth += 0.5; // worked less than half → half day leave
      }
    }

    if (workMins === 0) continue;

    // Worked — check holiday wages eligibility
    if (isPoya) {
      poyaDaysWorked++;
    } else if (isSunday || isPublicHoliday) {
      sundayAndHolidayDaysWorked++;
    }

    // Week 1 tracking (days 1–7)
    const dayOfMonth = parseInt(r.dateStr.split("-")[2] ?? "0", 10);
    if (dayOfMonth >= 1 && dayOfMonth <= 7) {
      week1WorkMinutes += workMins;
    }

    // OT calculation
    const nextDate = new Date(r.dateStr);
    nextDate.setDate(nextDate.getDate() + 1);
    const nextDateStr = nextDate.toISOString().slice(0, 10);
    const isPreSunday = sundayDates.has(nextDateStr); // this day is Saturday

    if (isSunday || isPublicHoliday) {
      // Full work time is double OT
      doubleOTMinutes += workMins;
    } else if (isPoya) {
      // Poya treated same as holiday — full double OT
      doubleOTMinutes += workMins;
    } else if (isPreSunday) {
      // Saturday: OT after 6h
      if (workMins > 360) {
        normalOTMinutes += workMins - 360;
      }
    } else {
      // Normal weekday: OT after 9h
      if (workMins > 540) {
        normalOTMinutes += workMins - 540;
      }
    }
  }

  // --- Detect missing working days (absent with no row in Excel) ---
  if (attendanceRecords.length > 0) {
    const recordedDates = new Set(attendanceRecords.map((r) => r.dateStr));

    // Determine month and year from first record
    const firstDate = new Date(attendanceRecords[0]!.dateStr);
    const yr = firstDate.getFullYear();
    const mo = firstDate.getMonth(); // 0-indexed

    const daysInMonth = new Date(yr, mo + 1, 0).getDate();

    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${yr}-${String(mo + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;

      // Skip days already in attendance records
      if (recordedDates.has(dateStr)) continue;

      // Check if it's a Sunday (skip — not a working day)
      const dayOfWeek = new Date(dateStr).getDay(); // 0 = Sunday
      if (dayOfWeek === 0) continue;

      // Skip poya/public holidays registered in companyHolidaysSet
      if (companyHolidaysSet.has(dateStr)) continue;

      // This is a missing weekday or Saturday — count as full leave
      // Check if it's a Saturday (pre-sunday logic not needed here, just flag it)
      usedLeavesThisMonth += 1;
    }
  }

  // Week 1 cap: if total week 1 work > 45h (2700 mins), extra counts as OT
  if (week1WorkMinutes > 2700) {
    const extraWeek1Mins = week1WorkMinutes - 2700;
    if (extraWeek1Mins > normalOTMinutes) {
      normalOTMinutes = extraWeek1Mins;
    }
  }

  // --- Leaves & No Pay ---
  const totalUsedLeaves = totalUsedLeavesPrevious + usedLeavesThisMonth;
  const noPayDays = Math.max(0, totalUsedLeaves - entitledHolidays);

  // --- No Pay Amount (Basic / 30 × No Pay Days) ---
  const noPayAmount = Math.round(dailyRate * noPayDays);

  // --- Holiday Wages ---
  // Poya days worked: (Basic/30) × 0.5
  // Sunday & Public Holiday worked: (Basic/30) × 1.0
  const holidayWages = Math.round(
    poyaDaysWorked * dailyRate * 0.5 +
    sundayAndHolidayDaysWorked * dailyRate * 1.0
  );

  // --- EPF Salary ---
  const salaryForEPF = Math.max(0, basicSalary + holidayWages - noPayAmount);

  // --- OT ---
  const normalOTHours = Math.floor(normalOTMinutes / 60) + (normalOTMinutes % 60) / 100;
  const doubleOTHours = Math.floor(doubleOTMinutes / 60) + (doubleOTMinutes % 60) / 100;
  const normalOTAmount = Math.round(normalOTHours * hourlyRate * 1.5);
  const doubleOTAmount = Math.round(doubleOTHours * hourlyRate * 2.0);

  // --- Attendance Allowance (based on leaves taken this month) ---
  let attendanceAllowance = 0;
  if (usedLeavesThisMonth === 0) attendanceAllowance = 8000;
  else if (usedLeavesThisMonth <= 1) attendanceAllowance = 7000;
  else if (usedLeavesThisMonth <= 2) attendanceAllowance = 6000;
  else attendanceAllowance = 0;

  // --- Gross Salary ---
  // (Basic + Holiday Wages + Normal OT + Double OT + Attendance Allowance + Incentive + Commission) - No Pay
  const grossSalary = Math.round(
    basicSalary +
    holidayWages +
    normalOTAmount +
    doubleOTAmount +
    attendanceAllowance +
    incentive +
    commissionSales -
    noPayAmount
  );

  // --- EPF / ETF ---
  const epfEmployee8 = employee.epfEligible ? Math.round(salaryForEPF * 0.08) : 0;
  const epfEmployer12 = employee.epfEligible ? Math.round(salaryForEPF * 0.12) : 0;
  const etf3 = employee.etfEligible ? Math.round(salaryForEPF * 0.03) : 0;

  // --- Loans ---
  let totalLoanInstalments = 0;
  for (const loan of activeLoans) {
    if (loan.balance > 0) {
      totalLoanInstalments += Math.min(loan.monthlyInstalment, loan.balance);
    }
  }

  // --- Net Pay ---
  // Gross - (EPF 8% + Loan + Advance + No Pay)
  const totalDeductions = Math.round(
    epfEmployee8 + totalLoanInstalments + advanceDeduction + noPayAmount
  );
  const netPay = Math.max(
    0,
    grossSalary - epfEmployee8 - totalLoanInstalments - advanceDeduction
    // noPayAmount already subtracted in grossSalary
  );

  return {
    workingDaysInMonth,
    entitledHolidays,
    totalUsedLeaves,
    usedLeavesThisMonth,
    noPayDays,
    weekdays,
    poyaDays,
    sundays,
    publicHolidays,

    normalOTHours,
    normalOTAmount,
    doubleOTHours,
    doubleOTAmount,

    basicSalary,
    holidayWages,
    salaryForEPF,
    attendanceAllowance,
    incentive,
    commissionSales,
    grossSalary,

    noPayAmount,
    epfEmployee8,
    loanDeductions: totalLoanInstalments,
    advanceDeduction,
    totalDeductions,

    epfEmployer12,
    etf3,

    netPay,
  };
}