import dns from "dns";
dns.setDefaultResultOrder("ipv4first");
dns.setServers(["8.8.8.8", "8.8.4.4", "1.1.1.1"]);

import dotenv from "dotenv";
import bcrypt from "bcryptjs";
import { connectDB } from "./config/db";
import { User } from "./models/User";
import { Company } from "./models/Company";
import { Employee } from "./models/Employee";
import { Holiday } from "./models/Holiday";

dotenv.config();

async function seed() {
  await connectDB();

  console.log("[Seed] Starting database initialization...");

  // Seed Super Admin
  const adminEmail = "admin@pharmacy.lk";
  let superAdmin = await User.findOne({ email: adminEmail });
  if (!superAdmin) {
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash("Admin123!", salt);
    superAdmin = await User.create({
      name: "System Super Admin",
      email: adminEmail,
      passwordHash,
      role: "super_admin",
    });
    console.log(`[Seed] Super Admin created: ${adminEmail} (password: Admin123!)`);
  }

  // Seed Demo Pharmacy Companies (Branches)
  const branchesData = [
    {
      name: "MediCare Pharmacy - Colombo Central",
      branchLocation: "Colombo 03",
      address: "123 Galle Road, Colombo 03",
      registrationNo: "PV-12948",
      epfRegNo: "EPF/COL/48291",
      etfRegNo: "ETF/COL/19203",
      contactEmail: "colombo@medicare.lk",
      contactPhone: "011-2345678",
      workingDaysPerMonth: 26,
    },
    {
      name: "MediCare Pharmacy - Kandy Main",
      branchLocation: "Kandy City",
      address: "45 Dalada Veediya, Kandy",
      registrationNo: "PV-12949",
      epfRegNo: "EPF/KDY/38210",
      etfRegNo: "ETF/KDY/92831",
      contactEmail: "kandy@medicare.lk",
      contactPhone: "081-2233445",
      workingDaysPerMonth: 26,
    },
    {
      name: "MediCare Pharmacy - Galle Fort",
      branchLocation: "Galle Fort",
      address: "88 Church Street, Galle",
      registrationNo: "PV-12950",
      epfRegNo: "EPF/GLE/18492",
      etfRegNo: "ETF/GLE/77382",
      contactEmail: "galle@medicare.lk",
      contactPhone: "091-2244556",
      workingDaysPerMonth: 26,
    },
  ];

  for (const b of branchesData) {
    let company = await Company.findOne({ name: b.name });
    if (!company) {
      company = await Company.create({ ...b, createdBy: superAdmin._id });
      console.log(`[Seed] Created Branch Company: ${b.name}`);

      // Seed Company Admin User
      const adminEmail = b.contactEmail;
      let companyAdmin = await User.findOne({ email: adminEmail });
      if (!companyAdmin) {
        const salt = await bcrypt.genSalt(10);
        const passwordHash = await bcrypt.hash("Admin123!", salt);
        await User.create({
          name: `${b.name} Admin`,
          email: adminEmail,
          passwordHash,
          role: "company_admin",
          companyId: company._id,
        });
        console.log(`[Seed] Created Company Admin: ${adminEmail} (password: Admin123!)`);
      }

      // Add default employees for each company
      const demoEmployees = [
        { employeeNo: "EMP-001", name: "Kamal Perera", designation: "Chief Pharmacist", department: "Pharmacy", basicSalary: 85000, entitledHolidays: 14 },
        { employeeNo: "EMP-002", name: "Nimali Fernando", designation: "Assistant Pharmacist", department: "Pharmacy", basicSalary: 55000, entitledHolidays: 14 },
        { employeeNo: "EMP-003", name: "Sunil Jayasinghe", designation: "Cashier", department: "Front Desk", basicSalary: 42000, entitledHolidays: 14 },
        { employeeNo: "EMP-004", name: "Dilani Silva", designation: "Store Assistant", department: "Inventory", basicSalary: 38000, entitledHolidays: 14 },
      ];

      for (const e of demoEmployees) {
        await Employee.create({
          companyId: company._id,
          ...e,
          epfEligible: true,
          etfEligible: true,
          status: "active",
        });
      }

      // Add Poya holidays for current year
      const defaultPoya = [
        { date: "2026-07-29", name: "Esala Full Moon Poya Day", type: "poya" },
        { date: "2026-08-27", name: "Nikini Full Moon Poya Day", type: "poya" },
        { date: "2026-09-26", name: "Binara Full Moon Poya Day", type: "poya" },
      ];

      for (const h of defaultPoya) {
        await Holiday.create({
          companyId: company._id,
          date: h.date,
          name: h.name,
          type: h.type as any,
          createdBy: superAdmin._id,
        }).catch(() => {});
      }
    }
  }

  console.log("[Seed] Completed seeding successfully!");
  process.exit(0);
}

seed();
