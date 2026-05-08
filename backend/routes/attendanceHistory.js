import express from "express";
import { asyncHandler } from "../middleware/errorHandler.js";
import { authenticate, authorize } from "../middleware/auth.js";
import AttendanceHistory from "../models/AttendanceHistory.js";
import LeaveHistory from "../models/LeaveHistory.js";
import Employee from "../models/Employee.js";
import { sendSuccess, sendError, sendPaginated } from "../utils/apiResponse.js";
import logger from "../utils/logger.js";

const router = express.Router();

/**
 * GET /api/attendance-history/employee/:employeeId
 * Get attendance history for an employee with date range filter
 */
router.get(
  "/employee/:employeeId",
  authenticate,
  authorize("super_admin", "admin", "hr"),
  asyncHandler(async (req, res) => {
    try {
      const { employeeId } = req.params;
      const { startDate, endDate, status, page = 1, limit = 50 } = req.query;
      const orgId = req.user.orgId;
      const skip = (page - 1) * limit;

      // Validate employee exists
      const employee = await Employee.findById(employeeId);
      if (!employee) {
        return sendError(res, "Employee not found", 404, "NOT_FOUND");
      }

      // Build query
      const query = {
        employeeId,
        orgId
      };

      // Add date range filter
      if (startDate || endDate) {
        query.date = {};
        if (startDate) {
          query.date.$gte = new Date(startDate);
        }
        if (endDate) {
          const endDateObj = new Date(endDate);
          endDateObj.setHours(23, 59, 59, 999);
          query.date.$lte = endDateObj;
        }
      }

      // Add status filter
      if (status) {
        query.status = status;
      }

      // Get total count
      const total = await AttendanceHistory.countDocuments(query);

      // Get attendance records
      const attendanceRecords = await AttendanceHistory.find(query)
        .sort({ date: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .populate("leaveRequestId", "reason")
        .lean();

      logger.info("Attendance history fetched", {
        employeeId,
        recordCount: attendanceRecords.length,
        dateRange: { startDate, endDate }
      });

      return sendPaginated(
        res,
        attendanceRecords,
        total,
        page,
        limit,
        "Attendance history fetched successfully"
      );
    } catch (error) {
      logger.error("Get attendance history error", {
        error: error.message,
        employeeId: req.params.employeeId
      });
      return sendError(res, "Failed to fetch attendance history", 500, "FETCH_ERROR");
    }
  })
);

/**
 * GET /api/attendance-history/breaks/:employeeId
 * Get break history for an employee with date range filter
 */
router.get(
  "/breaks/:employeeId",
  authenticate,
  authorize("super_admin", "admin", "hr"),
  asyncHandler(async (req, res) => {
    try {
      const { employeeId } = req.params;
      const { startDate, endDate, breakType, page = 1, limit = 50 } = req.query;
      const orgId = req.user.orgId;
      const skip = (page - 1) * limit;

      // Validate employee exists
      const employee = await Employee.findById(employeeId);
      if (!employee) {
        return sendError(res, "Employee not found", 404, "NOT_FOUND");
      }

      // Build query
      const query = {
        employeeId,
        orgId,
        breakCount: { $gt: 0 }
      };

      // Add date range filter
      if (startDate || endDate) {
        query.date = {};
        if (startDate) {
          query.date.$gte = new Date(startDate);
        }
        if (endDate) {
          const endDateObj = new Date(endDate);
          endDateObj.setHours(23, 59, 59, 999);
          query.date.$lte = endDateObj;
        }
      }

      // Get total count
      const total = await AttendanceHistory.countDocuments(query);

      // Get attendance records with breaks
      const attendanceRecords = await AttendanceHistory.find(query)
        .sort({ date: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .lean();

      // Extract and flatten break data
      const breakRecords = [];
      attendanceRecords.forEach((record) => {
        if (record.breaks && record.breaks.length > 0) {
          record.breaks.forEach((breakItem) => {
            // Filter by break type if specified
            if (!breakType || breakItem.breakType === breakType) {
              breakRecords.push({
                date: record.date,
                breakType: breakItem.breakType,
                startTime: breakItem.startTime,
                endTime: breakItem.endTime,
                duration: breakItem.duration,
                reason: breakItem.reason,
                attendanceRecordId: record._id
              });
            }
          });
        }
      });

      logger.info("Break history fetched", {
        employeeId,
        breakCount: breakRecords.length,
        dateRange: { startDate, endDate }
      });

      return sendSuccess(
        res,
        {
          breaks: breakRecords,
          total: breakRecords.length,
          page,
          limit
        },
        "Break history fetched successfully"
      );
    } catch (error) {
      logger.error("Get break history error", {
        error: error.message,
        employeeId: req.params.employeeId
      });
      return sendError(res, "Failed to fetch break history", 500, "FETCH_ERROR");
    }
  })
);

/**
 * GET /api/attendance-history/leaves/:employeeId
 * Get leave history for an employee with date range filter
 */
router.get(
  "/leaves/:employeeId",
  authenticate,
  authorize("super_admin", "admin", "hr"),
  asyncHandler(async (req, res) => {
    try {
      const { employeeId } = req.params;
      const { startDate, endDate, leaveType, status, page = 1, limit = 50 } = req.query;
      const orgId = req.user.orgId;
      const skip = (page - 1) * limit;

      // Validate employee exists
      const employee = await Employee.findById(employeeId);
      if (!employee) {
        return sendError(res, "Employee not found", 404, "NOT_FOUND");
      }

      // Build query
      const query = {
        employeeId,
        orgId
      };

      // Add date range filter
      if (startDate || endDate) {
        query.$or = [
          {
            startDate: {
              $gte: startDate ? new Date(startDate) : new Date("1900-01-01"),
              $lte: endDate ? new Date(endDate) : new Date("2099-12-31")
            }
          },
          {
            endDate: {
              $gte: startDate ? new Date(startDate) : new Date("1900-01-01"),
              $lte: endDate ? new Date(endDate) : new Date("2099-12-31")
            }
          }
        ];
      }

      // Add leave type filter
      if (leaveType) {
        query.leaveType = leaveType;
      }

      // Add status filter
      if (status) {
        query.status = status;
      }

      // Get total count
      const total = await LeaveHistory.countDocuments(query);

      // Get leave records
      const leaveRecords = await LeaveHistory.find(query)
        .sort({ startDate: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .populate("approvedBy", "name email")
        .populate("cancelledBy", "name email")
        .lean();

      logger.info("Leave history fetched", {
        employeeId,
        recordCount: leaveRecords.length,
        dateRange: { startDate, endDate }
      });

      return sendPaginated(
        res,
        leaveRecords,
        total,
        page,
        limit,
        "Leave history fetched successfully"
      );
    } catch (error) {
      logger.error("Get leave history error", {
        error: error.message,
        employeeId: req.params.employeeId
      });
      return sendError(res, "Failed to fetch leave history", 500, "FETCH_ERROR");
    }
  })
);

/**
 * GET /api/attendance-history/summary/:employeeId
 * Get attendance summary for an employee
 */
router.get(
  "/summary/:employeeId",
  authenticate,
  authorize("super_admin", "admin", "hr"),
  asyncHandler(async (req, res) => {
    try {
      const { employeeId } = req.params;
      const { startDate, endDate } = req.query;
      const orgId = req.user.orgId;

      // Validate employee exists
      const employee = await Employee.findById(employeeId);
      if (!employee) {
        return sendError(res, "Employee not found", 404, "NOT_FOUND");
      }

      // Build query
      const query = {
        employeeId,
        orgId
      };

      // Add date range filter
      if (startDate || endDate) {
        query.date = {};
        if (startDate) {
          query.date.$gte = new Date(startDate);
        }
        if (endDate) {
          const endDateObj = new Date(endDate);
          endDateObj.setHours(23, 59, 59, 999);
          query.date.$lte = endDateObj;
        }
      }

      // Get attendance records
      const attendanceRecords = await AttendanceHistory.find(query).lean();

      // Calculate summary
      const summary = {
        totalDays: attendanceRecords.length,
        presentDays: 0,
        absentDays: 0,
        halfDays: 0,
        workFromHomeDays: 0,
        onLeaveDays: 0,
        holidayDays: 0,
        weekOffDays: 0,
        lateDays: 0,
        earlyDepartureDays: 0,
        totalBreaks: 0,
        totalBreakDuration: 0,
        totalHoursWorked: 0,
        averageHoursPerDay: 0
      };

      attendanceRecords.forEach((record) => {
        switch (record.status) {
          case "present":
            summary.presentDays++;
            break;
          case "absent":
            summary.absentDays++;
            break;
          case "half-day":
            summary.halfDays++;
            break;
          case "work-from-home":
            summary.workFromHomeDays++;
            break;
          case "on-leave":
            summary.onLeaveDays++;
            break;
          case "holiday":
            summary.holidayDays++;
            break;
          case "week-off":
            summary.weekOffDays++;
            break;
        }

        if (record.isLate) {
          summary.lateDays++;
        }
        if (record.isEarlyDeparture) {
          summary.earlyDepartureDays++;
        }

        summary.totalBreaks += record.breakCount || 0;
        summary.totalBreakDuration += record.totalBreakDuration || 0;
        summary.totalHoursWorked += record.hoursWorked || 0;
      });

      if (summary.presentDays > 0) {
        summary.averageHoursPerDay = Math.round(
          (summary.totalHoursWorked / summary.presentDays) * 100
        ) / 100;
      }

      logger.info("Attendance summary fetched", {
        employeeId,
        dateRange: { startDate, endDate }
      });

      return sendSuccess(res, summary, "Attendance summary fetched successfully");
    } catch (error) {
      logger.error("Get attendance summary error", {
        error: error.message,
        employeeId: req.params.employeeId
      });
      return sendError(res, "Failed to fetch attendance summary", 500, "FETCH_ERROR");
    }
  })
);

/**
 * POST /api/attendance-history/archive
 * Archive attendance record (for permanent history)
 */
router.post(
  "/archive",
  authenticate,
  authorize("super_admin", "admin", "hr"),
  asyncHandler(async (req, res) => {
    try {
      const { employeeId, date } = req.body;
      const orgId = req.user.orgId;

      if (!employeeId || !date) {
        return sendError(res, "Employee ID and date are required", 400, "VALIDATION_ERROR");
      }

      // Find and archive attendance record
      const attendanceRecord = await AttendanceHistory.findOne({
        employeeId,
        date: new Date(date),
        orgId
      });

      if (!attendanceRecord) {
        return sendError(res, "Attendance record not found", 404, "NOT_FOUND");
      }

      // Mark as archived (add archived flag)
      attendanceRecord.isArchived = true;
      attendanceRecord.archivedAt = new Date();
      attendanceRecord.archivedBy = req.user.userId;
      await attendanceRecord.save();

      logger.info("Attendance record archived", {
        employeeId,
        date,
        archivedBy: req.user.userId
      });

      return sendSuccess(res, attendanceRecord, "Attendance record archived successfully");
    } catch (error) {
      logger.error("Archive attendance record error", {
        error: error.message,
        userId: req.user.userId
      });
      return sendError(res, "Failed to archive attendance record", 500, "ARCHIVE_ERROR");
    }
  })
);

export default router;
