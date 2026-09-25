// import { Response } from "express";
import PDFDocument from "pdfkit";
import { PDFDocument as PDFLibDocument, rgb, StandardFonts } from "pdf-lib";  // new
import fs from "fs";
import path from "path";
import { Employee } from "../models/Employee";
import ExcelJS from "exceljs";
import { PayrollRun } from "../models/PayrollRun";
import { Company } from "../models/Company";
import { AuthRequest } from "../middleware/auth.middleware";
import { Request, Response } from 'express';
import puppeteer from 'puppeteer';

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
      const r = rowNum;
      const values: Record<string, any> = {
        B: p.employeeNo,
        C: p.employeeName,
        D: "",
        E: p.designation,
        F: p.entitledHolidays,
        G: p.usedLeavesTotal,
        H: p.usedLeavesThisMonth,
        I: { formula: `=IF(G${r}>F${r},G${r}-F${r},0)` },           // No Pay Days
        J: p.weekdays,
        K: p.poyaDays,
        L: p.sundays + p.publicHolidays,
        M: p.basicSalary,
        N: { formula: `=((M${r}/30)*0.5*K${r})+((M${r}/30)*1*L${r})` }, // Holiday Wages
        O: p.normalOTHours,
        P: p.doubleOTHours,
        Q: { formula: `=(M${r}+N${r})-X${r}` },                      // EPF Salary
        R: { formula: `=(M${r}/240)*1.5*O${r}` },                    // Normal OT Amount
        T: { formula: `=(M${r}/240)*2*P${r}` },                      // Double OT Amount
        S: { formula: `=M${r}+N${r}+R${r}+T${r}+Y${r}+Z${r}+AA${r}-X${r}` }, // Gross Salary
        U: { formula: `=Q${r}*8/100` },                              // EPF 8%
        V: p.loanDeductions,
        W: p.advanceDeduction,
        X: { formula: `=M${r}/30*I${r}` },                           // No Pay Amount
        Y: { formula: `=IF(H${r}=0,8000,IF(H${r}<=1,7000,IF(H${r}<=2,6000,0)))` }, // Attendance Allowance
        Z: p.incentive,
        AA: p.commissionSales,
        AB: { formula: `=Q${r}*12/100` },                            // EPF 12%
        AC: { formula: `=Q${r}*3/100` },                             // ETF 3%
        AD: { formula: `=(M${r}+N${r}+R${r}+T${r}+Y${r}+Z${r}+AA${r})-(U${r}+W${r}+X${r}+V${r})` }, // Net Pay
        AE: "",
      };

      const numericCols = new Set(["F", "G", "H", "I", "J", "K", "L", "M", "N", "O", "P", "Q", "R", "S", "T", "U", "V", "W", "X", "Y", "Z", "AA", "AB", "AC", "AD"]);
      const currencyCols = new Set(["M", "N", "Q", "R", "S", "T", "U", "V", "W", "X", "Y", "Z", "AA", "AB", "AC", "AD"]);

      Object.entries(values).forEach(([col, val]) => {
        const cell = sheet.getCell(`${col}${rowNum}`);

        // Handle formula vs plain value
        if (val !== null && typeof val === "object" && "formula" in val) {
          cell.value = val; // ExcelJS accepts { formula: "=..." } directly
        } else {
          cell.value = val;
        }

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

    sumCols.forEach(([col, _field]) => {
      const cell = sheet.getCell(`${col}${totalRow}`);
      cell.value = { formula: `=SUM(${col}${dataStart}:${col}${totalRow - 1})` };
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

export const generateEPFCForm = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { companyId, month, year } = req.query;

    if (!companyId || !month || !year) {
      res.status(400).json({ success: false, message: "Company ID, month, and year are required" });
      return;
    }

    const monthNum = Number(month);
    const yearNum = Number(year);

    const dbCompany = await Company.findById(companyId) as any;
    if (!dbCompany) {
      res.status(404).json({ success: false, message: "Company not found" });
      return;
    }

    const company = {
      name: "CITY MEDICALS DISTRIBUTORS (PVT)LTD,",
      addressLine1: "NO 62,",
      addressLine2: "YATANWALA,",
      addressLine3: "RUWANWELLA.",
      epfRegNo: dbCompany.epfRegNo || "9933/U",
      telephone: "362263358",
      fax: "711116498",
    };

    const monthNames = ["JANUARY", "FEBRUARY", "MARCH", "APRIL", "MAY", "JUNE", "JULY", "AUGUST", "SEPTEMBER", "OCTOBER", "NOVEMBER", "DECEMBER"];
    const monthName = monthNames[monthNum - 1] || "JANUARY";
    const periodString = `${monthName} /${String(yearNum).slice(-2)}`;

    // Fetch payroll records for company, month, and year
    const payrolls = await PayrollRun.find({
      companyId,
      month: monthNum,
      year: yearNum,
    }).sort({ employeeNo: 1 });

    // Fetch NIC for each employee
    const employeeIds = payrolls.map((p) => p.employeeId);
    const dbEmployees = await Employee.find({ _id: { $in: employeeIds } }).select("_id nic employeeNo");
    const nicMap = new Map(dbEmployees.map((e) => [e._id.toString(), e.nic || ""]));

    const employees = payrolls.map((p) => {
      const nic = nicMap.get(p.employeeId?.toString() || "") || "";
      const employee8 = p.epfEmployee8 || 0;
      const employer12 = p.epfEmployer12 || 0;
      const total = employee8 + employer12;
      return {
        name: p.employeeName,
        nic: nic,
        memberNo: p.employeeNo,
        total: total,
        employer: employer12,
        employee: employee8,
        earnings: p.salaryForEPF || 0,
      };
    });

    // Compute grand totals
    const grandTotals = employees.reduce((acc, emp) => ({
      total: acc.total + emp.total,
      employer: acc.employer + emp.employer,
      employee: acc.employee + emp.employee,
      earnings: acc.earnings + emp.earnings,
    }), { total: 0, employer: 0, employee: 0, earnings: 0 });

    const splitCurrency = (amount: number) => {
      if (!amount) return { r: "0", c: "00" };
      const [r, c] = amount.toFixed(2).split('.');
      return { r: Number(r).toLocaleString('en-US'), c };
    };

    const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8" />
      <link href="https://fonts.googleapis.com/css2?family=Noto+Sans+Sinhala:wght@400;700&display=swap" rel="stylesheet">
      <style>
  @page { size: A4 portrait; margin: 6mm 8mm; }
  body { font-family: 'Noto Sans Sinhala', 'Arial', sans-serif; font-size: 14px; color: #000; margin: 0; }
  
  .top-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; }
  .black-badge { background: #000; color: #fff; padding: 5px 20px; font-weight: bold; font-size: 17px; }
  
  .c-form-header-box { border: 1.5px solid #000; padding: 4px 12px; display: flex; align-items: center; gap: 10px; }
  .c-letter { font-size: 44px; font-weight: bold; line-height: 1; font-family: Arial, sans-serif; }
  .c-text-col { font-size: 13px; font-weight: bold; line-height: 1.25; text-align: left; }
  .c-act-col { font-size: 13px; font-weight: bold; line-height: 1.25; text-align: left; margin-left: 8px; }

  .header-grid { display: flex; gap: 14px; margin-bottom: 6px; align-items: flex-start; }
  .left-col { width: 50%; }
  .right-col { width: 50%; }

  .company-box { border: 1.5px solid #000; padding: 10px 12px; text-align: center; font-weight: bold; font-size: 15px; line-height: 1.55; }
  .epf-meta-table { width: 100%; border-collapse: collapse; }
  .epf-meta-table td { border: 1.5px solid #000; padding: 5px 8px; font-size: 13px; }

  .cbsl-block { margin-top: 10px; font-size: 12px; line-height: 1.5; color: #000; text-align: left; }
  .cbsl-block .cbsl-title { font-size: 12px; text-align: left; }
  .cbsl-block .cbsl-center-address { text-align: center; margin: 2px 0; }
  .cbsl-block .cbsl-dept { font-size: 13px; font-weight: bold; }
  .cbsl-block .cbsl-bank { font-size: 13px; }
  .cbsl-contacts { display: flex; justify-content: space-between; margin-top: 6px; font-size: 12px; text-align: left; line-height: 1.5; }
  .cheque-block { margin-top: 8px; font-size: 13px; line-height: 1.6; color: #000; }
  .notice-banner { text-align: center; font-size: 13px; line-height: 1.5; margin: 10px 0 8px 0; color: #000; }

  .data-table { width: 100%; border-collapse: collapse; text-align: center; font-size: 14px; }
  .data-table th, .data-table td { border: 1.5px solid #000; padding: 5px 3px; height: 22px; }
  .data-table th { font-weight: bold; font-size: 13px; }
  
  .align-left { text-align: left; padding-left: 4px !important; }
  .align-right { text-align: right; padding-right: 4px !important; }
  
  .rupees-cell { text-align: right; width: 68%; border-right: 1px solid #000 !important; padding-right: 4px !important; }
  .cents-cell { text-align: center; width: 32%; }

  .footer-section { margin-top: 16px; font-size: 13px; }
  .signature-line { margin-top: 22px; border-top: 1px dotted #000; width: 220px; text-align: center; }
</style>
    </head>
    <body>

      <!-- Top Row -->
      <div class="top-header">
  <div style="display: flex; flex-direction: column; align-items: flex-end; margin-left: 45px;">
    <div style="font-weight: bold; font-size: 16px; margin-bottom: 3px;">රා.සේ.පි.</div>
    <div class="black-badge">තැපැල් ගාස්තු ගෙවන ලදී එ - 13</div>
  </div>
        <div class="c-form-header-box">
          <div class="c-letter">C</div>
          <div class="c-text-col">
            <div>වාර්තාව</div>
            <div>FORM</div>
          </div>
          <div class="c-act-col">
            <div>1958 අංක 15 දරණ සේ.අ.අ. පනත</div>
            <div>EPF Act No. 15 of 1958</div>
          </div>
        </div>
      </div>

      <!-- Header Grid -->
      <div class="header-grid">
        <!-- Left Side: Address & CBSL Return Address -->
        <div class="left-col">
          <div class="company-box">
            <div>${company.name}</div>
            <div>${company.addressLine1}</div>
            <div>${company.addressLine2}</div>
            <div>${company.addressLine3}</div>
          </div>

          <div class="cbsl-block">
            <div class="cbsl-title">භාර දිය නොහැකි වුවහොත් ආපසු එවන්න.</div>
            <div class="cbsl-center-address">
              <div class="cbsl-dept">අධිකාරී, සේවක අර්ථසාධක අරමුදල,</div>
              <div class="cbsl-bank">ශ්‍රී ලංකා මහ බැංකුව, තැ.පෙ. 1299, කොළඹ.</div>
            </div>
            <div class="cbsl-contacts">
              <div>
                T18750.00 } 2206645<br/>
                16925.00 &nbsp;} 2206651
              </div>
              <div style="text-align: left;">
    ටෙලිෆෝන් } 2206645<br/>
    ෆැක්ස් &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;} 2206651<br/>
    ඊ - මේල් : epfhelpdesk@cbsl.lk<br/>
    වෙබ් &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;: www.epf.lk
  </div>
            </div>
          </div>
        </div>

        <!-- Right Side: EPF Metadata & Cheque details -->
        <div class="right-col">
          <table class="epf-meta-table">
            <tr>
              <td style="font-size: 12px;">සේ.අ.අ. සේව්‍යය අංකය<br/><b>E.P.F. Registration No.</b></td>
              <td style="font-size: 14px; font-weight: bold; text-align: center;">${company.epfRegNo}</td>
            </tr>
            <tr>
              <td style="font-size: 10px;">දායක දීමනා ගෙවනු ලබන වර්ෂය සහ මාසය<br/><b>Month and Year of Contribution</b></td>
              <td style="font-size: 12px; font-weight: bold; text-align: center;">${periodString}</td>
            </tr>
            <tr>
              <td style="font-size: 12px;">දායක මුදල් / <b>Contributions</b></td>
              <td style="padding:0;">
                <table style="width:100%; height:100%; border-collapse:collapse;">
                  <tr>
                    <td class="rupees-cell" style="border:none; border-right:1px solid #000 !important; font-size:10px;">${splitCurrency(grandTotals.total).r}</td>
                    <td class="cents-cell" style="border:none; font-size:10px;">${splitCurrency(grandTotals.total).c}</td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td style="font-size: 12px;">දඩ මුදල් / <b>Surcharges</b></td>
              <td style="padding:0;">
                <table style="width:100%; height:100%; border-collapse:collapse;">
                  <tr>
                    <td class="rupees-cell" style="border:none; border-right:1px solid #000 !important;"></td>
                    <td class="cents-cell" style="border:none; font-size:12px;">${splitCurrency(grandTotals.total).c}</td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td style="font-size: 12px;">මුළු ගෙවීම් / <b>Total Remittance</b></td>
              <td style="padding:0;">
                <table style="width:100%; height:100%; border-collapse:collapse;">
                  <tr>
                    <td class="rupees-cell" style="border:none; border-right:1px solid #000 !important; font-weight:bold; font-size:10px;">${splitCurrency(grandTotals.total).r}</td>
                    <td class="cents-cell" style="border:none; font-weight:bold; font-size:10px;">${splitCurrency(grandTotals.total).c}</td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>

          <div class="cheque-block">
            <div style="font-size: 10.5px;">චෙක්පත් අංකය</div>
            <div style="font-size: 9px;">Cheque No. ............................................................................</div>
            <div style="font-size: 1.5px; margin-top: 2px;">බැංකුවෙහි නම හා ශාඛාවෙහි නම</div>
            <div style="font-size: 9px;">Bank Name and Branch Name .............................................................</div>
            <div style="text-align: right; font-size: 14px; margin-top: 6px;">
  <div>පිටු අංකය</div>
  <div>Page No : <span style="font-size: 16px; font-weight: bold;">1</span></div>
</div>
          </div>
        </div>
      </div>

      <!-- Instruction Notice -->
      <div class="notice-banner">
        <div>මෙම වාර්තාව නිසි ලෙස පුරවා දායක දීමනා සමඟ සේවක අර්ථසාධක අරමුදල් අධිකාරී වෙත එවිය යුතුය.</div>
        <div>This form should be returned duly completed along with the contributions to the Superintendent/PDF</div>
      </div>

      <!-- Data Table -->
      <table class="data-table">
        <thead>
          <tr>
            <th rowspan="2" style="width: 26%;">සේවකයාගේ නම<br/>Employee's Name</th>
            <th rowspan="2" style="width: 15%;">ජාතික හැඳුනුම්පතෙහි අංකය<br/>National Id. No.</th>
            <th rowspan="2" style="width: 8%;">සාමාජික අංකය<br/>Member No.</th>
            <th colspan="6">දායක දීමනා (රු.) / Contributions (Rs.)</th>
            <th rowspan="2" style="width: 10%;">මුළු ඉපැයීම් (රු.)<br/>Total Earnings (Rs.)</th>
          </tr>
          <tr>
            <th colspan="2">එකතුව / Total</th>
            <th colspan="2">සේව්‍යයා / Employer</th>
            <th colspan="2">සේවකයා / Employee</th>
          </tr>
        </thead>
        <tbody>
          ${employees.map(e => {
      const tot = splitCurrency(e.total);
      const er = splitCurrency(e.employer);
      const ee = splitCurrency(e.employee);
      return `
              <tr>
                <td class="align-left">${e.name}</td>
                <td>${e.nic}</td>
                <td>${e.memberNo}</td>
                <td class="rupees-cell">${tot.r}</td><td class="cents-cell">${tot.c}</td>
                <td class="rupees-cell">${er.r}</td><td class="cents-cell">${er.c}</td>
                <td class="rupees-cell">${ee.r}</td><td class="cents-cell">${ee.c}</td>
                <td class="align-right">${e.earnings.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
              </tr>
            `;
    }).join('')}
          
          <tr style="font-weight: bold; background: #fafafa;">
            <td colspan="3" class="align-right">එකතුව / Total</td>
            <td class="rupees-cell">${splitCurrency(grandTotals.total).r}</td>
            <td class="cents-cell">${splitCurrency(grandTotals.total).c}</td>
            <td class="rupees-cell">${splitCurrency(grandTotals.employer).r}</td>
            <td class="cents-cell">${splitCurrency(grandTotals.employer).c}</td>
            <td class="rupees-cell">${splitCurrency(grandTotals.employee).r}</td>
            <td class="cents-cell">${splitCurrency(grandTotals.employee).c}</td>
            <td class="align-right">${grandTotals.earnings.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
          </tr>
        </tbody>
      </table>

      <!-- Footer Section -->
      <div class="footer-section">
  <div style="display: flex; justify-content: space-between; gap: 20px; margin-bottom: 10px;">
    <div style="flex: 1; font-size: 12px;">
      ඉහත සඳහන් විස්තර නිවැරදි බව සහතික කරමි.<br/>
      I certify that the information given above is correct.
    </div>
    <div style="flex: 1; font-size: 12px;">
      චෙක්පත පිටුපස සේ.අ.අ. සේව්‍යය අංකය ලියන්න.<br/>
      Please write Employer's EPF Registration Number on the reverse of the cheque
    </div>
  </div>
  <div style="display: flex; justify-content: space-between; margin-top: 14px;">
    <div style="display: flex; flex-direction: column; align-items: center;">
      <div class="signature-line"></div>
      <p style="margin-top: 3px; font-weight: bold; text-align: center;">සේව්‍යයාගේ අත්සන / Signature of Employer</p>
      <p style="margin-top: 0px; text-align: center; font-size: 12px;">දුරකථන අංකය / Telephone No.</p>
    </div>
    <div style="text-align: right; font-size: 12px;">
  <table style="margin-left: auto; border-collapse: collapse;">
    <tr>
      <td style="margin-right:10px;">Telephone : ${company.telephone}</td>
      <td style="padding: 1px 0;">ටෙලිෆෝන්</td>
    </tr>
    <tr>
      <td style="margin-right:10px;">Fax : ${company.fax}</td>
      <td style="padding: 1px 0;">ෆැක්ස් :</td>
    </tr>
    <tr>
      <td style="margin-right:10px;">E - mail</td>
    </tr>
  </table>
</div>
  </div>
</div>

    </body>
    </html>
    `;

    // Launch Puppeteer to create PDF buffer
    let browser;
    try {
      browser = await puppeteer.launch({
        headless: true,
        args: [
          "--no-sandbox",
          "--disable-setuid-sandbox",
          "--disable-dev-shm-usage",
          "--disable-gpu",
          "--no-first-run",
          "--no-zygote",
        ],
        timeout: 60000,
      });

      const page = await browser.newPage();
      await page.setContent(htmlContent, { waitUntil: "domcontentloaded" });

      const pdfRaw = await page.pdf({
        format: "A4",
        printBackground: true,
      });

      // page.pdf() returns Uint8Array in newer Puppeteer — must convert to Buffer
      const pdfBuffer = Buffer.from(pdfRaw);

      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Length", pdfBuffer.length);
      res.setHeader(
        "Content-Disposition",
        `attachment; filename=EPF_C_Form_${monthNum}_${yearNum}.pdf`
      );

      res.end(pdfBuffer);
      return;
    } finally {
      if (browser) {
        await browser.close().catch(() => { });
      }
    }
  } catch (error) {
    console.error("EPF C Form Generation Error:", error);
    res.status(500).json({ error: "Failed to generate EPF C Form" });
    return;
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// EPF C Form — Excel template fill (downloads as .xlsx)
// ─────────────────────────────────────────────────────────────────────────────
export const generateEPFCFormExcel = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { companyId, month, year } = req.query;
    if (!companyId || !month || !year) {
      res.status(400).json({ success: false, message: "Company ID, month, and year are required" });
      return;
    }

    const monthNum = Number(month);
    const yearNum = Number(year);

    const dbCompany = await Company.findById(companyId) as any;
    if (!dbCompany) {
      res.status(404).json({ success: false, message: "Company not found" });
      return;
    }

    const monthNames = ["", "JANUARY", "FEBRUARY", "MARCH", "APRIL", "MAY", "JUNE",
      "JULY", "AUGUST", "SEPTEMBER", "OCTOBER", "NOVEMBER", "DECEMBER"];
    const monthName = monthNames[monthNum];
    const periodString = `${monthName} /${String(yearNum).slice(-2)}`;

    // Fetch payroll rows
    const payrolls = await PayrollRun.find({ companyId, month: monthNum, year: yearNum }).sort({ employeeNo: 1 });

    // Build NIC map
    const employeeIds = payrolls.map((p) => p.employeeId);
    const dbEmps = await Employee.find({ _id: { $in: employeeIds } }).select("_id nic");
    const nicMap = new Map(dbEmps.map((e) => [e._id.toString(), e.nic || ""]));

    // Totals
    const totalEmployee8 = payrolls.reduce((s, p) => s + (p.epfEmployee8 || 0), 0);
    const totalEmployer12 = payrolls.reduce((s, p) => s + (p.epfEmployer12 || 0), 0);
    const totalContribs = totalEmployee8 + totalEmployer12;
    const totalEarnings = payrolls.reduce((s, p) => s + (p.salaryForEPF || 0), 0);

    // ── Load template ──────────────────────────────────────────────────
    const templatePath = path.join(__dirname, "../templates/EPF_C_Form_Template.xlsx");
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(templatePath);
    const sheet = workbook.getWorksheet("EPF C FORM")!;

    // ── Set A4 print settings ──────────────────────────────────────────
    sheet.pageSetup = {
      ...sheet.pageSetup,
      paperSize: 9,           // 9 = A4
      orientation: "portrait",
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 1,
      margins: {
        left: 0.4, right: 0.4,
        top: 0.4, bottom: 0.4,
        header: 0, footer: 0,
      },
    };

    // ── 1. Top Right C Form Header Box (G2:J3) ──────────────────────────
    const g2 = sheet.getCell("G2");
    g2.value = {
      richText: [
        { font: { bold: true, size: 20, name: "Arial" }, text: "C   " },
        { font: { bold: true, size: 8, name: "Arial" }, text: "වාර්තාව\n      FORM    " },
        { font: { bold: true, size: 8, name: "Arial" }, text: "1958 අංක 15 දරණ සේ.අ.අ. පනත\n                   EPF Act No. 15 of 1958" }
      ]
    };
    g2.alignment = { horizontal: "center", vertical: "middle", wrapText: true };

    const borderMedium = { style: "medium" as const, color: { argb: "FF000000" } };
    for (let r = 2; r <= 3; r++) {
      for (let c = 7; c <= 10; c++) {
        const cell = sheet.getRow(r).getCell(c);
        cell.border = {
          top: r === 2 ? borderMedium : undefined,
          bottom: r === 3 ? borderMedium : undefined,
          left: c === 7 ? borderMedium : undefined,
          right: c === 10 ? borderMedium : undefined,
        };
      }
    }

    // ── 2. Employer Box (A3:E6) ─────────────────────────────────────────
    const addressLines = "CITY MEDICALS DISTRIBUTORS (PVT)LTD,\nNO 62,\nYATANWALA,\nRUWANWELLA.";

    const a3 = sheet.getCell("A3");
    a3.value = addressLines;
    a3.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
    a3.font = { bold: true, size: 9.5, name: "Arial" };

    const borderThin = { style: "thin" as const, color: { argb: "FF000000" } };
    for (let r = 3; r <= 6; r++) {
      for (let c = 1; c <= 5; c++) {
        const cell = sheet.getRow(r).getCell(c);
        cell.border = {
          top: r === 3 ? borderThin : undefined,
          bottom: r === 6 ? borderThin : undefined,
          left: c === 1 ? borderThin : undefined,
          right: c === 5 ? borderThin : undefined,
        };
      }
    }

    // Center CBSL return address in template
    ["B9", "B10", "B11"].forEach((addr) => {
      const cell = sheet.getCell(addr);
      if (cell) cell.alignment = { horizontal: "center", vertical: "middle" };
    });

    // ── 3. EPF Metadata (I4 to J8) & Page No ────────────────────────────
    sheet.getCell("I4").value = dbCompany.epfRegNo || "9933/U";
    sheet.getCell("I5").value = periodString;
    sheet.getCell("I6").value = Math.floor(totalContribs);
    sheet.getCell("J6").value = Math.round((totalContribs % 1) * 100);
    sheet.getCell("I7").value = null;
    sheet.getCell("J7").value = null;
    sheet.getCell("I8").value = Math.floor(totalContribs);
    sheet.getCell("J8").value = Math.round((totalContribs % 1) * 100);

    // Page number
    sheet.getCell("J15").value = 1;

    // ── 4. Fill data rows (starts at row 23, columns B–K) ────────────────
    const DATA_START = 23;
    const MAX_ROWS = 20; // template has 20 data rows (rows 23–42)

    const rs = (n: number) => Math.floor(n);
    const cts = (n: number) => Math.round((n % 1) * 100);

    for (let i = 0; i < MAX_ROWS; i++) {
      const r = DATA_START + i;
      const p = payrolls[i];

      if (p) {
        const nic = nicMap.get(p.employeeId?.toString() || "") || "";
        const ep8 = p.epfEmployee8 || 0;
        const er12 = p.epfEmployer12 || 0;
        const tot = ep8 + er12;

        sheet.getCell(`B${r}`).value = p.employeeName;          // Employee Name
        sheet.getCell(`C${r}`).value = nic;                     // NIC
        sheet.getCell(`D${r}`).value = p.employeeNo;            // Member No
        sheet.getCell(`E${r}`).value = rs(tot);                 // Total contrib (Rs)
        sheet.getCell(`F${r}`).value = cts(tot);                // Total contrib (Cts)
        sheet.getCell(`G${r}`).value = rs(er12);                // Employer (Rs)
        sheet.getCell(`H${r}`).value = cts(er12);               // Employer (Cts)
        sheet.getCell(`I${r}`).value = rs(ep8);                 // Employee (Rs)
        sheet.getCell(`J${r}`).value = cts(ep8);                // Employee (Cts)
        sheet.getCell(`K${r}`).value = p.salaryForEPF || 0;    // Total Earnings
      } else {
        // Clear empty rows
        for (let c = 2; c <= 11; c++) {
          sheet.getRow(r).getCell(c).value = null;
        }
      }
    }

    // ── 5. Totals row (Row 43 in template) ──────────────────────────────
    sheet.getCell("E43").value = { formula: "SUM(E23:E42)", result: rs(totalContribs) };
    sheet.getCell("F43").value = { formula: "SUM(F23:F42)", result: cts(totalContribs) };
    sheet.getCell("G43").value = { formula: "SUM(G23:G42)", result: rs(totalEmployer12) };
    sheet.getCell("H43").value = { formula: "SUM(H23:H42)", result: cts(totalEmployer12) };
    sheet.getCell("I43").value = { formula: "SUM(I23:I42)", result: rs(totalEmployee8) };
    sheet.getCell("J43").value = { formula: "SUM(J23:J42)", result: cts(totalEmployee8) };
    sheet.getCell("K43").value = { formula: "SUM(K23:K42)", result: totalEarnings };

    // ── Stream response ────────────────────────────────────────────────
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", `attachment; filename="EPF_C_Form_${monthName}_${yearNum}.xlsx"`);
    await workbook.xlsx.write(res);
    res.end();
    return;
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
    return;
  }
};