import { Response } from "express";
import { Employee } from "../models/Employee";
import { AuthRequest } from "../middleware/auth.middleware";

export const getCompanyEmployees = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { companyId } = req.params;
    const employees = await Employee.find({ companyId }).sort({ employeeNo: 1 });
    res.json({ success: true, count: employees.length, data: employees });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getEmployeeById = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const employee = await Employee.findById(id).populate("companyId", "name branchLocation");
    if (!employee) {
      res.status(404).json({ success: false, message: "Employee not found" });
      return;
    }
    res.json({ success: true, data: employee });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const createEmployee = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { companyId, employeeNo, name, nic, designation, department, basicSalary, entitledHolidays, epfEligible, etfEligible, joiningDate } = req.body;
    if (!companyId || !employeeNo || !name || basicSalary === undefined) {
      res.status(400).json({ success: false, message: "Company ID, Employee No, Name, and Basic Salary are required" });
      return;
    }

    const existing = await Employee.findOne({ companyId, employeeNo });
    if (existing) {
      res.status(400).json({ success: false, message: `Employee No ${employeeNo} already exists in this company` });
      return;
    }

    const employee = await Employee.create({
      companyId,
      employeeNo,
      name,
      nic: nic || "",
      designation: designation || "Staff",
      department: department || "General",
      basicSalary: Number(basicSalary),
      entitledHolidays: entitledHolidays !== undefined ? Number(entitledHolidays) : 14,
      epfEligible: epfEligible !== undefined ? Boolean(epfEligible) : true,
      etfEligible: etfEligible !== undefined ? Boolean(etfEligible) : true,
      joiningDate: joiningDate ? new Date(joiningDate) : undefined,
    });

    res.status(201).json({ success: true, data: employee });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const updateEmployee = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const employee = await Employee.findByIdAndUpdate(id, req.body, { new: true, runValidators: true });
    if (!employee) {
      res.status(404).json({ success: false, message: "Employee not found" });
      return;
    }
    res.json({ success: true, data: employee });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const deleteEmployee = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const employee = await Employee.findByIdAndUpdate(id, { status: "inactive" }, { new: true });
    if (!employee) {
      res.status(404).json({ success: false, message: "Employee not found" });
      return;
    }
    res.json({ success: true, message: "Employee deactivated", data: employee });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};
