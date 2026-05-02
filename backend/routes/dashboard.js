import express from "express";
import mongoose from "mongoose";
import { asyncHandler } from "../middleware/errorHandler.js";
import Employee from "../models/Employee.js";
import Attendance from "../models/Attendance.js";
import LeaveRequest from "../models/LeaveRequest.js";
import Expense from "../models/Expense.js";
import User from "../models/User.js";
import Payslip from "../models/Payroll.js";
import Organization from "../models/Organization.js";
import ActivityLog from "../models/ActivityLog.js";

// Import specialized dashboard routes
import superAdminRoutes from "./dashboard-superadmin.js";
import employeeRoutes from "./dashboard-employee.js";

const router = express.Router();

// Mount specialized dashboard routes
router.use(superAdminRoutes);
router.use(employeeRoutes);

/**
 * GET /api/dashboard/stats
 * Get dashboard statistics
 */
router.get("/stats", asyncHandler(async (req, res) => {
  const orgId = req.user?.orgId || 'system';
  
  // Get total employees
  const totalEmployees = await Employee.countDocuments({ 
    orgId, 
    status: 'active' 
  });
  
  // Get current month expenses
  const currentMonth = new Date();
  currentMonth.setDate(1);
  currentMonth.setHours(0, 0, 0, 0);
  
  const nextMonth = new Date(currentMonth);
  nextMonth.setMonth(nextMonth.getMonth() + 1);
  
  const monthlyExpensesResult = await Expense.aggregate([
    {
      $match: {
        orgId,
        createdAt: { $gte: currentMonth, $lt: nextMonth },
        status: { $in: ['approved', 'paid'] }
      }
    },
    {
      $group: {
        _id: null,
        total: { $sum: "$amount" }
      }
    }
  ]);
  
  const monthlyExpenses = monthlyExpensesResult[0]?.total || 0;
  
  // Get current month payroll cost
  const payrollCostResult = await Payslip.aggregate([
    {
      $match: {
        orgId,
        month: currentMonth.getMonth() + 1,
        year: currentMonth.getFullYear(),
        status: { $in: ['generated', 'paid'] }
      }
    },
    {
      $group: {
        _id: null,
        total: { $sum: "$netSalary" }
      }
    }
  ]);
  
  const payrollCost = payrollCostResult[0]?.total || 0;
  
  // Calculate average productivity (based on attendance)
  const today = new Date();
  const lastWeek = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
  
  const attendanceStats = await Attendance.aggregate([
    {
      $match: {
        orgId,
        date: { $gte: lastWeek, $lte: today },
        status: 'present'
      }
    },
    {
      $group: {
        _id: null,
        avgHours: { $avg: "$hoursWorked" },
        totalRecords: { $sum: 1 }
      }
    }
  ]);
  
  const avgHours = attendanceStats[0]?.avgHours || 0;
  const avgProductivity = Math.min(100, Math.round((avgHours / 8) * 100));
  
  res.json({
    success: true,
    data: {
      totalEmployees,
      avgProductivity,
      monthlyExpenses,
      payrollCost
    }
  });
}));

/**
 * GET /api/dashboard/expense-trends
 * Get expense trends for charts
 */
router.get("/expense-trends", asyncHandler(async (req, res) => {
  const orgId = req.user?.orgId || 'system';
  
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
        month: {
          $let: {
            vars: {
              monthsInString: [
                "", "Jan", "Feb", "Mar", "Apr", "May", "Jun",
                "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"
              ]
            },
            in: { $arrayElemAt: ["$$monthsInString", "$_id.month"] }
          }
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
 */
router.get("/recent-leave-requests", asyncHandler(async (req, res) => {
  const orgId = req.user?.orgId || 'system';
  const limit = parseInt(req.query.limit) || 10;
  
  const leaveRequests = await LeaveRequest.find({
    orgId,
    status: 'pending'
  })
  .populate('employeeId', 'userId designation department')
  .populate({
    path: 'employeeId',
    populate: {
      path: 'userId',
      select: 'name email avatar'
    }
  })
  .sort({ createdAt: -1 })
  .limit(limit)
  .lean();
  
  // Format the data for frontend
  const formattedRequests = leaveRequests.map(request => ({
    _id: request._id,
    employeeName: request.employeeId?.userId?.name || 'Unknown',
    employeeEmail: request.employeeId?.userId?.email,
    department: request.employeeId?.department || 'N/A',
    type: request.type,
    startDate: request.startDate,
    endDate: request.endDate,
    reason: request.reason,
    status: request.status,
    createdAt: request.createdAt
  }));
  
  res.json({
    success: true,
    data: formattedRequests
  });
}));

/**
 * GET /api/dashboard/todays-attendance
 * Get today's attendance summary
 */
router.get("/todays-attendance", asyncHandler(async (req, res) => {
  const orgId = req.user?.orgId || 'system';
  
  // Get today's date range
  const today = new Date();
  const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const endOfDay = new Date(startOfDay.getTime() + 24 * 60 * 60 * 1000);
  
  const todaysAttendance = await Attendance.find({
    orgId,
    date: { $gte: startOfDay, $lt: endOfDay }
  })
  .populate('employeeId', 'userId designation department')
  .populate({
    path: 'employeeId',
    populate: {
      path: 'userId',
      select: 'name email avatar'
    }
  })
  .sort({ checkIn: -1 })
  .lean();
  
  // Format the data for frontend
  const formattedAttendance = todaysAttendance.map(attendance => ({
    _id: attendance._id,
    employeeName: attendance.employeeId?.userId?.name || 'Unknown',
    employeeEmail: attendance.employeeId?.userId?.email,
    department: attendance.employeeId?.department || 'N/A',
    checkIn: attendance.checkIn,
    checkOut: attendance.checkOut,
    hoursWorked: attendance.hoursWorked || 0,
    status: attendance.status,
    date: attendance.date
  }));
  
  res.json({
    success: true,
    data: formattedAttendance
  });
}));

/**
 * GET /api/dashboard/department-stats
 * Get department-wise statistics
 */
router.get("/department-stats", asyncHandler(async (req, res) => {
  const orgId = req.user?.orgId || 'system';
  
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
  const orgId = req.user?.orgId || 'system';
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
 */
router.get("/quick-stats", asyncHandler(async (req, res) => {
  const orgId = req.user?.orgId || 'system';
  
  const today = new Date();
  const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  
  // Parallel queries for better performance
  const [
    totalEmployees,
    presentToday,
    pendingLeaves,
    pendingExpenses,
    activeUsers
  ] = await Promise.all([
    Employee.countDocuments({ orgId, status: 'active' }),
    Attendance.countDocuments({ 
      orgId, 
      date: { $gte: startOfDay },
      status: 'present'
    }),
    LeaveRequest.countDocuments({ orgId, status: 'pending' }),
    Expense.countDocuments({ orgId, status: 'pending' }),
    User.countDocuments({ 
      orgId, 
      isActive: true,
      lastLogin: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) }
    })
  ]);
  
  const attendanceRate = totalEmployees > 0 ? Math.round((presentToday / totalEmployees) * 100) : 0;
  
  res.json({
    success: true,
    data: {
      totalEmployees,
      presentToday,
      attendanceRate,
      pendingLeaves,
      pendingExpenses,
      activeUsers
    }
  });
}));

/**
 * GET /api/dashboard/weekly-productivity
 * Get weekly productivity data for admin dashboard
 */
router.get("/weekly-productivity", asyncHandler(async (req, res) => {
  const orgId = req.user?.orgId || 'system';
  
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

export default router;