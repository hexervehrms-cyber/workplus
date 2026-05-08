/**
 * KPI Real-time Updater
 * Calculates and emits real-time KPI updates to admin dashboard
 */

import Employee from '../models/Employee.js';
import Attendance from '../models/Attendance.js';
import LeaveRequest from '../models/LeaveRequest.js';
import Expense from '../models/Expense.js';
import Payslip from '../models/Payroll.js';
import Session from '../models/Session.js';
import logger from './logger.js';

/**
 * Calculate and emit real-time KPI updates
 * @param {Object} io - Socket.IO instance
 * @param {string} orgId - Organization ID
 * @param {string} triggerType - What triggered the update (attendance, leave, expense, etc.)
 * @param {Object} triggerData - Data that triggered the update
 */
export const emitKPIUpdate = async (io, orgId, triggerType, triggerData = {}) => {
  try {
    if (!io || !orgId) return;

    console.log('📊 [KPI-UPDATER] Calculating real-time KPI updates', { orgId, triggerType });

    // Get current date ranges
    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const endOfDay = new Date(startOfDay);
    endOfDay.setDate(endOfDay.getDate() + 1);
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);

    // Calculate KPIs in parallel for better performance
    const [
      totalEmployees,
      presentToday,
      pendingLeaves,
      pendingExpenses,
      activeUsers,
      onLeaveToday,
      onBreakToday,
      thisMonthExpenses,
      thisMonthPayroll,
      avgProductivity
    ] = await Promise.all([
      // Total employees
      Employee.countDocuments({ orgId, status: 'active' }),
      
      // Present today
      Attendance.countDocuments({ 
        orgId, 
        date: { $gte: startOfDay, $lt: endOfDay },
        status: 'present'
      }),
      
      // Pending leaves
      LeaveRequest.countDocuments({ orgId, status: 'pending' }),
      
      // Pending expenses
      Expense.countDocuments({ orgId, status: 'pending' }),
      
      // Active users (checked in today but not checked out)
      Attendance.countDocuments({ 
        orgId, 
        date: { $gte: startOfDay, $lt: endOfDay },
        checkIn: { $exists: true, $ne: null },
        checkOut: { $exists: false }
      }),
      
      // Employees on leave today
      LeaveRequest.aggregate([
        {
          $match: {
            orgId,
            status: 'approved',
            startDate: { $lte: now },
            endDate: { $gte: now }
          }
        },
        {
          $group: {
            _id: '$employeeId',
            count: { $sum: 1 }
          }
        },
        {
          $count: 'total'
        }
      ]),
      
      // Employees on break today
      Attendance.countDocuments({
        orgId,
        date: { $gte: startOfDay, $lt: endOfDay },
        'breaks': {
          $elemMatch: {
            startTime: { $exists: true },
            endTime: { $exists: false }
          }
        }
      }),
      
      // This month expenses
      Expense.aggregate([
        {
          $match: {
            orgId,
            date: { $gte: startOfMonth, $lt: endOfMonth },
            status: { $in: ['approved', 'paid'] }
          }
        },
        {
          $group: {
            _id: null,
            total: { $sum: '$amount' }
          }
        }
      ]),
      
      // This month payroll
      Payslip.aggregate([
        {
          $match: {
            orgId,
            createdAt: { $gte: startOfMonth, $lt: endOfMonth },
            status: { $in: ['draft', 'pending', 'paid'] }
          }
        },
        {
          $group: {
            _id: null,
            total: { $sum: '$netPay' }
          }
        }
      ]),
      
      // Average productivity
      Attendance.aggregate([
        {
          $match: {
            orgId,
            date: { $gte: startOfMonth, $lt: endOfMonth },
            status: 'present'
          }
        },
        {
          $group: {
            _id: null,
            avgHours: { $avg: '$hoursWorked' }
          }
        }
      ])
    ]);

    // Process results
    const attendanceRate = totalEmployees > 0 ? Math.round((presentToday / totalEmployees) * 100) : 0;
    const onLeave = onLeaveToday[0]?.total || 0;
    const monthlyExpenses = thisMonthExpenses[0]?.total || 0;
    const monthlyPayroll = thisMonthPayroll[0]?.total || 0;
    const totalCost = monthlyExpenses + monthlyPayroll;
    const productivity = Math.min(100, Math.round(((avgProductivity[0]?.avgHours || 0) / 8) * 100));

    // Prepare KPI update payload
    const kpiUpdate = {
      timestamp: new Date(),
      triggerType,
      triggerData,
      kpis: {
        // Employee metrics
        totalEmployees,
        presentToday,
        attendanceRate,
        activeUsers,
        onLeave,
        onBreak: onBreakToday,
        
        // Leave metrics
        pendingLeaves,
        
        // Financial metrics
        pendingExpenses,
        thisMonthExpenses: monthlyExpenses,
        thisMonthPayroll: monthlyPayroll,
        totalCost,
        
        // Performance metrics
        avgProductivity: productivity
      }
    };

    // Emit to admin dashboard - emit to multiple room patterns to ensure delivery
    const rooms = [
      `tenant_${orgId}`,
      `role_admin_${orgId}`,
      `role_admin`,
      'management'
    ];
    
    rooms.forEach(room => {
      io.to(room).emit('kpi:update', kpiUpdate);
      console.log(`📊 [KPI-UPDATER] Emitted kpi:update to room: ${room}`);
    });

    console.log('📊 [KPI-UPDATER] KPI update emitted successfully', { 
      orgId, 
      triggerType, 
      kpiCount: Object.keys(kpiUpdate.kpis).length,
      onBreak: kpiUpdate.kpis.onBreak,
      activeUsers: kpiUpdate.kpis.activeUsers,
      rooms: rooms
    });

    return kpiUpdate;

  } catch (error) {
    logger.error('Error calculating/emitting KPI updates', { 
      error: error.message, 
      orgId,
      triggerType 
    });
  }
};

/**
 * Emit specific KPI update for attendance changes
 */
export const emitAttendanceKPIUpdate = async (io, orgId, attendanceData) => {
  return emitKPIUpdate(io, orgId, 'attendance', {
    action: attendanceData.action || 'update',
    employeeId: attendanceData.employeeId,
    status: attendanceData.status
  });
};

/**
 * Emit specific KPI update for leave changes
 */
export const emitLeaveKPIUpdate = async (io, orgId, leaveData) => {
  return emitKPIUpdate(io, orgId, 'leave', {
    action: leaveData.action || 'update',
    leaveId: leaveData._id,
    status: leaveData.status,
    employeeId: leaveData.employeeId
  });
};

/**
 * Emit specific KPI update for expense changes
 */
export const emitExpenseKPIUpdate = async (io, orgId, expenseData) => {
  return emitKPIUpdate(io, orgId, 'expense', {
    action: expenseData.action || 'update',
    expenseId: expenseData._id,
    amount: expenseData.amount,
    status: expenseData.status
  });
};

/**
 * Emit specific KPI update for employee changes
 */
export const emitEmployeeKPIUpdate = async (io, orgId, employeeData) => {
  return emitKPIUpdate(io, orgId, 'employee', {
    action: employeeData.action || 'update',
    employeeId: employeeData._id,
    status: employeeData.status
  });
};

export default {
  emitKPIUpdate,
  emitAttendanceKPIUpdate,
  emitLeaveKPIUpdate,
  emitExpenseKPIUpdate,
  emitEmployeeKPIUpdate
};