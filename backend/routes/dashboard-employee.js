/**
 * Employee Dashboard Routes
 * Provides employee-specific dashboard data
 */

import express from "express";
import { asyncHandler } from "../middleware/errorHandler.js";
import { authenticate, authorize } from "../middleware/auth.js";
import Employee from "../models/Employee.js";
import Attendance from "../models/Attendance.js";
import LeaveRequest from "../models/LeaveRequest.js";
import Expense from "../models/Expense.js";
import Payslip from "../models/Payroll.js";
import { sendSuccess, sendError } from "../utils/apiResponse.js";
import logger from "../utils/logger.js";
import { assertScopedOrgId } from "../utils/orgScopeHelpers.js";
import { findEmployeeForSelfService } from "../utils/employeeSelfService.js";

const router = express.Router();

/**
 * GET /api/dashboard/employee
 * Get employee dashboard data
 */
router.get(
  "/employee",
  authenticate,
  authorize("employee", "hr", "manager", "accountant", "admin", "super_admin"),
  asyncHandler(async (req, res) => {
    try {
      const userId = req.user.userId;
      const orgId = assertScopedOrgId(req, res);
      if (!orgId) return;

      let employee = await Employee.findOne({ userId, orgId }).lean();
      if (!employee) {
        employee = await findEmployeeForSelfService(userId, orgId, {
          allowCrossOrgFallback: true,
          createIfMissing: false
        });
      }

      if (!employee) {
        return sendError(res, "Employee record not found", 404, "EMPLOYEE_NOT_FOUND");
      }

      const employeeId = employee._id;

      // Get today's attendance
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);

      const todayAttendance = await Attendance.findOne({
        employeeId,
        date: { $gte: today, $lt: tomorrow }
      }).lean();

      // Get pending leave requests
      const pendingLeaves = await LeaveRequest.countDocuments({
        employeeId,
        status: "pending"
      });

      // Get approved leaves this month
      const currentMonth = new Date();
      currentMonth.setDate(1);
      currentMonth.setHours(0, 0, 0, 0);
      const nextMonth = new Date(currentMonth);
      nextMonth.setMonth(nextMonth.getMonth() + 1);

      const approvedLeavesThisMonth = await LeaveRequest.countDocuments({
        employeeId,
        status: "approved",
        startDate: { $gte: currentMonth, $lt: nextMonth }
      });

      // Get pending expenses
      const pendingExpenses = await Expense.countDocuments({
        employeeId,
        status: "pending"
      });

      // Get total expenses this month
      const totalExpensesThisMonth = await Expense.aggregate([
        {
          $match: {
            employeeId,
            createdAt: { $gte: currentMonth, $lt: nextMonth },
            status: { $in: ["approved", "paid"] }
          }
        },
        {
          $group: {
            _id: null,
            total: { $sum: "$amount" }
          }
        }
      ]);

      // Get latest payslip
      const latestPayslip = await Payslip.findOne({ employeeId })
        .sort({ createdAt: -1 })
        .lean();

      // Get recent leave requests
      const recentLeaves = await LeaveRequest.find({ employeeId })
        .sort({ createdAt: -1 })
        .limit(5)
        .lean();

      // Get recent expenses
      const recentExpenses = await Expense.find({ employeeId })
        .sort({ createdAt: -1 })
        .limit(5)
        .lean();

      const dashboardData = {
        employee: {
          id: employee._id,
          name: employee.name,
          designation: employee.designation,
          department: employee.department,
          email: employee.email,
          phone: employee.phone,
          avatar: employee.avatar
        },
        attendance: {
          today: todayAttendance ? {
            status: todayAttendance.status,
            checkIn: todayAttendance.checkIn,
            checkOut: todayAttendance.checkOut
          } : null,
          isPresent: todayAttendance?.status === "present"
        },
        leaves: {
          pending: pendingLeaves,
          approvedThisMonth: approvedLeavesThisMonth,
          recent: recentLeaves
        },
        expenses: {
          pending: pendingExpenses,
          totalThisMonth: totalExpensesThisMonth[0]?.total || 0,
          recent: recentExpenses
        },
        payroll: {
          latest: latestPayslip ? {
            id: latestPayslip._id,
            month: latestPayslip.month,
            year: latestPayslip.year,
            baseSalary: latestPayslip.baseSalary,
            netSalary: latestPayslip.netSalary,
            status: latestPayslip.status
          } : null
        }
      };

      logger.info("Employee dashboard data fetched", {
        userId,
        employeeId
      });

      return sendSuccess(res, dashboardData, "Dashboard data fetched successfully");
    } catch (error) {
      logger.error("Employee dashboard error", {
        error: error.message,
        userId: req.user.userId
      });
      return sendError(res, "Failed to fetch dashboard data", 500, "DASHBOARD_ERROR");
    }
  })
);

export default router;
