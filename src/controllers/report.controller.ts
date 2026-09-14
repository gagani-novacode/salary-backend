import { Response } from "express";
import PDFDocument from "pdfkit";
import ExcelJS from "exceljs";
import { PayrollRun } from "../models/PayrollRun";
import { Company } from "../models/Company";
import { AuthRequest } from "../middleware/auth.middleware";

export const generatePayslipPDF = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const payroll = await PayrollRun.findById(id).populate("companyId");
    if (!payroll) {
      res.status(404).json({ success: false, message: "Payroll run not found" });
      return;
    }

    const company: any = payroll.companyId;

    const doc = new PDFDocument({ margin: 40, size: "A4" });

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="payslip_${payroll.employeeNo}_${payroll.month}_${payroll.year}.pdf"`
    );

    doc.pipe(res);

    // Header
    doc
      .fillColor("#1E293B")
      .fontSize(20)
      .font("Helvetica-Bold")
      .text(company ? company.name.toUpperCase() : "SALARY MANAGEMENT SYSTEM", { align: "center" });

    doc
      .fontSize(10)
      .font("Helvetica")
      .text(`Branch / Location: ${company ? company.branchLocation : "Head Office"}`, { align: "center" });

    if (company && company.epfRegNo) {
      doc.text(`EPF Reg No: ${company.epfRegNo} | ETF Reg No: ${company.etfRegNo || "N/A"}`, { align: "center" });
    }

    doc.moveDown(1);
    doc
      .strokeColor("#6366F1")
      .lineWidth(2)
      .moveTo(40, doc.y)
      .lineTo(555, doc.y)
      .stroke();
    doc.moveDown(1);

    // Title
    const monthNames = ["", "January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
    doc
      .fillColor("#475569")
      .fontSize(14)
      .font("Helvetica-Bold")
      .text(`PAYSLIP — ${monthNames[payroll.month]} ${payroll.year}`, { align: "center" });

    doc.moveDown(1);

    // Employee Details Box
    const startY = doc.y;
    doc
      .rect(40, startY, 515, 65)
      .fillAndStroke("#F8FAFC", "#CBD5E1");

    doc
      .fillColor("#0F172A")
      .fontSize(10)
      .font("Helvetica-Bold")
      .text(`Emp No: ${payroll.employeeNo}`, 50, startY + 10)
      .text(`Name: ${payroll.employeeName}`, 50, startY + 28)
      .text(`Designation: ${payroll.designation}`, 50, startY + 46);

    doc
      .text(`Department: ${payroll.department}`, 300, startY + 10)
      .text(`Entitled Holidays: ${payroll.entitledHolidays}`, 300, startY + 28)
      .text(`Working Days: ${payroll.workingDaysInMonth}`, 300, startY + 46);

    doc.moveDown(5);

    // Summary Table Headers
    const tableY = startY + 80;
    doc
      .rect(40, tableY, 250, 20)
      .fill("#E0E7FF");
    doc
      .fillColor("#3730A3")
      .fontSize(10)
      .font("Helvetica-Bold")
      .text("EARNINGS", 45, tableY + 5);

    doc
      .rect(305, tableY, 250, 20)
      .fill("#FEE2E2");
    doc
      .fillColor("#991B1B")
      .fontSize(10)
      .font("Helvetica-Bold")
      .text("DEDUCTIONS", 310, tableY + 5);

    // Rows
    const earnings = [
      { label: "Basic Salary", val: payroll.basicSalary },
      { label: "Holiday Wages", val: payroll.holidayWages },
      { label: `Normal OT (${payroll.normalOTHours} hrs)`, val: payroll.normalOTAmount },
      { label: `Double OT (${payroll.doubleOTHours} hrs)`, val: payroll.doubleOTAmount },
      { label: "Attendance Allowance", val: payroll.attendanceAllowance },
      { label: "Incentive", val: payroll.incentive },
      { label: "Commission / Sales", val: payroll.commissionSales },
    ];

    const deductions = [
      { label: `No Pay (${payroll.noPayDays} days)`, val: payroll.noPayAmount },
      { label: "EPF Employee (8%)", val: payroll.epfEmployee8 },
      { label: "Loan Repayments", val: payroll.loanDeductions },
      { label: "Salary Advance", val: payroll.advanceDeduction },
    ];

    let rowY = tableY + 25;
    const maxRows = Math.max(earnings.length, deductions.length);

    doc.font("Helvetica").fontSize(9).fillColor("#1E293B");

    for (let i = 0; i < maxRows; i++) {
      if (earnings[i]) {
        doc.text(earnings[i]!.label, 45, rowY);
        doc.text(`LKR ${earnings[i]!.val.toLocaleString()}`, 200, rowY, { align: "right", width: 85 });
      }
      if (deductions[i]) {
        doc.text(deductions[i]!.label, 310, rowY);
        doc.text(`LKR ${deductions[i]!.val.toLocaleString()}`, 465, rowY, { align: "right", width: 85 });
      }
      rowY += 18;
    }

    doc.moveDown(1);
    doc
      .strokeColor("#E2E8F0")
      .lineWidth(1)
      .moveTo(40, rowY)
      .lineTo(555, rowY)
      .stroke();

    rowY += 10;

    // Totals Box
    doc
      .fontSize(10)
      .font("Helvetica-Bold")
      .text("GROSS SALARY:", 45, rowY)
      .text(`LKR ${payroll.grossSalary.toLocaleString()}`, 200, rowY, { align: "right", width: 85 })
      .text("TOTAL DEDUCTIONS:", 310, rowY)
      .text(`LKR ${payroll.totalDeductions.toLocaleString()}`, 465, rowY, { align: "right", width: 85 });

    rowY += 30;

    // Net Pay Banner
    doc
      .rect(40, rowY, 515, 35)
      .fill("#10B981");

    doc
      .fillColor("#FFFFFF")
      .fontSize(12)
      .font("Helvetica-Bold")
      .text("NET PAYABLE:", 55, rowY + 10)
      .text(`LKR ${payroll.netPay.toLocaleString()}`, 350, rowY + 10, { align: "right", width: 190 });

    rowY += 50;

    // Employer Contributions Note
    doc
      .fillColor("#64748B")
      .fontSize(9)
      .font("Helvetica")
      .text(`Employer Contributions (For Record): EPF 12%: LKR ${payroll.epfEmployer12.toLocaleString()} | ETF 3%: LKR ${payroll.etf3.toLocaleString()}`, 40, rowY);

    rowY += 40;

    // Signatures
    doc
      .text("_________________________", 60, rowY)
      .text("Employee Signature", 60, rowY + 15)
      .text("_________________________", 380, rowY)
      .text("Authorized Signature", 380, rowY + 15);

    doc.end();
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const generateSummaryExcel = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { companyId, month, year } = req.query;
    if (!companyId || !month || !year) {
      res.status(400).json({ success: false, message: "Company ID, month, and year are required" });
      return;
    }

    const monthNames = ["", "JANUARY", "FEBRUARY", "MARCH", "APRIL", "MAY", "JUNE",
      "JULY", "AUGUST", "SEPTEMBER", "OCTOBER", "NOVEMBER", "DECEMBER"];
    const monthName = monthNames[Number(month)];

    const company = await Company.findById(companyId) as any;
    const payrolls = await PayrollRun.find({
      companyId,
      month: Number(month),
      year: Number(year),
    }).sort({ employeeNo: 1 });

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("Salary Sheet");

    // ── Column widths (A–AE) ──────────────────────────────────────────
    const colWidths = [
      3,   // A - empty
      6,   // B - EPF No
      24,  // C - Name
      7,   // D - Gender
      16,  // E - Designation
      9,   // F - Entitled Holidays
      8,   // G - Total Used Leaves
      8,   // H - Used Leaves This Month
      8,   // I - No Pay Days
      8,   // J - Weekdays
      8,   // K - Poya Days
      10,  // L - Sunday & Public Holidays
      12,  // M - Basic Salary
      12,  // N - Holiday Wages
      10,  // O - Normal OT Hours
      10,  // P - Double OT Hours
      12,  // Q - EPF Salary
      12,  // R - Normal OT Amount
      12,  // S - Gross Salary
      12,  // T - Double OT Amount
      10,  // U - EPF 8%
      10,  // V - Loan
      10,  // W - Advance
      12,  // X - No Pay Amount
      12,  // Y - Attendance Allowance
      12,  // Z - Incentive
      12,  // AA - Commission Sales
      12,  // AB - EPF 12%
      10,  // AC - ETF 3%
      12,  // AD - Net Pay
      12,  // AE - Signature
    ];
    colWidths.forEach((w, i) => { sheet.getColumn(i + 1).width = w; });

    // ── Helper styles ─────────────────────────────────────────────────
    const headerFill = (argb: string): ExcelJS.Fill => ({
      type: "pattern", pattern: "solid", fgColor: { argb }
    });
    const border = (): Partial<ExcelJS.Borders> => ({
      top: { style: "thin" }, left: { style: "thin" },
      bottom: { style: "thin" }, right: { style: "thin" },
    });
    const centerMiddle: Partial<ExcelJS.Alignment> = { horizontal: "center", vertical: "middle", wrapText: true };
    const currency = '#,##0.00';

    // ── Row 9: WBA note ───────────────────────────────────────────────
    sheet.getRow(9).height = 15;
    const wbaCell = sheet.getCell("B9");
    wbaCell.value = `WAGES RECORD AS PRESCRIBED IN SEC.41(1)in WBA FOR RETAIL AND WHOLESASE TRADE`;
    wbaCell.font = { bold: true, size: 10 };

    // ── Row 10: Month label ───────────────────────────────────────────
    sheet.getRow(10).height = 15;
    sheet.getCell("B10").value = `MONTH OF ${monthName} ${year}`;
    sheet.getCell("B10").font = { bold: true, size: 10 };

    // ── Row 11: Company name (centered across B–AE) ───────────────────
    sheet.getRow(11).height = 20;
    sheet.mergeCells("B11:AE11");
    const companyCell = sheet.getCell("B11");
    companyCell.value = company ? company.name.toUpperCase() : "COMPANY";
    companyCell.font = { bold: true, size: 13 };
    companyCell.alignment = centerMiddle;

    // ── Row 12: Salary sheet title ────────────────────────────────────
    sheet.getRow(12).height = 18;
    sheet.mergeCells("B12:AE12");
    const titleCell = sheet.getCell("B12");
    titleCell.value = `SALARY SHEET OF MONTH OF ${monthName}  ${year}`;
    titleCell.font = { bold: true, size: 12 };
    titleCell.alignment = centerMiddle;

    // ── Row 13: spacer ────────────────────────────────────────────────
    sheet.getRow(13).height = 8;

    // ── Row 14: Main column headers ───────────────────────────────────
    sheet.getRow(14).height = 40;

    const h14Style = (argb = "D9D9D9") => ({
      font: { bold: true, size: 9 },
      fill: headerFill(argb),
      alignment: centerMiddle,
      border: border(),
    });

    // Merge cells for grouped headers
    const mergeH14 = (range: string, value: string, argb = "D9D9D9") => {
      sheet.mergeCells(range);
      const c = sheet.getCell(range.split(":")[0]!);
      c.value = value;
      Object.assign(c, h14Style(argb));
    };

    sheet.getCell("B14").value = "E P F\nNO.";
    Object.assign(sheet.getCell("B14"), h14Style());
    sheet.getCell("C14").value = "NAME";
    Object.assign(sheet.getCell("C14"), h14Style());
    sheet.getCell("D14").value = "GENDER";
    Object.assign(sheet.getCell("D14"), h14Style());
    sheet.getCell("E14").value = "DESIGNATION";
    Object.assign(sheet.getCell("E14"), h14Style());
    mergeH14("F14:I14", "HOLIDAY", "FFF2CC");
    mergeH14("J14:L14", "NUMBER OF WORKED DAYS", "DDEBF7");
    sheet.getCell("M14").value = "BASIC\nSALARY RS.";
    Object.assign(sheet.getCell("M14"), h14Style("E2EFDA"));
    sheet.getCell("N14").value = "HOLIDAY\nWAGES RS.";
    Object.assign(sheet.getCell("N14"), h14Style("E2EFDA"));
    sheet.getCell("O14").value = "NORMAL\nOT";
    Object.assign(sheet.getCell("O14"), h14Style("FCE4D6"));
    sheet.getCell("P14").value = "DOUBLE\nOVER TIME";
    Object.assign(sheet.getCell("P14"), h14Style("FCE4D6"));
    sheet.getCell("Q14").value = "SALARY FOR\nEPF RS.";
    Object.assign(sheet.getCell("Q14"), h14Style("E2EFDA"));
    sheet.getCell("R14").value = "AMOUNT OF\nNORMAL OT RS.";
    Object.assign(sheet.getCell("R14"), h14Style("FCE4D6"));
    sheet.getCell("S14").value = "GROSS\nSALARY RS.";
    Object.assign(sheet.getCell("S14"), h14Style("C6EFCE"));
    sheet.getCell("T14").value = "AMOUNT OF\nDOUBLE OT RS.";
    Object.assign(sheet.getCell("T14"), h14Style("FCE4D6"));
    mergeH14("U14:X14", "DEDUCTION", "FFCCCC");
    sheet.getCell("Y14").value = "ATTENDANCE\nALLOWANCE RS";
    Object.assign(sheet.getCell("Y14"), h14Style("E2EFDA"));
    sheet.getCell("Z14").value = "INCENTIVE\nRS.";
    Object.assign(sheet.getCell("Z14"), h14Style("E2EFDA"));
    sheet.getCell("AA14").value = "COMMISSION\nSALES RS.";
    Object.assign(sheet.getCell("AA14"), h14Style("E2EFDA"));
    sheet.getCell("AB14").value = "EPF 12%\nRS.";
    Object.assign(sheet.getCell("AB14"), h14Style("DDEBF7"));
    sheet.getCell("AC14").value = "ETF 3%\nRS.";
    Object.assign(sheet.getCell("AC14"), h14Style("DDEBF7"));
    sheet.getCell("AD14").value = "NET PAY\nRS.";
    Object.assign(sheet.getCell("AD14"), h14Style("C6EFCE"));
    sheet.getCell("AE14").value = "SIGNATURE";
    Object.assign(sheet.getCell("AE14"), h14Style());

    // ── Row 15: Sub-headers for HOLIDAY and DEDUCTION groups ──────────
    sheet.getRow(15).height = 40;

    const h15Style = (argb = "D9D9D9") => ({
      font: { bold: true, size: 8 },
      fill: headerFill(argb),
      alignment: centerMiddle,
      border: border(),
    });

    const subHeaders: [string, string, string][] = [
      ["F15", "Entitled\nHolidays", "FFF2CC"],
      ["G15", "Total\nUsed\nLeaves", "FFF2CC"],
      ["H15", "Used\nLeaves\nThis Month", "FFF2CC"],
      ["I15", "NO PAY\nDAYS", "FFCCCC"],
      ["J15", "Week\nDays", "DDEBF7"],
      ["K15", "Poya\nDays", "DDEBF7"],
      ["L15", "Sunday &\nPublic\nHolidays", "DDEBF7"],
      ["U15", "EPF 8%\nRS.", "FFCCCC"],
      ["V15", "Loan\nRS.", "FFCCCC"],
      ["W15", "ADVANCE\nRS.", "FFCCCC"],
      ["X15", "NO PAY\nAMOUNT RS", "FFCCCC"],
    ];

    // Blank out merged cells that extend into row 15
    ["B15", "C15", "D15", "E15", "M15", "N15", "O15", "P15", "Q15", "R15", "S15", "T15",
      "Y15", "Z15", "AA15", "AB15", "AC15", "AD15", "AE15"].forEach(addr => {
        const c = sheet.getCell(addr);
        c.fill = headerFill("D9D9D9");
        c.border = border();
      });

    subHeaders.forEach(([addr, val, argb]) => {
      const c = sheet.getCell(addr);
      c.value = val;
      Object.assign(c, h15Style(argb));
    });

    // ── Data rows (starting row 16) ────────────────────────────────────
    const dataStart = 16;
    payrolls.forEach((p, idx) => {
      const rowNum = dataStart + idx;
      const row = sheet.getRow(rowNum);
      row.height = 18;

      const values: Record<string, any> = {
        B: p.employeeNo,
        C: p.employeeName,
        D: "",               // gender not stored — leave blank
        E: p.designation,
        F: p.entitledHolidays,
        G: p.usedLeavesTotal,
        H: p.usedLeavesThisMonth,
        I: p.noPayDays,
        J: p.weekdays,
        K: p.poyaDays,
        L: p.sundays + p.publicHolidays,
        M: p.basicSalary,
        N: p.holidayWages,
        O: p.normalOTHours,
        P: p.doubleOTHours,
        Q: p.salaryForEPF,
        R: p.normalOTAmount,
        S: p.grossSalary,
        T: p.doubleOTAmount,
        U: p.epfEmployee8,
        V: p.loanDeductions,
        W: p.advanceDeduction,
        X: p.noPayAmount,
        Y: p.attendanceAllowance,
        Z: p.incentive,
        AA: p.commissionSales,
        AB: p.epfEmployer12,
        AC: p.etf3,
        AD: p.netPay,
        AE: "",
      };

      const numericCols = new Set(["F", "G", "H", "I", "J", "K", "L", "M", "N", "O", "P", "Q", "R", "S", "T", "U", "V", "W", "X", "Y", "Z", "AA", "AB", "AC", "AD"]);
      const currencyCols = new Set(["M", "N", "Q", "R", "S", "T", "U", "V", "W", "X", "Y", "Z", "AA", "AB", "AC", "AD"]);

      Object.entries(values).forEach(([col, val]) => {
        const cell = sheet.getCell(`${col}${rowNum}`);
        cell.value = val;
        cell.border = border();
        cell.font = { size: 9 };
        if (numericCols.has(col)) {
          cell.alignment = { horizontal: "right", vertical: "middle" };
          if (currencyCols.has(col)) cell.numFmt = currency;
        } else {
          cell.alignment = { horizontal: "left", vertical: "middle" };
        }
      });

      // Alternate row shading
      if (idx % 2 === 1) {
        Object.keys(values).forEach(col => {
          sheet.getCell(`${col}${rowNum}`).fill = headerFill("F5F5F5");
        });
      }
    });

    // ── Totals row ─────────────────────────────────────────────────────
    const totalRow = dataStart + payrolls.length;
    sheet.getRow(totalRow).height = 20;
    const totalStyle = {
      font: { bold: true, size: 9 },
      fill: headerFill("4472C4"),
      alignment: { horizontal: "right", vertical: "middle" } as Partial<ExcelJS.Alignment>,
      border: border(),
    };

    const totalsLabel = sheet.getCell(`B${totalRow}`);
    totalsLabel.value = "TOTALS";
    totalsLabel.font = { bold: true, size: 10, color: { argb: "FFFFFF" } };
    totalsLabel.fill = headerFill("4472C4");
    totalsLabel.alignment = { horizontal: "center", vertical: "middle" };
    totalsLabel.border = border();

    const sumCols: [string, keyof typeof payrolls[0]][] = [
      ["M", "basicSalary"], ["N", "holidayWages"], ["Q", "salaryForEPF"],
      ["R", "normalOTAmount"], ["S", "grossSalary"], ["T", "doubleOTAmount"],
      ["U", "epfEmployee8"], ["V", "loanDeductions"], ["W", "advanceDeduction"],
      ["X", "noPayAmount"], ["Y", "attendanceAllowance"], ["Z", "incentive"],
      ["AA", "commissionSales"], ["AB", "epfEmployer12"], ["AC", "etf3"], ["AD", "netPay"],
    ];

    sumCols.forEach(([col, field]) => {
      const total = payrolls.reduce((sum, p) => sum + (Number((p as any)[field]) || 0), 0);
      const cell = sheet.getCell(`${col}${totalRow}`);
      cell.value = total;
      Object.assign(cell, totalStyle);
      cell.font = { bold: true, size: 9, color: { argb: "FFFFFF" } };
      cell.numFmt = currency;
    });

    // Fill blank total cells with blue
    ["C", "D", "E", "F", "G", "H", "I", "J", "K", "L", "O", "P", "AE"].forEach(col => {
      const cell = sheet.getCell(`${col}${totalRow}`);
      cell.fill = headerFill("4472C4");
      cell.border = border();
    });

    // ── Output ─────────────────────────────────────────────────────────
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="Salary_Sheet_${monthName}_${year}.xlsx"`
    );

    await workbook.xlsx.write(res);
    res.end();
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};
