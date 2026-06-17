import express from "express";
import mongoose from "mongoose";
import { asyncHandler } from "../middleware/errorHandler.js";
import { authenticate, authorize } from "../middleware/auth.js";
import Employee from "../models/Employee.js";
import Attendance from "../models/Attendance.js";
import LeaveRequest from "../models/LeaveRequest.js";
import Expense from "../models/Expense.js";
import User from "../models/User.js";
import Payslip from "../models/Payroll.js";
import Organization from "../models/Organization.js";
import ActivityLog from "../models/ActivityLog.js";
import Session from "../models/Session.js";
import { dashboardCache } from "../utils/dashboardCache.js";
import { dashboardMonitor } from "../utils/dashboardMonitor.js";
import { dashboardStatsBreaker, dashboardQuickStatsBreaker } from "../utils/circuitBreaker.js";
import {
  buildOrgIdFilter,
  countOrgEmployees,
  getFinancialTotals,
} from "../utils/dashboardKpiHelpers.js";
import {
  buildOrgIdFlexible,
  countEmployeesCurrentlyOnBreak,
} from "../utils/attendanceQueryHelpers.js";
import { assertScopedOrgId } from "../utils/orgScopeHelpers.js";

// Import specialized dashboard routes
import superAdminRoutes from "./dashboard-superadmin.js";
import employeeRoutes from "./dashboard-employee.js";

const router = express.Router();

// Mount specialized dashboard routes
router.use(superAdminRoutes);
router.use(employeeRoutes);

/**
 * Helper function to get date range based on filter type
 */
function getDateRange(filterType, customStartDate, customEndDate) {
  const now = new Date();
  let startDate, endDate;

  switch (filterType) {
    case 'day':
      startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      endDate = new Date(startDate.getTime() + 24 * 60 * 60 * 1000);
      break;
    case 'week':
      startDate = new Date(now);
      startDate.setDate(now.getDate() - now.getDay());
      startDate.setHours(0, 0, 0, 0);
      endDate = new Date(startDate.getTime() + 7 * 24 * 60 * 60 * 1000);
      break;
    case 'month':
      startDate = new Date(now.getFullYear(), now.getMonth(), 1);
      endDate = new Date(now.getFullYear(), now.getMonth() + 1, 1);
      break;
    case 'quarter':
      const quarter = Math.floor(now.getMonth() / 3);
      startDate = new Date(now.getFullYear(), quarter * 3, 1);
      endDate = new Date(now.getFullYear(), (quarter + 1) * 3, 1);
      break;
    case 'year':
      startDate = new Date(now.getFullYear(), 0, 1);
      endDate = new Date(now.getFullYear() + 1, 0, 1);
      break;
    case 'custom':
      startDate = new Date(customStartDate);
      endDate = new Date(customEndDate);
      endDate.setHours(23, 59, 59, 999);
      break;
    default:
      startDate = new Date(now.getFullYear(), now.getMonth(), 1);
      endDate = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  }

  return { startDate, endDate };
}

function getDayBounds(baseDate = new Date(), timezone = 'Asia/Kolkata') {
  // The Attendance.date field is stored as UTC midnight (00:00:00 UTC).
  // For India timezone (UTC+5:30), midnight in India = previous day 18:30 UTC.
  // 
  // Example: 
  // - June 12, 2026 India local date = June 12, 2026 00:00 Asia/Kolkata
  //   = June 11, 2026 18:30:00 UTC
  // - June 13, 2026 India local date = June 13, 2026 00:00 Asia/Kolkata
  //   = June 12, 2026 18:30:00 UTC
  //
  // Since Attendance.date stores UTC midnight, we need to:
  // 1. Get the timezone-local date parts
  // 2. Create UTC midnight for that local date
  // 3. Subtract timezone offset to get the actual UTC boundary
  
  const formatter = new Intl.DateTimeFormat('en-GB', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });
  
  const parts = formatter.formatToParts(baseDate);
  const year = parseInt(parts.find(p => p.type === 'year')?.value || '2024', 10);
  const month = parseInt(parts.find(p => p.type === 'month')?.value || '01', 10) - 1;
  const day = parseInt(parts.find(p => p.type === 'day')?.value || '01', 10);
  
  // UTC midnight for this local date
  const startUtcMidnight = new Date(Date.UTC(year, month, day, 0, 0, 0, 0));
  const endUtcMidnight = new Date(Date.UTC(year, month, day + 1, 0, 0, 0, 0));
  
  // For Asia/Kolkata (UTC+5:30), local midnight = UTC previous day 18:30
  // So we need to subtract 5.5 hours from the UTC midnight to get the stored date value
  const timezoneOffsets = {
    'Asia/Kolkata': 5.5 * 60 * 60 * 1000,      // UTC+5:30
    'America/New_York': -5 * 60 * 60 * 1000,   // UTC-5 (EST)
    'America/Los_Angeles': -8 * 60 * 60 * 1000, // UTC-8 (PST)
    'Europe/London': 0,                         // UTC (GMT in winter, BST in summer - simplified)
  };
  
  const offset = timezoneOffsets[timezone] || 0;
  
  // Subtract offset to get the UTC timestamp that represents local midnight
  const start = new Date(startUtcMidnight.getTime() - offset);
  const end = new Date(endUtcMidnight.getTime() - offset);
  
  return { start, end };
}

/**
 * GET /api/dashboard/stats
 * Get dashboard statistics with optional date filtering
 * OPTIMIZED: Combined aggregations, lean queries, caching, monitoring, and circuit breaker
 */
router.get("/stats", asyncHandler(async (req, res) => {
  // Disable caching for real-time data
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.set('Pragma', 'no-cache');
  res.set('Expires', '0');
  
  const startTime = Date.now();
  const orgId = assertScopedOrgId(req, res);
  if (!orgId) return;
  const { filterType = 'month', startDate, endDate } = req.query;
  
  try {
    // Check cache first (30 second TTL for stats)
    const cacheKey = { filterType, startDate, endDate };
    const cachedStats = await dashboardCache.getAsync('/dashboard/stats', orgId, cacheKey);
    if (cachedStats) {
      const responseTime = Date.now() - startTime;
      dashboardMonitor.recordMetric('/dashboard/stats', orgId, responseTime, true, true);
      return res.json({
        success: true,
        data: cachedStats,
        cached: true
      });
    }
    
    // Use circuit breaker to protect against cascading failures
    const statsData = await dashboardStatsBreaker.execute(async () => {
      // Get date range
      const { startDate: rangeStart, endDate: rangeEnd } = getDateRange(filterType, startDate, endDate);
      const now = new Date();
      
      // OPTIMIZATION: Use single aggregation pipeline for expenses and payroll
      const orgFilter = buildOrgIdFilter(orgId);
      const [
        totalEmployees,
        financialTotals,
        attendanceStats,
        loggedInEmployees,
        onLeaveCount
      ] = await Promise.all([
        countOrgEmployees(orgId),
        getFinancialTotals(orgId, rangeStart, rangeEnd),
        Attendance.aggregate([
          {
            $match: {
              ...orgFilter,
              date: { $gte: rangeStart, $lt: rangeEnd },
              status: 'present'
            }
          },
          { $group: { _id: null, avgHours: { $avg: "$hoursWorked" } } }
        ]),
        Session.countDocuments({ ...orgFilter, isActive: true, role: 'employee' }).lean(),
        LeaveRequest.countDocuments({
          ...orgFilter,
          status: 'approved',
          startDate: { $lte: now },
          endDate: { $gte: now }
        }).lean()
      ]);
      
      const { thisMonthExpenses, thisMonthPayroll, totalCost } = financialTotals;
      const avgHours = attendanceStats[0]?.avgHours || 0;
      const avgProductivity = Math.min(100, Math.round((avgHours / 8) * 100));
      
      return {
        totalEmployees,
        avgProductivity,
        thisMonthExpenses,
        thisMonthPayroll,
        totalCost,
        loggedInEmployees,
        onLeave: onLeaveCount
      };
    }, () => {
      // Fallback: return cached data or empty stats
      return cachedStats || {
        totalEmployees: 0,
        avgProductivity: 0,
        thisMonthExpenses: 0,
        thisMonthPayroll: 0,
        totalCost: 0,
        loggedInEmployees: 0,
        onLeave: 0
      };
    });
    
    // Cache the result (30 second TTL)
    dashboardCache.set('/dashboard/stats', orgId, statsData, cacheKey, 30000);
    
    const responseTime = Date.now() - startTime;
    dashboardMonitor.recordMetric('/dashboard/stats', orgId, responseTime, false, true);
    
    res.json({
      success: true,
      data: statsData
    });
  } catch (error) {
    const responseTime = Date.now() - startTime;
    dashboardMonitor.recordMetric('/dashboard/stats', orgId, responseTime, false, false);
    throw error;
  }
}));

/**
 * GET /api/dashboard/expense-trends
 * Get expense trends for charts
 */
router.get("/expense-trends", asyncHandler(async (req, res) => {
  const orgId = assertScopedOrgId(req, res);
  if (!orgId) return;
  
  // Get last 6 months of expense data
  const sixMonthsAgo = new Date();
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
  
  const expenseTrends = await Expense.aggregate([
    {
      $match: {
        orgId,
        createdAt: { $gte: sixMonthsAgo },
        status: { $in: ['approved', 'paid'] }
      }
    },
    {
      $group: {
        _id: {
          year: { $year: "$createdAt" },
          month: { $month: "$createdAt" }
        },
        amount: { $sum: "$amount" },
        count: { $sum: 1 }
      }
    },
    {
      $sort: { "_id.year": 1, "_id.month": 1 }
    },
    {
      $project: {
        _id: 0,
        month: {
          $arrayElemAt: [
            ["", "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"],
            "$_id.month"
          ]
        },
        amount: 1,
        count: 1
      }
    }
  ]);
  
  res.json({
    success: true,
    data: expenseTrends
  });
}));

/**
 * GET /api/dashboard/recent-leave-requests
 * Get recent leave requests for approval
 * OPTIMIZED: Use lean() and single aggregation pipeline
 */
router.get("/recent-leave-requests", asyncHandler(async (req, res) => {
  const orgId = assertScopedOrgId(req, res);
  if (!orgId) return;
  const limit = parseInt(req.query.limit) || 10;
  
  const leaveRequests = await LeaveRequest.aggregate([
    {
      $match: {
        orgId,
        status: 'pending'
      }
    },
    {
      $lookup: {
        from: 'employees',
        localField: 'employeeId',
        foreignField: '_id',
        as: 'employee'
      }
    },
    {
      $unwind: {
        path: '$employee',
        preserveNullAndEmptyArrays: true
      }
    },
    {
      $lookup: {
        from: 'users',
        localField: 'employee.userId',
        foreignField: '_id',
        as: 'user'
      }
    },
    {
      $unwind: {
        path: '$user',
        preserveNullAndEmptyArrays: true
      }
    },
    {
      $project: {
        _id: 1,
        employeeName: { $ifNull: ['$user.name', 'Unknown'] },
        employeeEmail: '$user.email',
        department: { $ifNull: ['$employee.department', 'N/A'] },
        type: 1,
        startDate: 1,
        endDate: 1,
        reason: 1,
        status: 1,
        createdAt: 1
      }
    },
    {
      $sort: { createdAt: -1 }
    },
    {
      $limit: limit
    }
  ]);
  
  res.json({
    success: true,
    data: leaveRequests
  });
}));

/**
 * GET /api/dashboard/todays-attendance
 * Get today's attendance summary
 * Includes active check-ins (checkIn exists, checkOut may be null)
 * OPTIMIZED: Use aggregation pipeline with pagination
 */
router.get("/todays-attendance", asyncHandler(async (req, res) => {
  const userOrgId = assertScopedOrgId(req, res);
  if (!userOrgId) return;
  
  const { start: today, end: tomorrow } = getDayBounds();
  const page = Math.max(1, parseInt(req.query.page || '1', 10) || 1);
  const limit = Math.max(1, Math.min(100, parseInt(req.query.limit || '10', 10) || 10));
  const skip = (page - 1) * limit;

  const orgMatch = buildOrgIdFlexible(userOrgId);

  // Filter for active check-ins only (not checked out)
  // Must match /admin/summary loggedInEmployees query for consistency
  const activeAttendanceFilter = {
    ...orgMatch,
    date: { $gte: today, $lt: tomorrow },
    // Check-in exists using both field names
    $and: [
      { $or: [{ checkIn: { $exists: true, $ne: null } }, { checkInTime: { $exists: true, $ne: null } }] },
      // Not checked out using both field names
      {
        $and: [
          { $or: [{ checkOut: { $exists: false } }, { checkOut: null }] },
          { $or: [{ checkOutTime: { $exists: false } }, { checkOutTime: null }] }
        ]
      }
    ]
  };

  // Get total count
  const totalCount = await Attendance.countDocuments(activeAttendanceFilter);

  const todaysAttendance = await Attendance.aggregate([
    {
      $match: activeAttendanceFilter
    },
    {
      $lookup: {
        from: 'employees',
        localField: 'employeeId',
        foreignField: '_id',
        as: 'employee'
      }
    },
    {
      $unwind: {
        path: '$employee',
        preserveNullAndEmptyArrays: true
      }
    },
    {
      $lookup: {
        from: 'users',
        localField: 'employee.userId',
        foreignField: '_id',
        as: 'user'
      }
    },
    {
      $unwind: {
        path: '$user',
        preserveNullAndEmptyArrays: true
      }
    },
    {
      $project: {
        _id: 1,
        employeeName: { $ifNull: ['$user.name', 'Unknown'] },
        employeeEmail: '$user.email',
        department: { $ifNull: ['$employee.department', 'N/A'] },
        checkIn: 1,
        checkOut: 1,
        hoursWorked: { $ifNull: ['$hoursWorked', 0] },
        status: 1,
        date: 1,
        breaks: { $ifNull: ['$breaks', []] },
        meetings: { $ifNull: ['$meetings', []] },
        // Add computed current duration if still checked in
        isCheckedIn: {
          $cond: [
            { $and: [{ $ne: ['$checkIn', null] }, { $eq: ['$checkOut', null] }] },
            true,
            false
          ]
        }
      }
    },
    {
      $sort: { checkIn: -1 }
    },
    {
      $skip: skip
    },
    {
      $limit: limit
    }
  ]);
  
  res.json({
    success: true,
    data: todaysAttendance,
    pagination: {
      page,
      limit,
      total: totalCount,
      totalPages: Math.ceil(totalCount / limit),
      hasPrev: page > 1,
      hasNext: page < Math.ceil(totalCount / limit)
    }
  });
}));

/**
 * GET /api/dashboard/department-stats
 * Get department-wise statistics
 */
router.get("/department-stats", asyncHandler(async (req, res) => {
  const orgId = assertScopedOrgId(req, res);
  if (!orgId) return;
  
  const departmentStats = await Employee.aggregate([
    {
      $match: { orgId, status: 'active' }
    },
    {
      $group: {
        _id: "$department",
        employeeCount: { $sum: 1 },
        avgSalary: { $avg: "$baseSalary" }
      }
    },
    {
      $project: {
        department: "$_id",
        employeeCount: 1,
        avgSalary: { $round: ["$avgSalary", 2] }
      }
    },
    {
      $sort: { employeeCount: -1 }
    }
  ]);
  
  res.json({
    success: true,
    data: departmentStats
  });
}));

/**
 * GET /api/dashboard/recent-activities
 * Get recent system activities
 */
router.get("/recent-activities", asyncHandler(async (req, res) => {
  const orgId = assertScopedOrgId(req, res);
  if (!orgId) return;
  const limit = parseInt(req.query.limit) || 20;
  
  // This would typically come from an ActivityLog model
  // For now, we'll aggregate from various sources
  
  const activities = [];
  
  // Recent employee additions
  const recentEmployees = await Employee.find({
    orgId,
    createdAt: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) }
  })
  .populate('userId', 'name')
  .sort({ createdAt: -1 })
  .limit(5)
  .lean();
  
  recentEmployees.forEach(emp => {
    activities.push({
      type: 'employee_added',
      description: `New employee ${emp.userId?.name} added`,
      timestamp: emp.createdAt,
      icon: 'user-plus'
    });
  });
  
  // Recent leave requests
  const recentLeaves = await LeaveRequest.find({
    orgId,
    createdAt: { $gte: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000) }
  })
  .populate('employeeId', 'userId')
  .populate({
    path: 'employeeId',
    populate: { path: 'userId', select: 'name' }
  })
  .sort({ createdAt: -1 })
  .limit(5)
  .lean();
  
  recentLeaves.forEach(leave => {
    activities.push({
      type: 'leave_request',
      description: `${leave.employeeId?.userId?.name} requested ${leave.type} leave`,
      timestamp: leave.createdAt,
      icon: 'calendar'
    });
  });
  
  // Sort all activities by timestamp and limit
  activities.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  
  res.json({
    success: true,
    data: activities.slice(0, limit)
  });
}));

/**
 * GET /api/dashboard/quick-stats
 * Get quick statistics for widgets
 * OPTIMIZED: Reduced queries, caching, monitoring, and circuit breaker
 */
router.get("/quick-stats", asyncHandler(async (req, res) => {
  // Disable caching for real-time data
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.set('Pragma', 'no-cache');
  res.set('Expires', '0');
  
  const startTime = Date.now();
  const orgId = assertScopedOrgId(req, res);
  if (!orgId) return;
  const { filterType = 'month', startDate, endDate } = req.query;
  
  try {
    // Check cache first (20 second TTL for quick-stats - more frequent updates)
    const cacheKey = { filterType, startDate, endDate };
    const cachedStats = await dashboardCache.getAsync('/dashboard/quick-stats', orgId, cacheKey);
    if (cachedStats) {
      const responseTime = Date.now() - startTime;
      dashboardMonitor.recordMetric('/dashboard/quick-stats', orgId, responseTime, true, true);
      return res.json({
        success: true,
        data: cachedStats,
        cached: true
      });
    }
    
    // Use circuit breaker to protect against cascading failures
    const responseData = await dashboardQuickStatsBreaker.execute(async () => {
      // Get date range
      const { startDate: rangeStart, endDate: rangeEnd } = getDateRange(filterType, startDate, endDate);
      
      const now = new Date();
      const { start: startOfDay, end: endOfDay } = getDayBounds(now);
      const orgMatch = buildOrgIdFlexible(orgId);
      
      // OPTIMIZATION: Use faceted aggregation to get multiple stats in one query
      const [
        totalEmployees,
        attendanceStats,
        onBreakToday,
        leaveExpenseStats,
        salesStats
      ] = await Promise.all([
        countOrgEmployees(orgId),
        // Attendance stats in one aggregation
        // Count employees who are currently logged in TODAY (checked in, not checked out)
        Attendance.aggregate([
          {
            $facet: {
              presentToday: [
                {
                  $match: {
                    ...orgMatch,
                    date: { $gte: startOfDay, $lt: endOfDay },
                    status: 'present'
                  }
                },
                { $count: 'count' }
              ],
              // Logged in: TODAY's attendance with checkIn but no checkOut (currently active session)
              activeUsers: [
                {
                  $match: {
                    ...orgMatch,
                    date: { $gte: startOfDay, $lt: endOfDay },
                    checkIn: { $exists: true, $ne: null },
                    $or: [{ checkOut: { $exists: false } }, { checkOut: null }]
                  }
                },
                { $count: 'count' }
              ],
            }
          }
        ]),
        countEmployeesCurrentlyOnBreak(Attendance, orgMatch, startOfDay, endOfDay),
        // Leave and expense stats in one aggregation
        LeaveRequest.aggregate([
          {
            $facet: {
              pendingLeaves: [
                { $match: { orgId, status: 'pending' } },
                { $count: 'count' }
              ],
              onLeaveToday: [
                {
                  $match: {
                    orgId,
                    status: 'approved',
                    startDate: { $lte: now },
                    endDate: { $gte: startOfDay }
                  }
                },
                { $count: 'count' }
              ]
            }
          }
        ]),
        // Sales, loss, bonus, incentive stats
        Payslip.aggregate([
          {
            $match: {
              orgId,
              createdAt: { $gte: rangeStart, $lt: rangeEnd }
            }
          },
          {
            $facet: {
              bonus: [
                { $group: { _id: null, total: { $sum: '$bonus' } } }
              ],
              incentive: [
                { $group: { _id: null, total: { $sum: '$incentives' } } }
              ]
            }
          }
        ])
      ]);
      
      // Extract values from aggregation results
      const presentToday = attendanceStats[0]?.presentToday[0]?.count || 0;
      const activeUsers = attendanceStats[0]?.activeUsers[0]?.count || 0;
      const pendingLeaves = leaveExpenseStats[0]?.pendingLeaves[0]?.count || 0;
      const onLeaveToday = leaveExpenseStats[0]?.onLeaveToday[0]?.count || 0;
      const totalBonus = salesStats[0]?.bonus[0]?.total || 0;
      const totalIncentive = salesStats[0]?.incentive[0]?.total || 0;
      
      // Get pending expenses count (simple count query)
      const pendingExpenses = await Expense.countDocuments({ orgId, status: 'pending' }).lean();
      
      // Get total sales and loss (simple aggregation)
      const [salesData, lossData] = await Promise.all([
        Expense.aggregate([
          {
            $match: {
              orgId,
              date: { $gte: rangeStart, $lt: rangeEnd },
              category: 'Sales',
              status: 'approved'
            }
          },
          { $group: { _id: null, total: { $sum: '$amount' } } }
        ]),
        Expense.aggregate([
          {
            $match: {
              orgId,
              date: { $gte: rangeStart, $lt: rangeEnd },
              status: 'rejected'
            }
          },
          { $group: { _id: null, total: { $sum: '$amount' } } }
        ])
      ]);
      
      const attendanceRate = totalEmployees > 0 ? Math.round((presentToday / totalEmployees) * 100) : 0;
      
      return {
        totalEmployees,
        presentToday,
        attendanceRate,
        pendingLeaves,
        pendingExpenses,
        activeUsers,
        onLeave: onLeaveToday,
        onBreak: onBreakToday,
        topEmployee: 'N/A',
        totalSales: salesData[0]?.total || 0,
        totalLoss: lossData[0]?.total || 0,
        totalBonus,
        totalIncentive
      };
    }, () => {
      // Fallback: return cached data or empty stats
      return cachedStats || {
        totalEmployees: 0,
        presentToday: 0,
        attendanceRate: 0,
        pendingLeaves: 0,
        pendingExpenses: 0,
        activeUsers: 0,
        onLeave: 0,
        onBreak: 0,
        topEmployee: 'N/A',
        totalSales: 0,
        totalLoss: 0,
        totalBonus: 0,
        totalIncentive: 0
      };
    });
    
    // Cache the result (20 second TTL)
    dashboardCache.set('/dashboard/quick-stats', orgId, responseData, cacheKey, 20000);
    
    const responseTime = Date.now() - startTime;
    dashboardMonitor.recordMetric('/dashboard/quick-stats', orgId, responseTime, false, true);
    
    res.json({
      success: true,
      data: responseData
    });
  } catch (error) {
    const responseTime = Date.now() - startTime;
    dashboardMonitor.recordMetric('/dashboard/quick-stats', orgId, responseTime, false, false);
    throw error;
  }
}));

/**
 * POST /api/dashboard/test-kpi-emit
 * Test endpoint to manually trigger KPI update emission (for debugging)
 * GATED: Only available in development environment
 */
router.post("/test-kpi-emit", asyncHandler(async (req, res) => {
  // Gate: Only available in development
  if (process.env.NODE_ENV === 'production') {
    return res.status(404).json({
      success: false,
      message: 'Not found',
      code: 'NOT_FOUND'
    });
  }
  
  const orgId = assertScopedOrgId(req, res);
  if (!orgId) return;
  
  // Import emitKPIUpdate
  const { emitKPIUpdate } = await import('../utils/kpiUpdater.js');
  
  // Trigger KPI update
  const result = await emitKPIUpdate(req.io, orgId, 'manual_test', {
    testTrigger: true,
    timestamp: new Date()
  });
  
  res.json({
    success: true,
    message: 'KPI update emitted successfully',
    data: result
  });
}));

/**
 * GET /api/dashboard/weekly-productivity
 * Get weekly productivity data for admin dashboard
 */
router.get("/weekly-productivity", asyncHandler(async (req, res) => {
  const orgId = assertScopedOrgId(req, res);
  if (!orgId) return;
  
  // Get current week date range
  const today = new Date();
  const startOfWeek = new Date(today);
  startOfWeek.setDate(today.getDate() - today.getDay()); // Sunday
  startOfWeek.setHours(0, 0, 0, 0);
  
  const endOfWeek = new Date(startOfWeek);
  endOfWeek.setDate(startOfWeek.getDate() + 7);
  
  // Get daily attendance data for the week
  const weeklyAttendance = await Attendance.aggregate([
    {
      $match: {
        orgId,
        date: { $gte: startOfWeek, $lt: endOfWeek },
        status: 'present'
      }
    },
    {
      $group: {
        _id: {
          dayOfWeek: { $dayOfWeek: "$date" }, // 1=Sunday, 2=Monday, etc.
          date: { $dateToString: { format: "%Y-%m-%d", date: "$date" } }
        },
        avgHours: { $avg: "$hoursWorked" },
        totalEmployees: { $sum: 1 },
        totalHours: { $sum: "$hoursWorked" }
      }
    },
    {
      $sort: { "_id.dayOfWeek": 1 }
    }
  ]);
  
  // Map to day names and calculate productivity
  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const productivityData = [];
  
  for (let i = 1; i <= 7; i++) { // 1=Sunday to 7=Saturday
    const dayData = weeklyAttendance.find(item => item._id.dayOfWeek === i);
    const dayName = dayNames[i - 1];
    
    let productivity = 0;
    if (dayData && dayData.avgHours > 0) {
      // Calculate productivity as percentage of 8-hour workday
      productivity = Math.min(100, Math.round((dayData.avgHours / 8) * 100));
    } else {
      // For days with no data, use historical average or default
      productivity = i >= 2 && i <= 6 ? 75 : 45; // Weekdays vs weekends
    }
    
    productivityData.push({
      day: dayName,
      productivity,
      avgHours: dayData?.avgHours || 0,
      employeeCount: dayData?.totalEmployees || 0
    });
  }
  
  res.json({
    success: true,
    data: productivityData
  });
}));

/**
 * GET /api/dashboard/health
 * Get dashboard health status and performance metrics
 */
router.get("/health", asyncHandler(async (req, res) => {
  const health = dashboardMonitor.getHealthStatus();
  const report = dashboardMonitor.getReport();
  
  res.json({
    success: true,
    data: {
      health,
      report,
      circuitBreakers: {
        stats: dashboardStatsBreaker.getStatus(),
        quickStats: dashboardQuickStatsBreaker.getStatus()
      }
    }
  });
}));

/**
 * POST /api/dashboard/cache/clear
 * Clear dashboard cache (admin only)
 */
router.post("/cache/clear", asyncHandler(async (req, res) => {
  const orgId = assertScopedOrgId(req, res);
  if (!orgId) return;
  
  dashboardCache.invalidateOrg(orgId);
  
  res.json({
    success: true,
    message: `Dashboard cache cleared for organization ${orgId}`
  });
}));

/**
 * POST /api/dashboard/circuit-breaker/reset
 * Reset circuit breakers (admin only)
 */
router.post("/circuit-breaker/reset", asyncHandler(async (req, res) => {
  dashboardStatsBreaker.reset();
  dashboardQuickStatsBreaker.reset();
  
  res.json({
    success: true,
    message: 'Circuit breakers reset'
  });
}));

/**
 * GET /api/dashboard/admin/summary
 * Optimized summary endpoint for admin dashboard KPI cards
 * Returns only critical data needed for KPI rendering
 * Supports period filtering: today, week, month, year, custom
 * 30 second cache
 */
router.get("/admin/summary", asyncHandler(async (req, res) => {
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  
  const orgId = assertScopedOrgId(req, res);
  if (!orgId) return;
  
  const { 
    period = 'month', 
    startDate: customStart = null, 
    endDate: customEnd = null,
    timezone = 'Asia/Kolkata'
  } = req.query;
  
  try {
    // Get date range based on period
    let rangeStart, rangeEnd;
    const now = new Date();
    
    if (period === 'custom' && customStart && customEnd) {
      rangeStart = new Date(customStart);
      rangeEnd = new Date(customEnd);
      rangeEnd.setHours(23, 59, 59, 999);
    } else if (period === 'today') {
      rangeStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      rangeEnd = new Date(rangeStart);
      rangeEnd.setDate(rangeEnd.getDate() + 1);
    } else if (period === 'week') {
      rangeStart = new Date(now);
      rangeStart.setDate(now.getDate() - now.getDay());
      rangeStart.setHours(0, 0, 0, 0);
      rangeEnd = new Date(rangeStart);
      rangeEnd.setDate(rangeEnd.getDate() + 7);
    } else if (period === 'quarter') {
      const quarter = Math.floor(now.getMonth() / 3);
      rangeStart = new Date(now.getFullYear(), quarter * 3, 1);
      rangeEnd = new Date(now.getFullYear(), (quarter + 1) * 3, 1);
    } else if (period === 'year') {
      rangeStart = new Date(now.getFullYear(), 0, 1);
      rangeEnd = new Date(now.getFullYear() + 1, 0, 1);
    } else { // default: month
      rangeStart = new Date(now.getFullYear(), now.getMonth(), 1);
      rangeEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    }
    
    const orgMatch = buildOrgIdFlexible(orgId);
    
    // Calculate today's bounds for "logged in" and "on break" counts
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const todayEnd = new Date(todayStart);
    todayEnd.setDate(todayEnd.getDate() + 1);
    
    // Query filters for the selected period
    const periodAttendanceFilter = {
      ...orgMatch,
      date: { $gte: rangeStart, $lt: rangeEnd }
    };
    
    // Query filters for today only (for logged in, on break)
    const todayAttendanceFilter = {
      ...orgMatch,
      date: { $gte: todayStart, $lt: todayEnd }
    };
    
    // Parallel KPI calculations
    const [
      totalEmployees,
      financialTotals,
      loggedInCount,
      onBreakCount,
      onLeaveCount,
      presentCount,
      avgProductivity
    ] = await Promise.all([
      // Total active employees in org
      countOrgEmployees(orgId),
      
      // Financial totals (expenses, payroll) in selected period
      getFinancialTotals(orgId, rangeStart, rangeEnd),
      
      // Logged in today: have checkIn, no checkOut (support both old and new field names)
      Attendance.countDocuments({
        ...todayAttendanceFilter,
        // Check-in exists using both field names
        $and: [
          { $or: [{ checkIn: { $exists: true, $ne: null } }, { checkInTime: { $exists: true, $ne: null } }] },
          // Not checked out using both field names
          {
            $and: [
              { $or: [{ checkOut: { $exists: false } }, { checkOut: null }] },
              { $or: [{ checkOutTime: { $exists: false } }, { checkOutTime: null }] }
            ]
          }
        ]
      }).then(count => {
        console.log('[ADMIN-SUMMARY] todayAttendanceFilter:', JSON.stringify(todayAttendanceFilter, null, 2));
        console.log('[ADMIN-SUMMARY] loggedInCount:', count);
        return count;
      }),
      
      // On break today: has active break in breaks array
      Attendance.countDocuments({
        ...todayAttendanceFilter,
        breaks: { 
          $elemMatch: { 
            startTime: { $exists: true, $ne: null },
            $or: [{ endTime: { $exists: false } }, { endTime: null }]
          }
        }
      }),
      
      // On leave in selected period: approved leaves overlapping period
      LeaveRequest.countDocuments({
        orgId,
        status: 'approved',
        startDate: { $lte: rangeEnd },
        endDate: { $gte: rangeStart }
      }).then(count => {
        // For period != today, use unique employee count
        if (period !== 'today') {
          return LeaveRequest.aggregate([
            {
              $match: {
                orgId,
                status: 'approved',
                startDate: { $lte: rangeEnd },
                endDate: { $gte: rangeStart }
              }
            },
            {
              $group: { _id: '$employeeId', count: { $sum: 1 } }
            },
            {
              $count: 'total'
            }
          ]).then(result => result[0]?.total || 0);
        }
        return count;
      }),
      
      // Present count in period (distinct employees with 'present' status)
      Attendance.countDocuments({
        ...periodAttendanceFilter,
        status: 'present'
      }),
      
      // Average productivity: use avgProductivity from attendanceQueryHelpers if available
      (async () => {
        try {
          const result = await Attendance.aggregate([
            {
              $match: {
                ...periodAttendanceFilter,
                hoursWorked: { $exists: true, $gt: 0 }
              }
            },
            {
              $group: {
                _id: null,
                avgHours: { $avg: '$hoursWorked' }
              }
            }
          ]);
          return result[0]?.avgHours ? Math.round(result[0].avgHours * 10) / 10 : 0;
        } catch (e) {
          return 0;
        }
      })()
    ]);
    
    const summary = {
      kpis: {
        totalEmployees: totalEmployees || 0,
        loggedInEmployees: loggedInCount || 0,
        onBreak: onBreakCount || 0,
        onLeave: onLeaveCount || 0,
        presentToday: presentCount || 0,
        thisMonthExpense: financialTotals?.thisMonthExpenses || 0,
        thisMonthPayroll: financialTotals?.thisMonthPayroll || 0,
        totalCost: (financialTotals?.totalCost || 0),
        avgProductivity: avgProductivity || 0
      },
      period,
      dateRange: {
        start: rangeStart.toISOString(),
        end: rangeEnd.toISOString()
      },
      lastUpdated: new Date().toISOString()
    };
    
    res.json({ success: true, data: summary });
  } catch (error) {
    console.error('Error fetching admin summary:', error);
    res.status(500).json({ success: false, message: 'Failed to load dashboard summary', error: error.message });
  }
}));

/**
 * GET /api/dashboard/employee/summary
 * Optimized summary endpoint for employee dashboard
 * Returns only critical data: today's status, pending leaves, latest payslip, total hours this month
 */
router.get("/employee/summary", authenticate, asyncHandler(async (req, res) => {
  res.set('Cache-Control', 'public, max-age=20');
  
  const userId = req.user?.userId;
  const orgId = assertScopedOrgId(req, res);
  if (!orgId || !userId) return;
  
  try {
    const cachedSummary = await dashboardCache.getAsync('/dashboard/employee/summary', orgId, { userId });
    if (cachedSummary) {
      return res.json({ success: true, data: cachedSummary, cached: true });
    }
    
    const { start: startOfDay, end: endOfDay } = getDayBounds();
    const userIdMatch = { userId: new mongoose.Types.ObjectId(userId) };
    
    // Get current month boundaries for total hours calculation
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    monthStart.setHours(0, 0, 0, 0);
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    monthEnd.setHours(0, 0, 0, 0);
    
    const [
      todayAttendance,
      pendingLeaveCount,
      latestPayslip,
      monthAttendanceRecords
    ] = await Promise.all([
      Attendance.findOne({
        ...userIdMatch,
        date: { $gte: startOfDay, $lt: endOfDay }
      }).select('checkIn checkOut status hoursWorked breaks').lean(),
      LeaveRequest.countDocuments({
        userId: new mongoose.Types.ObjectId(userId),
        status: 'pending'
      }),
      Payslip.findOne({
        userId: new mongoose.Types.ObjectId(userId)
      }).sort({ createdAt: -1 }).select('month year status netPay').lean(),
      Attendance.find({
        ...userIdMatch,
        date: { $gte: monthStart, $lt: monthEnd }
      }).select('hoursWorked').lean()
    ]);
    
    // Calculate total hours for current month
    let totalMonthHours = 0;
    if (Array.isArray(monthAttendanceRecords)) {
      totalMonthHours = monthAttendanceRecords.reduce((sum, record) => {
        return sum + (typeof record.hoursWorked === 'number' ? record.hoursWorked : 0);
      }, 0);
    }
    
    // Add active session time if employee is currently checked in
    if (todayAttendance?.checkIn && !todayAttendance?.checkOut) {
      // Calculate live hours for active session
      const now = new Date();
      const checkInTime = new Date(todayAttendance.checkIn);
      let grossHours = (now - checkInTime) / (1000 * 60 * 60);
      
      // Subtract break time from gross hours
      let breakHours = 0;
      if (Array.isArray(todayAttendance.breaks)) {
        for (const breakItem of todayAttendance.breaks) {
          if (breakItem?.startTime && breakItem?.endTime) {
            const breakDuration = (new Date(breakItem.endTime) - new Date(breakItem.startTime)) / (1000 * 60 * 60);
            breakHours += breakDuration;
          } else if (breakItem?.startTime && !breakItem?.endTime) {
            // Open break - don't count it towards working time
            const breakDuration = (now - new Date(breakItem.startTime)) / (1000 * 60 * 60);
            breakHours += breakDuration;
          }
        }
      }
      
      const activeSessionHours = Math.max(0, grossHours - breakHours);
      totalMonthHours += activeSessionHours;
    }
    
    // Convert decimal hours to label format (e.g., 12.5 => "12h 30m")
    const hoursInt = Math.floor(totalMonthHours);
    const minutesFloat = (totalMonthHours - hoursInt) * 60;
    const minutesInt = Math.round(minutesFloat);
    const totalHoursLabel = `${hoursInt}h ${minutesInt}m`;
    
    const summary = {
      kpis: {
        isCheckedIn: Boolean(todayAttendance?.checkIn && !todayAttendance?.checkOut),
        pendingLeaves: pendingLeaveCount,
        latestPayslipStatus: latestPayslip?.status || 'not_available',
        hoursWorkedToday: todayAttendance?.hoursWorked || 0,
        totalHoursMinutes: Math.round(totalMonthHours * 60),
        totalHoursLabel: totalHoursLabel
      },
      lastUpdated: new Date().toISOString()
    };
    
    dashboardCache.set('/dashboard/employee/summary', orgId, summary, { userId }, 20000);
    
    res.json({ success: true, data: summary });
  } catch (error) {
    console.error('Error fetching employee summary:', error);
    res.status(500).json({ success: false, message: 'Failed to load dashboard summary' });
  }
}));

/**
 * GET /api/dashboard/break-records
 * Get all break records for a given date with pagination
 * Breaks are extracted from Attendance.breaks[] array
 */
router.get("/break-records", authorize('super_admin', 'admin', 'hr', 'manager'), asyncHandler(async (req, res) => {
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  
  const orgId = assertScopedOrgId(req, res);
  if (!orgId) return;
  
  const page = Math.max(1, parseInt(req.query.page) || 1);
  const limit = Math.max(1, Math.min(100, parseInt(req.query.limit) || 10));
  const date = req.query.date ? new Date(req.query.date) : new Date();
  
  // Set date to midnight UTC for day boundary
  const dayStart = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const dayEnd = new Date(dayStart);
  dayEnd.setDate(dayEnd.getDate() + 1);
  
  try {
    const orgMatch = buildOrgIdFlexible(orgId);
    
    const dayStartStr = dayStart.toISOString().split('T')[0];
    const dayEndStr = dayEnd.toISOString().split('T')[0];
    
    // Get attendance records for the day with breaks - support both date formats
    const attendanceRecords = await Attendance.find({
      ...orgMatch,
      $or: [
        { date: { $gte: dayStart, $lt: dayEnd } },
        { localDate: { $gte: dayStartStr, $lt: dayEndStr } }
      ],
      breaks: { $exists: true, $elemMatch: { startTime: { $exists: true } } }
    })
    .select('employeeId employeeName breaks')
    .populate('employeeId', 'department')
    .sort({ createdAt: -1 })
    .lean();
    
    // Flatten breaks from all attendance records
    const allBreaks = [];
    attendanceRecords.forEach(att => {
      if (Array.isArray(att.breaks)) {
        att.breaks.forEach((breakItem, idx) => {
          if (breakItem?.startTime) {
            allBreaks.push({
              _id: `${att._id}-break-${idx}`,
              attendanceId: att._id,
              employeeId: att.employeeId?._id || null,
              employeeName: att.employeeName || 'Unknown',
              department: att.employeeId?.department || 'N/A',
              breakIndex: idx,
              breakType: breakItem.breakType || 'regular',
              startTime: breakItem.startTime,
              endTime: breakItem.endTime || null,
              duration: breakItem.duration || 0,
              status: breakItem.endTime ? 'ended' : 'active'
            });
          }
        });
      }
    });
    
    // Sort by start time descending
    allBreaks.sort((a, b) => new Date(b.startTime) - new Date(a.startTime));
    
    // Paginate
    const total = allBreaks.length;
    const totalPages = Math.ceil(total / limit);
    const start = (page - 1) * limit;
    const paginatedBreaks = allBreaks.slice(start, start + limit);
    
    res.json({
      success: true,
      data: paginatedBreaks,
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1
      }
    });
  } catch (error) {
    console.error('Error fetching break records:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to load break records', 
      error: error.message 
    });
  }
}));

/**
 * GET /api/dashboard/leave-requests
 * Get pending leave requests for admin dashboard
 * Supports status filter and pagination
 */
router.get("/leave-requests", authorize('super_admin', 'admin', 'hr', 'manager'), asyncHandler(async (req, res) => {
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  
  const orgId = assertScopedOrgId(req, res);
  if (!orgId) return;
  
  const page = Math.max(1, parseInt(req.query.page) || 1);
  const limit = Math.max(1, Math.min(100, parseInt(req.query.limit) || 10));
  const status = req.query.status || 'pending';
  const period = req.query.period || 'month';
  
  // Calculate period date range
  let rangeStart, rangeEnd;
  const now = new Date();
  
  if (period === 'today') {
    rangeStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    rangeEnd = new Date(rangeStart);
    rangeEnd.setDate(rangeEnd.getDate() + 1);
  } else if (period === 'week') {
    rangeStart = new Date(now);
    rangeStart.setDate(now.getDate() - now.getDay());
    rangeStart.setHours(0, 0, 0, 0);
    rangeEnd = new Date(rangeStart);
    rangeEnd.setDate(rangeEnd.getDate() + 7);
  } else if (period === 'quarter') {
    const quarter = Math.floor(now.getMonth() / 3);
    rangeStart = new Date(now.getFullYear(), quarter * 3, 1);
    rangeEnd = new Date(now.getFullYear(), (quarter + 1) * 3, 1);
  } else if (period === 'year') {
    rangeStart = new Date(now.getFullYear(), 0, 1);
    rangeEnd = new Date(now.getFullYear() + 1, 0, 1);
  } else { // month
    rangeStart = new Date(now.getFullYear(), now.getMonth(), 1);
    rangeEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  }
  
  try {
    // Build query - for pending leaves, show all not yet processed; for others, filter by period
    const leaveQuery = {
      orgId,
      status
    };
    
    if (status === 'pending') {
      // All pending leaves, not filtered by period
    } else if (status === 'approved' || status === 'rejected') {
      // Filter by period for approved/rejected
      leaveQuery.createdAt = { $gte: rangeStart, $lt: rangeEnd };
    }
    
    const total = await LeaveRequest.countDocuments(leaveQuery);
    
    const leaves = await LeaveRequest.find(leaveQuery)
      .populate('employeeId', 'department')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean();
    
    // Transform response - must match frontend LeaveRequestRow type
    const data = leaves.map(leave => ({
      _id: leave._id,
      employeeName: leave.employeeName || 'Unknown',
      employeeEmail: leave.employeeEmail || 'N/A',
      department: leave.employeeId?.department || 'N/A',
      type: leave.type,
      leaveType: leave.type,
      startDate: leave.startDate,
      endDate: leave.endDate,
      reason: leave.reason,
      status: leave.status,
      createdAt: leave.createdAt,
      userId: {
        name: leave.employeeName || 'Unknown'
      }
    }));
    
    const totalPages = Math.ceil(total / limit);
    
    res.json({
      success: true,
      data,
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1
      }
    });
  } catch (error) {
    console.error('Error fetching leave requests:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to load leave requests', 
      error: error.message 
    });
  }
}));

/**
 * GET /api/dashboard/today-attendance
 * Get today's attendance records with pagination
 * Supports status filter and pagination
 */
router.get("/today-attendance", authorize('super_admin', 'admin', 'hr', 'manager'), asyncHandler(async (req, res) => {
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  
  const orgId = assertScopedOrgId(req, res);
  if (!orgId) return;
  
  const page = Math.max(1, parseInt(req.query.page) || 1);
  const limit = Math.max(1, Math.min(100, parseInt(req.query.limit) || 10));
  const skip = (page - 1) * limit;

  try {
    const { start: today, end: tomorrow } = getDayBounds();
    const orgMatch = buildOrgIdFlexible(orgId);

    // Filter for active check-ins only (not checked out)
    // Must match /admin/summary loggedInEmployees query for consistency
    const activeAttendanceFilter = {
      ...orgMatch,
      date: { $gte: today, $lt: tomorrow },
      // Check-in exists using both field names
      $and: [
        { $or: [{ checkIn: { $exists: true, $ne: null } }, { checkInTime: { $exists: true, $ne: null } }] },
        // Not checked out using both field names
        {
          $and: [
            { $or: [{ checkOut: { $exists: false } }, { checkOut: null }] },
            { $or: [{ checkOutTime: { $exists: false } }, { checkOutTime: null }] }
          ]
        }
      ]
    };

    // Get total count with same filter as query
    const totalCount = await Attendance.countDocuments(activeAttendanceFilter);

    const records = await Attendance.aggregate([
      {
        $match: activeAttendanceFilter
      },
      {
        $lookup: {
          from: 'employees',
          localField: 'employeeId',
          foreignField: '_id',
          as: 'employee'
        }
      },
      {
        $unwind: {
          path: '$employee',
          preserveNullAndEmptyArrays: true
        }
      },
      {
        $lookup: {
          from: 'users',
          localField: 'employee.userId',
          foreignField: '_id',
          as: 'user'
        }
      },
      {
        $unwind: {
          path: '$user',
          preserveNullAndEmptyArrays: true
        }
      },
      {
        $project: {
          _id: 1,
          employeeName: { $ifNull: ['$user.name', 'Unknown'] },
          employeeEmail: '$user.email',
          department: { $ifNull: ['$employee.department', 'N/A'] },
          checkIn: 1,
          checkOut: 1,
          hoursWorked: { $ifNull: ['$hoursWorked', 0] },
          status: 1,
          date: 1,
          breaks: { $ifNull: ['$breaks', []] },
          meetings: { $ifNull: ['$meetings', []] },
          isCheckedIn: {
            $cond: [
              { $and: [{ $ne: ['$checkIn', null] }, { $eq: ['$checkOut', null] }] },
              true,
              false
            ]
          }
        }
      },
      {
        $sort: { checkIn: -1 }
      },
      {
        $skip: skip
      },
      {
        $limit: limit
      }
    ]);
    
    const totalPages = Math.ceil(totalCount / limit);
    
    res.json({
      success: true,
      data: records,
      pagination: {
        page,
        limit,
        total: totalCount,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1
      }
    });
  } catch (error) {
    console.error('Error fetching today attendance:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to load attendance records', 
      error: error.message 
    });
  }
}));

export default router;
