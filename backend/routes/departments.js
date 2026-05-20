import express from "express";
import mongoose from "mongoose";
import { asyncHandler } from "../middleware/errorHandler.js";
import { authorize } from "../middleware/auth.js";
import Department from "../models/Department.js";
import Employee from "../models/Employee.js";

const router = express.Router();

const slugCode = (name) =>
  String(name || "DEPT")
    .replace(/[^a-zA-Z0-9]/g, "")
    .substring(0, 8)
    .toUpperCase() || "DEPT";

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

  const countByName = new Map(counts.map((c) => [c._id, c.count]));
  return departments.map((d) => ({
    ...d,
    employeeCount: countByName.get(d.name) || 0,
  }));
}

/**
 * GET /api/departments
 */
router.get(
  "/",
  authorize("super_admin", "admin", "hr", "manager"),
  asyncHandler(async (req, res) => {
    const orgId = String(req.user?.orgId || "system");
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

    let departments = await Department.find(filter).sort({ name: 1 }).lean();
    departments = await attachEmployeeCounts(departments, orgId);

    res.json({ success: true, data: departments });
  })
);

/**
 * POST /api/departments
 */
router.post(
  "/",
  authorize("super_admin", "admin", "hr"),
  asyncHandler(async (req, res) => {
    const orgId = String(req.user?.orgId || "system");
    const { name, description, headName, code, isActive = true } = req.body;

    if (!name || !String(name).trim()) {
      return res.status(400).json({ success: false, message: "Department name is required" });
    }

    const deptCode = (code && String(code).trim().toUpperCase()) || slugCode(name);
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
      createdBy: req.user.userId,
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
    const orgId = String(req.user?.orgId || "system");
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
    const orgId = String(req.user?.orgId || "system");
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
