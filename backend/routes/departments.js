import express from "express";
import mongoose from "mongoose";
import { asyncHandler } from "../middleware/errorHandler.js";
import { authorize } from "../middleware/auth.js";
import Department from "../models/Department.js";
import Employee from "../models/Employee.js";
import { assertScopedOrgId } from "../utils/orgScopeHelpers.js";

const router = express.Router();

const slugCode = (name) =>
  String(name || "DEPT")
    .replace(/[^a-zA-Z0-9]/g, "")
    .substring(0, 8)
    .toUpperCase() || "DEPT";

const escapeRegex = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Standard departments for new organizations */
const DEFAULT_DEPARTMENTS = [
  { name: "Human Resources", code: "HR", description: "Recruitment, policies, and employee relations" },
  { name: "Engineering", code: "ENG", description: "Product development and technical teams" },
  { name: "Finance", code: "FIN", description: "Accounting, payroll, and financial planning" },
  { name: "Sales", code: "SALES", description: "Revenue and customer acquisition" },
  { name: "Marketing", code: "MKT", description: "Brand, growth, and communications" },
  { name: "Operations", code: "OPS", description: "Day-to-day business operations" },
  { name: "Customer Support", code: "CS", description: "Client service and support" },
  { name: "Information Technology", code: "IT", description: "Infrastructure and internal systems" },
];

async function attachEmployeeCounts(departments, orgId) {
  const names = departments.map((d) => d.name).filter(Boolean);
  if (!names.length) return departments;

  const counts = await Employee.aggregate([
    {
      $match: {
        orgId: String(orgId),
        status: { $ne: "terminated" },
        department: { $in: names },
      },
    },
    { $group: { _id: "$department", count: { $sum: 1 } } },
  ]);

  const countByName = new Map(
    counts.map((c) => [String(c._id || "").toLowerCase(), c.count])
  );
  return departments.map((d) => ({
    ...d,
    employeeCount:
      countByName.get(String(d.name || "").toLowerCase()) || d.employeeCount || 0,
  }));
}

/** Include departments that exist on employee records but not in Department collection */
async function mergeEmployeeDepartments(departments, orgId, searchQuery = "") {
  const dbNames = new Set(departments.map((d) => String(d.name).toLowerCase()));
  const q = String(searchQuery || "").trim().toLowerCase();
  const fromEmployees = await Employee.aggregate([
    {
      $match: {
        orgId: String(orgId),
        status: { $ne: "terminated" },
        department: { $exists: true, $nin: [null, ""] },
      },
    },
    { $group: { _id: "$department", count: { $sum: 1 } } },
    { $sort: { _id: 1 } },
  ]);

  const merged = [...departments];
  for (const row of fromEmployees) {
    const name = String(row._id || "").trim();
    if (!name || dbNames.has(name.toLowerCase())) continue;
    merged.push({
      _id: null,
      name,
      code: slugCode(name),
      description: "",
      headName: "",
      orgId: String(orgId),
      isActive: true,
      employeeCount: row.count,
      source: "employees",
    });
    dbNames.add(name.toLowerCase());
  }
  return merged;
}

/**
 * GET /api/departments
 */
router.get(
  "/",
  authorize("super_admin", "admin", "hr", "manager"),
  asyncHandler(async (req, res) => {
    let orgId = null;
    const userRole = req.user?.role;
    
    // For Super Admin: require orgId query param
    if (userRole === 'super_admin') {
      orgId = req.query.orgId ? String(req.query.orgId).trim() : null;
      if (!orgId) {
        return res.status(400).json({
          success: false,
          message: "Organization is required for Super Admin department management",
          code: "ORG_ID_REQUIRED"
        });
      }
    } else {
      // For Admin/HR/Manager: use their own org from JWT
      orgId = assertScopedOrgId(req, res);
      if (!orgId) return;
    }
    
    const { search, status } = req.query;

    const filter = { orgId };
    if (status === "inactive") filter.isActive = false;
    else if (status === "all") {
      /* no isActive filter */
    } else {
      filter.isActive = true;
    }

    if (search && String(search).trim()) {
      const q = String(search).trim();
      filter.$or = [
        { name: { $regex: q, $options: "i" } },
        { description: { $regex: q, $options: "i" } },
        { headName: { $regex: q, $options: "i" } },
        { code: { $regex: q, $options: "i" } },
      ];
    }

    const searchQ = search && String(search).trim() ? String(search).trim() : "";
    let departments = await Department.find(filter).sort({ name: 1 }).lean();
    if (status !== "inactive") {
      departments = await mergeEmployeeDepartments(departments, orgId, searchQ);
    }
    departments = await attachEmployeeCounts(departments, orgId);
    departments.sort((a, b) => String(a.name).localeCompare(String(b.name)));

    res.json({ success: true, data: departments });
  })
);

/**
 * POST /api/departments/seed-defaults — create standard departments (skips existing names)
 */
router.post(
  "/seed-defaults",
  authorize("super_admin", "admin", "hr"),
  asyncHandler(async (req, res) => {
    let orgId = null;
    const userRole = req.user?.role;
    
    // For Super Admin: require orgId query param or body
    if (userRole === 'super_admin') {
      orgId = req.query.orgId || req.body.orgId ? String(req.query.orgId || req.body.orgId).trim() : null;
      if (!orgId) {
        return res.status(400).json({
          success: false,
          message: "Organization is required for Super Admin",
          code: "ORG_ID_REQUIRED"
        });
      }
    } else {
      // For Admin/HR: use their own org
      orgId = assertScopedOrgId(req, res);
      if (!orgId) return;
    }

    const created = [];
    const skipped = [];

    for (const def of DEFAULT_DEPARTMENTS) {
      const trimmedName = String(def.name).trim();
      const deptCode = String(def.code).trim().toUpperCase();

      const nameExists = await Department.findOne({
        orgId,
        name: {
          $regex: new RegExp(`^${escapeRegex(trimmedName)}$`, "i"),
        },
        isActive: true,
      });
      if (nameExists) {
        skipped.push({ name: trimmedName, reason: "already_exists" });
        continue;
      }

      const codeExists = await Department.findOne({
        orgId,
        code: deptCode,
        isActive: true,
      });
      if (codeExists) {
        skipped.push({ name: trimmedName, reason: "code_in_use" });
        continue;
      }

      const department = await Department.create({
        name: trimmedName,
        code: deptCode,
        description: def.description || "",
        headName: "",
        orgId,
        isActive: true,
        createdBy: req.user.userId || req.user.id,
      });
      created.push(department);
    }

    const createdLean = await attachEmployeeCounts(
      created.map((d) => d.toObject()),
      orgId
    );

    res.status(201).json({
      success: true,
      message:
        created.length > 0
          ? `Created ${created.length} department(s)${skipped.length ? `, skipped ${skipped.length} existing` : ""}`
          : "All predefined departments already exist",
      data: { created: createdLean, skipped },
    });
  })
);

/**
 * GET /api/departments/:id — department detail + employees
 */
router.get(
  "/:id",
  authorize("super_admin", "admin", "hr", "manager"),
  asyncHandler(async (req, res) => {
    let orgId = null;
    const userRole = req.user?.role;
    
    // For Super Admin: require orgId query param
    if (userRole === 'super_admin') {
      orgId = req.query.orgId ? String(req.query.orgId).trim() : null;
      if (!orgId) {
        return res.status(400).json({
          success: false,
          message: "Organization is required for Super Admin",
          code: "ORG_ID_REQUIRED"
        });
      }
    } else {
      // For Admin/HR/Manager: use their own org
      orgId = assertScopedOrgId(req, res);
      if (!orgId) return;
    }
    
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: "Invalid department ID" });
    }

    const department = await Department.findOne({ _id: id, orgId }).lean();
    if (!department) {
      return res.status(404).json({ success: false, message: "Department not found" });
    }

    const employees = await Employee.find({
      orgId,
      department: {
        $regex: new RegExp(`^${escapeRegex(department.name)}$`, "i"),
      },
      status: { $ne: "terminated" },
    })
      .populate("userId", "name email")
      .select("employeeCode designation department status joiningDate userId")
      .sort({ createdAt: -1 })
      .limit(200)
      .lean();

    const [withCount] = await attachEmployeeCounts([department], orgId);
    res.json({
      success: true,
      data: { ...withCount, employees, source: "database" },
    });
  })
);

/**
 * POST /api/departments
 */
router.post(
  "/",
  authorize("super_admin", "admin", "hr"),
  asyncHandler(async (req, res) => {
    let orgId = null;
    const userRole = req.user?.role;
    
    // For Super Admin: require orgId in body or query
    if (userRole === 'super_admin') {
      orgId = req.body.orgId || req.query.orgId ? String(req.body.orgId || req.query.orgId).trim() : null;
      if (!orgId) {
        return res.status(400).json({
          success: false,
          message: "Organization is required for Super Admin",
          code: "ORG_ID_REQUIRED"
        });
      }
    } else {
      // For Admin/HR: use their own org
      orgId = assertScopedOrgId(req, res);
      if (!orgId) return;
    }
    
    const { name, description, headName, code, isActive = true } = req.body;

    if (!name || !String(name).trim()) {
      return res.status(400).json({ success: false, message: "Department name is required" });
    }

    const trimmedName = String(name).trim();
    const deptCode = (code && String(code).trim().toUpperCase()) || slugCode(name);
    const nameExists = await Department.findOne({
      orgId,
      name: { $regex: new RegExp(`^${trimmedName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "i") },
      isActive: true,
    });
    if (nameExists) {
      return res.status(400).json({ success: false, message: "A department with this name already exists" });
    }
    const existing = await Department.findOne({ orgId, code: deptCode, isActive: true });
    if (existing) {
      return res.status(400).json({ success: false, message: "Department code already exists" });
    }

    const department = await Department.create({
      name: String(name).trim(),
      code: deptCode,
      description: description ? String(description).trim() : "",
      headName: headName ? String(headName).trim() : "",
      orgId,
      isActive: isActive !== false,
      createdBy: req.user.userId || req.user.id,
    });

    const [withCount] = await attachEmployeeCounts([department.toObject()], orgId);
    res.status(201).json({ success: true, data: withCount, message: "Department created" });
  })
);

/**
 * PUT /api/departments/:id
 */
router.put(
  "/:id",
  authorize("super_admin", "admin", "hr"),
  asyncHandler(async (req, res) => {
    let orgId = null;
    const userRole = req.user?.role;
    
    // For Super Admin: require orgId query param
    if (userRole === 'super_admin') {
      orgId = req.query.orgId ? String(req.query.orgId).trim() : null;
      if (!orgId) {
        return res.status(400).json({
          success: false,
          message: "Organization is required for Super Admin",
          code: "ORG_ID_REQUIRED"
        });
      }
    } else {
      // For Admin/HR: use their own org
      orgId = assertScopedOrgId(req, res);
      if (!orgId) return;
    }
    
    const { id } = req.params;
    const { name, description, headName, code, isActive } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: "Invalid department ID" });
    }

    const department = await Department.findOne({ _id: id, orgId });
    if (!department) {
      return res.status(404).json({ success: false, message: "Department not found" });
    }

    if (name !== undefined) department.name = String(name).trim();
    if (description !== undefined) department.description = String(description).trim();
    if (headName !== undefined) department.headName = String(headName).trim();
    if (isActive !== undefined) department.isActive = !!isActive;
    if (code !== undefined && String(code).trim()) {
      const deptCode = String(code).trim().toUpperCase();
      const dup = await Department.findOne({
        orgId,
        code: deptCode,
        _id: { $ne: id },
        isActive: true,
      });
      if (dup) {
        return res.status(400).json({ success: false, message: "Department code already in use" });
      }
      department.code = deptCode;
    }

    await department.save();
    const [withCount] = await attachEmployeeCounts([department.toObject()], orgId);
    res.json({ success: true, data: withCount, message: "Department updated" });
  })
);

/**
 * DELETE /api/departments/:id — soft delete
 */
router.delete(
  "/:id",
  authorize("super_admin", "admin", "hr"),
  asyncHandler(async (req, res) => {
    let orgId = null;
    const userRole = req.user?.role;
    
    // For Super Admin: require orgId query param
    if (userRole === 'super_admin') {
      orgId = req.query.orgId ? String(req.query.orgId).trim() : null;
      if (!orgId) {
        return res.status(400).json({
          success: false,
          message: "Organization is required for Super Admin",
          code: "ORG_ID_REQUIRED"
        });
      }
    } else {
      // For Admin/HR: use their own org
      orgId = assertScopedOrgId(req, res);
      if (!orgId) return;
    }
    
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: "Invalid department ID" });
    }

    const department = await Department.findOne({ _id: id, orgId });
    if (!department) {
      return res.status(404).json({ success: false, message: "Department not found" });
    }

    department.isActive = false;
    await department.save();
    res.json({ success: true, message: "Department deleted" });
  })
);

export default router;
