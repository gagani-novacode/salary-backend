import { Response } from "express";
import { Attendance } from "../models/Attendance";
import { Employee } from "../models/Employee";
import { parseAttendanceBuffer } from "../engine/excel_parser";
import { AuthRequest } from "../middleware/auth.middleware";

export const uploadAttendanceExcel = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { companyId, month, year } = req.body;
    if (!companyId || !month || !year) {
      res.status(400).json({ success: false, message: "Company ID, month, and year are required" });
      return;
    }

    if (!req.file || !req.file.buffer) {
      res.status(400).json({ success: false, message: "Excel file is required" });
      return;
    }

    const parsedData = await parseAttendanceBuffer(req.file.buffer);

    const createdRecords = [];
    const missingEmployees = [];

    for (const [key, item] of parsedData.entries()) {
      const { employee: empInfo, records } = item;

      // Find matching employee by employeeNo (userId in Excel) or name in the company
      let empDoc = await Employee.findOne({
        companyId,
        $or: [{ employeeNo: empInfo.userId }, { name: empInfo.name }],
      });

      if (!empDoc) {
        // Auto-create employee if not found, or track missing
        empDoc = await Employee.create({
          companyId,
          employeeNo: empInfo.userId,
          name: empInfo.name,
          department: empInfo.dept || "General",
          designation: "Staff",
          basicSalary: 30000, // default placeholder basic salary
          entitledHolidays: 14,
        });
      }

      // Upsert attendance document for this employee for this month/year
      const attendance = await Attendance.findOneAndUpdate(
        { companyId, employeeId: empDoc._id, month: Number(month), year: Number(year) },
        {
          employeeNo: empDoc.employeeNo,
          records,
          uploadedBy: req.user?._id,
        },
        { upsert: true, new: true }
      );

      createdRecords.push(attendance);
    }

    res.json({
      success: true,
      message: `Successfully processed attendance for ${createdRecords.length} employees`,
      count: createdRecords.length,
      data: createdRecords,
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getCompanyAttendance = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { companyId } = req.params;
    const { month, year } = req.query;

    const filter: any = { companyId };
    if (month) filter.month = Number(month);
    if (year) filter.year = Number(year);

    const records = await Attendance.find(filter)
      .populate("employeeId", "name employeeNo designation basicSalary department")
      .sort({ employeeNo: 1 });

    res.json({ success: true, count: records.length, data: records });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getEmployeeAttendance = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { employeeId, month, year } = req.params;
    const attendance = await Attendance.findOne({
      employeeId,
      month: Number(month),
      year: Number(year),
    });

    if (!attendance) {
      res.status(404).json({ success: false, message: "Attendance record not found for this period" });
      return;
    }

    res.json({ success: true, data: attendance });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const deleteAttendanceRecord = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const attendance = await Attendance.findByIdAndDelete(id);
    if (!attendance) {
      res.status(404).json({ success: false, message: "Attendance record not found" });
      return;
    }
    res.json({ success: true, message: "Attendance record deleted" });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};