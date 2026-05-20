/**
 * Employee performance metrics from attendance, leave, and org ranking (real data).
 */

import express from 'express';
import mongoose from 'mongoose';
import { asyncHandler } from '../middleware/errorHandler.js';
import { authenticate } from '../middleware/auth.js';
import Attendance from '../models/Attendance.js';
import LeaveRequest from '../models/LeaveRequest.js';
import Employee from '../models/Employee.js';
import User from '../models/User.js';
import { buildOrgIdFlexible } from '../utils/attendanceQueryHelpers.js';
import { sendSuccess, sendError } from '../utils/apiResponse.js';

const router = express.Router();

function monthKey(d) {
  return d.toLocaleDateString('en-US', { month: 'short' });
}

function scoreAttendanceRow(row) {
  if (!row?.checkIn) return 0;
  let score = 70;
  if (row.status === 'present') score += 15;
  if (row.isLate) score -= Math.min(15, (row.lateMinutes || 0) / 2);
  const hours = row.hoursWorked || row.actualWorkingHours || 0;
  if (hours >= 7) score += 10;
  else if (hours >= 5) score += 5;
  return Math.max(0, Math.min(100, Math.round(score)));
}

router.get(
  '/:userId',
  authenticate,
  asyncHandler(async (req, res) => {
    const { userId } = req.params;
    const requestUserId = String(req.user.userId);
    const isPrivileged = ['admin', 'hr', 'super_admin', 'manager'].includes(req.user.role);
    if (userId !== requestUserId && !isPrivileged) {
      return sendError(res, 'Unauthorized', 403, 'FORBIDDEN');
    }

    const orgMatch = buildOrgIdFlexible(req.user.orgId);
    const employee = await Employee.findOne({
      ...orgMatch,
      userId: mongoose.Types.ObjectId.isValid(userId)
        ? { $in: [userId, new mongoose.Types.ObjectId(userId)] }
        : userId,
    }).lean();

    if (!employee) {
      return sendError(res, 'Employee record not found', 404, 'NOT_FOUND');
    }

    const employeeId = employee._id;
    const now = new Date();
    const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1);

    const [attendanceRows, leaveRows, orgEmployees, orgAttendance] = await Promise.all([
      Attendance.find({
        employeeId,
        date: { $gte: sixMonthsAgo },
      })
        .select('date status checkIn checkOut hoursWorked actualWorkingHours isLate lateMinutes')
        .sort({ date: 1 })
        .lean(),
      LeaveRequest.find({
        employeeId,
        status: 'approved',
        startDate: { $gte: sixMonthsAgo },
      })
        .select('startDate endDate type')
        .lean(),
      Employee.find({ ...orgMatch, status: 'active' }).select('_id userId firstName lastName').lean(),
      Attendance.find({
        ...orgMatch,
        date: { $gte: sixMonthsAgo },
        checkIn: { $exists: true, $ne: null },
      })
        .select('employeeId date status checkIn hoursWorked actualWorkingHours isLate lateMinutes')
        .lean(),
    ]);

    const trendMap = new Map();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      trendMap.set(`${d.getFullYear()}-${d.getMonth()}`, { month: monthKey(d), score: 0, count: 0 });
    }

    let presentDays = 0;
    let lateDays = 0;
    let totalHours = 0;
    for (const row of attendanceRows) {
      const d = new Date(row.date);
      const key = `${d.getFullYear()}-${d.getMonth()}`;
      const s = scoreAttendanceRow(row);
      if (trendMap.has(key)) {
        const t = trendMap.get(key);
        t.score += s;
        t.count += 1;
      }
      if (row.checkIn) {
        presentDays += 1;
        totalHours += row.hoursWorked || row.actualWorkingHours || 0;
        if (row.isLate) lateDays += 1;
      }
    }

    const performanceTrend = [...trendMap.values()].map((t) => ({
      month: t.month,
      score: t.count ? Math.round(t.score / t.count) : 0,
    }));

    const workingDays = attendanceRows.filter((r) => r.checkIn).length || 1;
    const attendanceRate = Math.round((presentDays / workingDays) * 100);
    const punctualityRate = presentDays
      ? Math.round(((presentDays - lateDays) / presentDays) * 100)
      : 100;
    const avgHours = presentDays ? Math.round((totalHours / presentDays) * 10) / 10 : 0;
    const productivityScore = Math.min(
      100,
      Math.round((avgHours / 8) * 100)
    );

    const overallScore =
      performanceTrend.length > 0
        ? Math.round(
            performanceTrend.reduce((sum, p) => sum + p.score, 0) / performanceTrend.length
          )
        : 0;

    const kpis = [
      {
        name: 'Attendance Rate',
        value: attendanceRate,
        target: 95,
        status: attendanceRate >= 95 ? 'good' : 'warning',
      },
      {
        name: 'Punctuality',
        value: punctualityRate,
        target: 90,
        status: punctualityRate >= 90 ? 'good' : 'warning',
      },
      {
        name: 'Avg Hours / Day',
        value: Math.min(100, productivityScore),
        target: 85,
        status: productivityScore >= 85 ? 'good' : 'warning',
      },
      {
        name: 'Leave Usage',
        value: Math.min(100, leaveRows.length * 10),
        target: 50,
        status: 'good',
      },
    ];

    const skills = [
      { skill: 'Attendance', score: attendanceRate },
      { skill: 'Punctuality', score: punctualityRate },
      { skill: 'Productivity', score: productivityScore },
      { skill: 'Consistency', score: overallScore },
      { skill: 'Reliability', score: Math.max(0, 100 - lateDays * 5) },
      { skill: 'Engagement', score: Math.min(100, Math.round(presentDays * 3)) },
    ];

    const achievements = [];
    if (attendanceRate >= 98) {
      achievements.push({
        title: 'Excellent Attendance',
        description: `${attendanceRate}% attendance in the last 6 months`,
        date: monthKey(now),
        color: 'text-secondary',
      });
    }
    if (punctualityRate >= 95) {
      achievements.push({
        title: 'On Time',
        description: `${punctualityRate}% punctuality`,
        date: monthKey(now),
        color: 'text-primary',
      });
    }
    if (overallScore >= 90) {
      achievements.push({
        title: 'High Performer',
        description: `Overall score ${overallScore}/100`,
        date: monthKey(now),
        color: 'text-accent',
      });
    }

    const scoresByEmployee = new Map();
    for (const row of orgAttendance) {
      const eid = String(row.employeeId);
      if (!scoresByEmployee.has(eid)) scoresByEmployee.set(eid, { sum: 0, count: 0 });
      const bucket = scoresByEmployee.get(eid);
      bucket.sum += scoreAttendanceRow(row);
      bucket.count += 1;
    }

    const userIds = orgEmployees.map((e) => String(e.userId));
    const users = await User.find({ _id: { $in: userIds } }).select('name').lean();
    const nameByUserId = new Map(users.map((u) => [String(u._id), u.name || 'Employee']));

    const ranking = orgEmployees
      .map((emp) => {
        const bucket = scoresByEmployee.get(String(emp._id)) || { sum: 0, count: 0 };
        const score = bucket.count ? Math.round(bucket.sum / bucket.count) : 0;
        const name =
          `${emp.firstName || ''} ${emp.lastName || ''}`.trim() ||
          nameByUserId.get(String(emp.userId)) ||
          'Employee';
        const initials = name
          .split(' ')
          .map((n) => n[0])
          .join('')
          .slice(0, 2)
          .toUpperCase();
        return {
          employeeId: String(emp._id),
          userId: String(emp.userId),
          name,
          score,
          avatar: initials || 'EM',
          isYou: String(emp.userId) === String(userId),
        };
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, 10)
      .map((m, i) => ({ rank: i + 1, ...m }));

    const prevMonth = performanceTrend.length >= 2
      ? performanceTrend[performanceTrend.length - 2].score
      : overallScore;
    const delta = overallScore - prevMonth;

    return sendSuccess(
      res,
      {
        performanceTrend,
        skills,
        kpis,
        achievements,
        teamRanking: ranking,
        overallScore,
        scoreDelta: delta,
        lastUpdated: new Date().toISOString(),
        source: 'attendance',
      },
      'Performance data loaded'
    );
  })
);

export default router;
