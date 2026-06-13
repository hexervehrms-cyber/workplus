import express from "express";
import mongoose from "mongoose";
import { asyncHandler } from "../middleware/errorHandler.js";
import { authorize } from "../middleware/auth.js";
import User from "../models/User.js";
import Employee from "../models/Employee.js";
import Organization from "../models/Organization.js";
import ActivityLog from "../models/ActivityLog.js";
import Attendance from "../models/Attendance.js";
import LeaveRequest from "../models/LeaveRequest.js";
import Expense from "../models/Expense.js";
import Payslip from "../models/Payroll.js";
import { calculateAllKPIChanges } from "../utils/kpiCalculations.js";
import logger from "../utils/logger.js";

const router = express.Router();

router.use(authorize("super_admin"));

/**
 * GET /api/dashboard/superadmin
 * Get comprehensive super admin dashboard data
 */
router.get("/superadmin", asyncHandler(async (req, res) => {
  // Super admin can see all data across organizations
  
  // Get total organizations
  const totalOrganizations = await Organization.countDocuments({ isActive: true });
  
  // Get total admins across all organizations
  const totalAdmins = await User.countDocuments({ 
    role: { $in: ['admin', 'super_admin'] },
    isActive: true 
  });
  
  // Get total employees across all organizations
  const totalEmployees = await Employee.countDocuments({ status: 'active' });
  
  // Get active users today (logged in within last 24 hours)
  const today = new Date();
  const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000);
  
  const activeUsersToday = await User.countDocuments({
    lastLogin: { $gte: yesterday },
    isActive: true
  });
  
  // Get pending approvals across all organizations
  const pendingApprovals = await LeaveRequest.countDocuments({ status: 'pending' });
  
  // Get current month revenue (sum of all payroll costs)
  const currentMonth = new Date();
  currentMonth.setDate(1);
  currentMonth.setHours(0, 0, 0, 0);
  
  const nextMonth = new Date(currentMonth);
  nextMonth.setMonth(nextMonth.getMonth() + 1);
  
  const monthlyRevenueResult = await Payslip.aggregate([
    {
      $match: {
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
  
  const totalRevenue = monthlyRevenueResult[0]?.total || 0;
  
  // Calculate platform growth metrics
  const lastMonth = new Date(currentMonth);
  lastMonth.setMonth(lastMonth.getMonth() - 1);
  
  const lastMonthOrgs = await Organization.countDocuments({
    isActive: true,
    createdAt: { $lt: currentMonth }
  });
  
  const orgGrowthRate = lastMonthOrgs > 0 ? 
    ((totalOrganizations - lastMonthOrgs) / lastMonthOrgs) * 100 : 0;
  
  // Get live sessions (users active in last 30 minutes)
  const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000);
  const liveSessions = await User.countDocuments({
    lastLogin: { $gte: thirtyMinutesAgo },
    isActive: true
  });
  
  // Calculate churn rate (organizations that became inactive in last month)
  const churnedOrgs = await Organization.countDocuments({
    isActive: false,
    updatedAt: { $gte: lastMonth, $lt: currentMonth }
  });
  
  const churnRate = totalOrganizations > 0 ? 
    (churnedOrgs / (totalOrganizations + churnedOrgs)) * 100 : 0;
  
  // Get total sales (sum of approved expenses across all organizations)
  const totalSalesResult = await Expense.aggregate([
    {
      $match: {
        status: { $in: ['approved', 'paid'] },
        createdAt: { $gte: currentMonth, $lt: nextMonth }
      }
    },
    {
      $group: {
        _id: null,
        total: { $sum: "$amount" }
      }
    }
  ]);
  
  const totalSales = totalSalesResult[0]?.total || 0;
  
  // Calculate pipeline value (sum of pending expenses + pending payroll)
  const pipelineExpensesResult = await Expense.aggregate([
    {
      $match: {
        status: 'pending'
      }
    },
    {
      $group: {
        _id: null,
        total: { $sum: "$amount" }
      }
    }
  ]);
  
  const pendingPayrollResult = await Payslip.aggregate([
    {
      $match: {
        status: 'pending'
      }
    },
    {
      $group: {
        _id: null,
        total: { $sum: "$netSalary" }
      }
    }
  ]);
  
  const pipelineValue = (pipelineExpensesResult[0]?.total || 0) + (pendingPayrollResult[0]?.total || 0);
  
  // Calculate actual commission paid from real commission data
  let commissionPaid = 0;
  try {
    // Try to get commission data from Commission model if it exists
    const Commission = mongoose.model('Commission');
    const commissionResult = await Commission.aggregate([
      {
        $match: {
          status: 'paid',
          paidAt: {
            $gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
            $lt: new Date(new Date().getFullYear(), new Date().getMonth() + 1, 1)
          }
        }
      },
      {
        $group: {
          _id: null,
          total: { $sum: "$amount" }
        }
      }
    ]);
    
    commissionPaid = commissionResult[0]?.total || 0;
  } catch (error) {
    // If Commission model doesn't exist, calculate based on sales data
    logger.warn('Commission model not found, calculating from sales data', { error: error.message });
    
    // Calculate commission as percentage of sales (configurable rate)
    const commissionRate = process.env.DEFAULT_COMMISSION_RATE || 0.03; // 3% default
    commissionPaid = totalSales * commissionRate;
  }
  
  // Calculate real KPI changes
  const kpiChanges = await calculateAllKPIChanges();
  
  res.json({
    success: true,
    data: {
      totalRevenue,
      totalOrganizations,
      totalAdmins,
      totalEmployees,
      activeUsersToday,
      liveSessions,
      pendingApprovals,
      totalSales,
      pipelineValue,
      commissionPaid,
      orgGrowthRate: Math.round(orgGrowthRate * 100) / 100,
      churnRate: Math.round(churnRate * 100) / 100,
      kpiChanges, // Real KPI change percentages
      platformHealth: {
        uptime: process.uptime(),
        activeConnections: liveSessions,
        systemLoad: 'normal' // This would come from system monitoring
      }
    }
  });
}));

/**
 * GET /api/dashboard/superadmin/organizations
 * Get organizations list for super admin
 */
router.get("/superadmin/organizations", asyncHandler(async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;
  const skip = (page - 1) * limit;
  
  const organizations = await Organization.find({ isActive: true })
    .populate('createdBy', 'name email')
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit)
    .lean();
  
  // Get employee count for each organization
  const orgsWithStats = await Promise.all(
    organizations.map(async (org) => {
      const employeeCount = await Employee.countDocuments({ 
        orgId: org._id.toString(), 
        status: 'active' 
      });
      
      const adminCount = await User.countDocuments({
        orgId: org._id.toString(),
        role: { $in: ['admin', 'hr', 'manager'] },
        isActive: true
      });
      
      // Calculate monthly revenue for this org
      const currentMonth = new Date();
      const monthlyRevenue = await Payslip.aggregate([
        {
          $match: {
            orgId: org._id.toString(),
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
      
      return {
        ...org,
        employeeCount,
        adminCount,
        monthlyRevenue: monthlyRevenue[0]?.total || 0,
        status: org.isActive ? 'Active' : 'Inactive',
        plan: org.subscriptionPlan || 'free'
      };
    })
  );
  
  const totalOrgs = await Organization.countDocuments({ isActive: true });
  
  res.json({
    success: true,
    data: {
      organizations: orgsWithStats,
      pagination: {
        page,
        limit,
        total: totalOrgs,
        pages: Math.ceil(totalOrgs / limit)
      }
    }
  });
}));

/**
 * GET /api/dashboard/superadmin/growth-trends
 * Get platform growth trends for charts
 */
router.get("/superadmin/growth-trends", asyncHandler(async (req, res) => {
  const months = parseInt(req.query.months) || 6;
  const startDate = new Date();
  startDate.setMonth(startDate.getMonth() - months);
  
  // Get monthly organization growth
  const orgGrowth = await Organization.aggregate([
    {
      $match: {
        createdAt: { $gte: startDate }
      }
    },
    {
      $group: {
        _id: {
          year: { $year: "$createdAt" },
          month: { $month: "$createdAt" }
        },
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
            in: { $arrayElemAt: ["$monthsInString", "$_id.month"] }
          }
        },
        organizations: "$count"
      }
    }
  ]);
  
  // Get monthly user growth
  const userGrowth = await User.aggregate([
    {
      $match: {
        createdAt: { $gte: startDate },
        isActive: true
      }
    },
    {
      $group: {
        _id: {
          year: { $year: "$createdAt" },
          month: { $month: "$createdAt" }
        },
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
            in: { $arrayElemAt: ["$monthsInString", "$_id.month"] }
          }
        },
        users: "$count"
      }
    }
  ]);
  
  // Get monthly revenue growth
  const revenueGrowth = await Payslip.aggregate([
    {
      $match: {
        createdAt: { $gte: startDate },
        status: { $in: ['generated', 'paid'] }
      }
    },
    {
      $group: {
        _id: {
          year: { $year: "$createdAt" },
          month: { $month: "$createdAt" }
        },
        revenue: { $sum: "$netSalary" }
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
            in: { $arrayElemAt: ["$monthsInString", "$_id.month"] }
          }
        },
        revenue: 1
      }
    }
  ]);
  
  // Combine all growth data
  const combinedData = [];
  const monthsMap = new Map();
  
  // Initialize with all months
  for (let i = months - 1; i >= 0; i--) {
    const date = new Date();
    date.setMonth(date.getMonth() - i);
    const monthName = date.toLocaleDateString('en-US', { month: 'short' });
    monthsMap.set(monthName, {
      month: monthName,
      organizations: 0,
      users: 0,
      revenue: 0
    });
  }
  
  // Fill in actual data
  orgGrowth.forEach(item => {
    if (monthsMap.has(item.month)) {
      monthsMap.get(item.month).organizations = item.organizations;
    }
  });
  
  userGrowth.forEach(item => {
    if (monthsMap.has(item.month)) {
      monthsMap.get(item.month).users = item.users;
    }
  });
  
  revenueGrowth.forEach(item => {
    if (monthsMap.has(item.month)) {
      monthsMap.get(item.month).revenue = item.revenue;
    }
  });
  
  res.json({
    success: true,
    data: Array.from(monthsMap.values())
  });
}));

/**
 * GET /api/superadmin/live-activity
 * Get live platform activity with pagination and filters
 */
router.get("/superadmin/live-activity", asyncHandler(async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;
  const skip = (page - 1) * limit;
  const { search, organizationId, action, dateFrom, dateTo } = req.query;

  // Build query filter
  const filter = {};
  
  if (organizationId) {
    filter.orgId = organizationId;
  }
  
  if (action) {
    filter.action = action;
  }
  
  if (dateFrom || dateTo) {
    filter.createdAt = {};
    if (dateFrom) filter.createdAt.$gte = new Date(dateFrom);
    if (dateTo) {
      const endDate = new Date(dateTo);
      endDate.setHours(23, 59, 59, 999);
      filter.createdAt.$lte = endDate;
    }
  }
  
  if (search) {
    filter.$or = [
      { 'userId': { $regex: search, $options: 'i' } },
      { 'action': { $regex: search, $options: 'i' } },
      { 'entity.entityName': { $regex: search, $options: 'i' } },
      { 'errorMessage': { $regex: search, $options: 'i' } }
    ];
  }

  // Get total count for pagination
  const total = await ActivityLog.countDocuments(filter);
  
  // Fetch activities with pagination
  const activities = await ActivityLog.find(filter)
    .populate('userId', 'name email organization')
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit)
    .lean();

  // Get statistics
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const todayFilter = { ...filter, createdAt: { $gte: today } };
  const actionsToday = await ActivityLog.countDocuments(todayFilter);
  
  const activeUsersResult = await ActivityLog.aggregate([
    { $match: filter },
    { $group: { _id: '$userId', count: { $sum: 1 } } },
    { $group: { _id: null, activeUsers: { $sum: 1 } } }
  ]);
  const activeUsers = activeUsersResult[0]?.activeUsers || 0;
  
  const organizationsResult = await ActivityLog.aggregate([
    { $match: filter },
    { $group: { _id: '$orgId', count: { $sum: 1 } } },
    { $group: { _id: null, organizations: { $sum: 1 } } }
  ]);
  const organizations = organizationsResult[0]?.organizations || 0;
  
  // Calculate growth rate based on previous period
  const lastPeriodStart = new Date(today);
  lastPeriodStart.setDate(lastPeriodStart.getDate() - 1);
  const lastPeriodEnd = new Date(lastPeriodStart);
  lastPeriodEnd.setDate(lastPeriodEnd.getDate() - 1);
  lastPeriodEnd.setHours(0, 0, 0, 0);
  
  const lastPeriodFilter = {
    ...filter,
    createdAt: { $gte: lastPeriodEnd, $lt: lastPeriodStart }
  };
  const lastPeriodCount = await ActivityLog.countDocuments(lastPeriodFilter);
  const growthRate = lastPeriodCount > 0 ? ((actionsToday - lastPeriodCount) / lastPeriodCount) * 100 : 0;

  // Format activities for response
  const formattedActivities = activities.map(activity => ({
    id: activity._id,
    userId: activity.userId?._id,
    userName: activity.userId?.name || 'System',
    userEmail: activity.userId?.email || 'system@platform.local',
    userRole: activity.userId?.role || 'system',
    organizationId: activity.orgId,
    action: activity.action,
    module: activity.entity?.entityType || 'system',
    description: activity.entity?.entityName || activity.details?.description || activity.action,
    ipAddress: activity.ipAddress,
    userAgent: activity.userAgent,
    createdAt: activity.createdAt,
    status: activity.success ? 'success' : 'failed',
    severity: activity.severity
  }));

  res.json({
    success: true,
    data: {
      activities: formattedActivities,
      stats: {
        activeUsers,
        organizations,
        actionsToday,
        growthRate: Math.round(growthRate * 100) / 100
      },
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    }
  });
}));

/**
 * DELETE /api/superadmin/live-activity/:id
 * Delete a single activity log
 */
router.delete("/superadmin/live-activity/:id", authorize("super_admin"), asyncHandler(async (req, res) => {
  const { id } = req.params;
  
  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).json({
      success: false,
      message: "Invalid activity ID"
    });
  }
  
  const activity = await ActivityLog.findByIdAndDelete(id);
  
  if (!activity) {
    return res.status(404).json({
      success: false,
      message: "Activity log not found"
    });
  }
  
  res.json({
    success: true,
    message: "Activity log deleted successfully"
  });
}));

/**
 * POST /api/superadmin/live-activity/bulk-delete
 * Bulk delete activity logs
 */
router.post("/superadmin/live-activity/bulk-delete", authorize("super_admin"), asyncHandler(async (req, res) => {
  const { activityIds } = req.body;
  
  if (!Array.isArray(activityIds) || activityIds.length === 0) {
    return res.status(400).json({
      success: false,
      message: "Activity IDs must be a non-empty array"
    });
  }
  
  // Validate all IDs
  const validIds = activityIds.filter(id => mongoose.Types.ObjectId.isValid(id));
  
  if (validIds.length === 0) {
    return res.status(400).json({
      success: false,
      message: "No valid activity IDs provided"
    });
  }
  
  // Delete activities
  const result = await ActivityLog.deleteMany({
    _id: { $in: validIds }
  });
  
  const skipped = activityIds.length - validIds.length;
  
  res.json({
    success: true,
    data: {
      requested: activityIds.length,
      deleted: result.deletedCount,
      skipped: skipped,
      errors: []
    }
  });
}));

/**
 * GET /api/dashboard/superadmin/live-users
 * Get currently active users across all organizations
 */
router.get("/superadmin/live-users", asyncHandler(async (req, res) => {
  const limit = parseInt(req.query.limit) || 10;
  
  // Users active in last 30 minutes
  const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000);
  
  const liveUsers = await User.find({
    lastLogin: { $gte: thirtyMinutesAgo },
    isActive: true
  })
  .select('name email organization role lastLogin')
  .sort({ lastLogin: -1 })
  .limit(limit)
  .lean();
  
  const formattedUsers = liveUsers.map(user => ({
    name: user.name,
    email: user.email,
    organization: user.organization || 'Unknown',
    role: user.role,
    status: 'Online',
    lastActive: user.lastLogin ? new Date(user.lastLogin).toLocaleTimeString() : 'N/A'
  }));
  
  res.json({
    success: true,
    data: formattedUsers
  });
}));

// Helper functions
function getActivityDescription(activity) {
  const actionMap = {
    'login': `User logged in`,
    'employee_create': `New employee added`,
    'leave_apply': `Leave request submitted`,
    'expense_submit': `Expense submitted`,
    'org_create': `New organization created`,
    'payroll_generate': `Payroll generated`,
    'system_backup': `System backup completed`
  };
  
  return actionMap[activity.action] || `${activity.action} performed`;
}

function getActivityIcon(action) {
  const iconMap = {
    'login': 'user',
    'employee_create': 'user-plus',
    'leave_apply': 'calendar',
    'expense_submit': 'dollar-sign',
    'org_create': 'building',
    'payroll_generate': 'credit-card',
    'system_backup': 'database'
  };
  
  return iconMap[action] || 'activity';
}

/**
 * GET /api/dashboard/superadmin/summary
 * Optimized summary endpoint for super admin dashboard KPI cards
 * Returns only critical data needed for KPI rendering
 * 60 second cache
 */
router.get("/superadmin/summary", asyncHandler(async (req, res) => {
  res.set('Cache-Control', 'public, max-age=60');
  
  const { period = 'this_month' } = req.query;
  
  try {
    // Get total organizations
    const totalOrganizations = await Organization.countDocuments({ isActive: true });
    
    // Get active organizations (with activity in last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const activeOrganizations = await Organization.countDocuments({
      isActive: true,
      updatedAt: { $gte: thirtyDaysAgo }
    });
    
    // Get total admins across all organizations
    const totalAdmins = await User.countDocuments({ 
      role: { $in: ['admin', 'super_admin'] },
      isActive: true 
    });
    
    // Get total employees across all organizations
    const totalEmployees = await Employee.countDocuments({ status: 'active' });
    
    // Get current month revenue (sum of all payroll costs)
    const currentMonth = new Date();
    currentMonth.setDate(1);
    currentMonth.setHours(0, 0, 0, 0);
    
    const nextMonth = new Date(currentMonth);
    nextMonth.setMonth(nextMonth.getMonth() + 1);
    
    const monthlyRevenueResult = await Payslip.aggregate([
      {
        $match: {
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
    
    const monthlyRevenue = monthlyRevenueResult[0]?.total || 0;
    
    // Get live sessions (users active in last 30 minutes)
    const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000);
    const systemActivity = await User.countDocuments({
      lastLogin: { $gte: thirtyMinutesAgo },
      isActive: true
    });
    
    const summary = {
      kpis: {
        totalOrganizations,
        activeOrganizations,
        totalAdmins,
        totalEmployees,
        monthlyRevenue,
        systemActivity
      },
      lastUpdated: new Date().toISOString()
    };
    
    res.json({ success: true, data: summary });
  } catch (error) {
    console.error('Error fetching super-admin summary:', error);
    res.status(500).json({ success: false, message: 'Failed to load dashboard summary' });
  }
}));

export default router;