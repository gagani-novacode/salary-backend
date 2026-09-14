import { Response } from "express";
import { Holiday } from "../models/Holiday";
import { AuthRequest } from "../middleware/auth.middleware";

export const getHolidays = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { companyId } = req.query;
    let filter: any = {};
    if (companyId) filter.companyId = companyId;

    const holidays = await Holiday.find(filter).sort({ date: 1 });
    res.json({ success: true, count: holidays.length, data: holidays });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const createHoliday = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { companyId, date, name, type } = req.body;
    if (!companyId || !date || !name || !type) {
      res.status(400).json({ success: false, message: "Company ID, date, name, and type are required" });
      return;
    }

    const holiday = await Holiday.create({
      companyId,
      date,
      name,
      type,
      createdBy: req.user?._id,
    });

    res.status(201).json({ success: true, data: holiday });
  } catch (error: any) {
    if (error.code === 11000) {
      res.status(400).json({ success: false, message: "Holiday already exists on this date for this company" });
      return;
    }
    res.status(500).json({ success: false, message: error.message });
  }
};

export const deleteHoliday = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const holiday = await Holiday.findByIdAndDelete(id);
    if (!holiday) {
      res.status(404).json({ success: false, message: "Holiday not found" });
      return;
    }
    res.json({ success: true, message: "Holiday removed" });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};
