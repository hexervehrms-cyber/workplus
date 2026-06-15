import User from "../models/User.js";
import Organization from "../models/Organization.js";
import Expense from "../models/Expense.js";
import Payslip from "../models/Payroll.js";
import Deal from "../models/Deal.js";

/**
 * Calculate real KPI change percentages based on historical data
 */

export const calculateRevenueChange = async () => {
  try {
    const currentMonth = new Date();
    currentMonth.setDate(1);
    currentMonth.setHours(0, 0, 0, 0);
    
    const lastMonth = new Date(currentMonth);
    lastMonth.setMonth(lastMonth.getMonth() - 1);
    
    const twoMonthsAgo = new Date(lastMonth);
    twoMonthsAgo.setMonth(twoMonthsAgo.getMonth() - 1);
    
    // Get current month revenue
    const currentRevenue = await Payslip.aggregate([
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
    
    // Get last month revenue
    const lastMonthRevenue = await Payslip.aggregate([
      {
        $match: {
          month: lastMonth.getMonth() + 1,
          year: lastMonth.getFullYear(),
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
    
    const current = currentRevenue[0]?.total || 0;
    const previous = lastMonthRevenue[0]?.total || 0;
    
    if (previous === 0) return 0;
    
    return ((current - previous) / previous) * 100;
  } catch (error) {
    console.error('Error calculating revenue change:', error);
    return 0;
  }
};

export const calculateOrganizationChange = async () => {
  try {
    const currentMonth = new Date();
    currentMonth.setDate(1);
    currentMonth.setHours(0, 0, 0, 0);
    
    const lastMonth = new Date(currentMonth);
    lastMonth.setMonth(lastMonth.getMonth() - 1);
    
    // Get current month org count
    const currentCount = await Organization.countDocuments({
      isActive: true,
      createdAt: { $lt: new Date() }
    });
    
    // Get last month org count
    const lastMonthCount = await Organization.countDocuments({
      isActive: true,
      createdAt: { $lt: currentMonth }
    });
    
    if (lastMonthCount === 0) return 0;
    
    return ((currentCount - lastMonthCount) / lastMonthCount) * 100;
  } catch (error) {
    console.error('Error calculating organization change:', error);
    return 0;
  }
};

export const calculateUserChange = async () => {
  try {
    const currentMonth = new Date();
    currentMonth.setDate(1);
    currentMonth.setHours(0, 0, 0, 0);
    
    const lastMonth = new Date(currentMonth);
    lastMonth.setMonth(lastMonth.getMonth() - 1);
    
    // Get current active users
    const currentCount = await User.countDocuments({
      isActive: true,
      createdAt: { $lt: new Date() }
    });
    
    // Get last month active users
    const lastMonthCount = await User.countDocuments({
      isActive: true,
      createdAt: { $lt: currentMonth }
    });
    
    if (lastMonthCount === 0) return 0;
    
    return ((currentCount - lastMonthCount) / lastMonthCount) * 100;
  } catch (error) {
    console.error('Error calculating user change:', error);
    return 0;
  }
};

export const calculateSessionChange = async () => {
  try {
    const now = new Date();
    const thirtyMinutesAgo = new Date(now.getTime() - 30 * 60 * 1000);
    const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const twoDaysAgo = new Date(now.getTime() - 48 * 60 * 60 * 1000);
    
    // Get current live sessions
    const currentSessions = await User.countDocuments({
      lastLogin: { $gte: thirtyMinutesAgo },
      isActive: true
    });
    
    // Get yesterday's sessions at same time
    const yesterdaySessions = await User.countDocuments({
      lastLogin: { $gte: twoDaysAgo, $lt: yesterday },
      isActive: true
    });
    
    if (yesterdaySessions === 0) return 0;
    
    return ((currentSessions - yesterdaySessions) / yesterdaySessions) * 100;
  } catch (error) {
    console.error('Error calculating session change:', error);
    return 0;
  }
};

export const calculateExpenseChange = async () => {
  try {
    const currentMonth = new Date();
    currentMonth.setDate(1);
    currentMonth.setHours(0, 0, 0, 0);
    
    const lastMonth = new Date(currentMonth);
    lastMonth.setMonth(lastMonth.getMonth() - 1);
    
    const twoMonthsAgo = new Date(lastMonth);
    twoMonthsAgo.setMonth(twoMonthsAgo.getMonth() - 1);
    
    // Get current month expenses
    const currentExpenses = await Expense.aggregate([
      {
        $match: {
          status: { $in: ['approved', 'paid'] },
          createdAt: { $gte: currentMonth }
        }
      },
      {
        $group: {
          _id: null,
          total: { $sum: "$amount" }
        }
      }
    ]);
    
    // Get last month expenses
    const lastMonthExpenses = await Expense.aggregate([
      {
        $match: {
          status: { $in: ['approved', 'paid'] },
          createdAt: { $gte: lastMonth, $lt: currentMonth }
        }
      },
      {
        $group: {
          _id: null,
          total: { $sum: "$amount" }
        }
      }
    ]);
    
    const current = currentExpenses[0]?.total || 0;
    const previous = lastMonthExpenses[0]?.total || 0;
    
    if (previous === 0) return 0;
    
    return ((current - previous) / previous) * 100;
  } catch (error) {
    console.error('Error calculating expense change:', error);
    return 0;
  }
};

/** Month-over-month % change in new open-pipeline deal value (Proposal + Negotiation). */
export const calculatePipelineChange = async () => {
  try {
    const openStages = { stage: { $in: ["Proposal", "Negotiation"] } };
    const start = new Date();
    start.setDate(1);
    start.setHours(0, 0, 0, 0);
    const prev = new Date(start);
    prev.setMonth(prev.getMonth() - 1);

    const [curAgg, prevAgg] = await Promise.all([
      Deal.aggregate([
        { $match: { ...openStages, createdAt: { $gte: start } } },
        { $group: { _id: null, total: { $sum: "$value" } } },
      ]),
      Deal.aggregate([
        { $match: { ...openStages, createdAt: { $gte: prev, $lt: start } } },
        { $group: { _id: null, total: { $sum: "$value" } } },
      ]),
    ]);
    const cur = curAgg[0]?.total || 0;
    const pre = prevAgg[0]?.total || 0;
    if (pre === 0) return cur > 0 ? 100 : 0;
    return ((cur - pre) / pre) * 100;
  } catch (error) {
    console.error("Error calculating pipeline change:", error);
    return 0;
  }
};

/** Month-over-month % change in organizations marked inactive (deactivation events). */
export const calculateChurnChange = async () => {
  try {
    const start = new Date();
    start.setDate(1);
    start.setHours(0, 0, 0, 0);
    const prev = new Date(start);
    prev.setMonth(prev.getMonth() - 1);

    const [lostThis, lostLast] = await Promise.all([
      Organization.countDocuments({ isActive: false, updatedAt: { $gte: start } }),
      Organization.countDocuments({
        isActive: false,
        updatedAt: { $gte: prev, $lt: start },
      }),
    ]);
    if (lostLast === 0) return lostThis > 0 ? 100 : 0;
    return ((lostThis - lostLast) / lostLast) * 100;
  } catch (error) {
    console.error("Error calculating churn change:", error);
    return 0;
  }
};

export const calculateAllKPIChanges = async () => {
  try {
    const [
      revenueChange,
      organizationChange,
      userChange,
      sessionChange,
      expenseChange,
      pipelineChange,
      churnChange,
    ] = await Promise.all([
      calculateRevenueChange(),
      calculateOrganizationChange(),
      calculateUserChange(),
      calculateSessionChange(),
      calculateExpenseChange(),
      calculatePipelineChange(),
      calculateChurnChange(),
    ]);

    return {
      revenueChange: Math.round(revenueChange * 100) / 100,
      organizationChange: Math.round(organizationChange * 100) / 100,
      userChange: Math.round(userChange * 100) / 100,
      sessionChange: Math.round(sessionChange * 100) / 100,
      expenseChange: Math.round(expenseChange * 100) / 100,
      pipelineChange: Math.round(pipelineChange * 100) / 100,
      churnChange: Math.round(churnChange * 100) / 100,
    };
  } catch (error) {
    console.error('Error calculating KPI changes:', error);
    return {
      revenueChange: 0,
      organizationChange: 0,
      userChange: 0,
      sessionChange: 0,
      expenseChange: 0,
      pipelineChange: 0,
      churnChange: 0,
    };
  }
};