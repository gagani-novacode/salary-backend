import { Request, Response } from "express";
import { Company } from "../models/Company";
import { AuthRequest } from "../middleware/auth.middleware";

export const getPublicCompanies = async (req: Request, res: Response): Promise<void> => {
  try {
    const companies = await Company.find({}, "_id name branchLocation contactPhone contactEmail workingDaysPerMonth").sort({ createdAt: -1 });
    res.json({ success: true, count: companies.length, data: companies });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getCompanies = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    let filter = {};
    if (req.user?.role !== "super_admin" && req.user?.companyId) {
      filter = { _id: req.user.companyId };
    }

    const companies = await Company.find(filter).sort({ createdAt: -1 });
    res.json({ success: true, count: companies.length, data: companies });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getCompanyById = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const company = await Company.findById(id);
    if (!company) {
      res.status(404).json({ success: false, message: "Company not found" });
      return;
    }
    res.json({ success: true, data: company });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const createCompany = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { name, branchLocation, address, registrationNo, epfRegNo, etfRegNo, contactEmail, contactPhone, workingDaysPerMonth } = req.body;
    if (!name || !branchLocation) {
      res.status(400).json({ success: false, message: "Name and branch location are required" });
      return;
    }

    const company = await Company.create({
      name,
      branchLocation,
      address: address || "",
      registrationNo: registrationNo || "",
      epfRegNo: epfRegNo || "",
      etfRegNo: etfRegNo || "",
      contactEmail: contactEmail || "",
      contactPhone: contactPhone || "",
      workingDaysPerMonth: workingDaysPerMonth || 26,
      createdBy: req.user?._id,
    });

    res.status(201).json({ success: true, data: company });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const updateCompany = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const company = await Company.findByIdAndUpdate(id, req.body, { new: true, runValidators: true });
    if (!company) {
      res.status(404).json({ success: false, message: "Company not found" });
      return;
    }
    res.json({ success: true, data: company });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const deleteCompany = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const company = await Company.findByIdAndDelete(id);
    if (!company) {
      res.status(404).json({ success: false, message: "Company not found" });
      return;
    }
    res.json({ success: true, message: "Company deleted successfully" });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};
