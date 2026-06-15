/**
 * Build attendance summary for payroll cycle calculation.
 */
import Attendance from '../models/Attendance.js';
import Holiday from '../models/Holiday.js';
import LeaveRequest from '../models/LeaveRequest.js';
import PayrollCycleEngine from './payrollCycleEngine.js';

const UNPAID_LEAVE_TYPES = new Set(['NCNS', 'Personal', 'Emergency']);

function dayStart(d) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function dayEnd(d) {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x;
}

function overlapLeaveDays(leave, rangeStart, rangeEnd) {
  const ls = dayStart(
    new Date(Math.max(new Date(leave.startDate).getTime(), rangeStart.getTime()))
  );
  const le = dayEnd(
    new Date(Math.min(new Date(leave.endDate).getTime(), rangeEnd.getTime()))
  );
  if (le < ls) return 0;
  const days = Math.ceil((le - ls) / 86400000) + 1;
  return leave.isHalfDay ? 0.5 : days;
}

/**
 * @param {{ employeeId: import('mongoose').Types.ObjectId|string, userId?: import('mongoose').Types.ObjectId|string, orgId: string, cycleStartDate: Date|string, cycleEndDate: Date|string }}
 */
export async function buildPayrollAttendanceData({
  employeeId,
  userId,
  orgId,
  cycleStartDate,
  cycleEndDate
}) {
  const start = dayStart(cycleStartDate);
  const end = dayEnd(cycleEndDate);
  const org = String(orgId);

  const holidayRecords = await Holiday.find({
    orgId: org,
    date: { $gte: start, $lte: end },
    type: 'public'
  })
    .select('date')
    .lean();

  const publicHolidays = holidayRecords.map((h) => new Date(h.date));
  const totalWorkingDays = PayrollCycleEngine.calculateWorkingDays(
    start,
    end,
    publicHolidays
  );

  const attendanceOr = [{ employeeId }];
  if (userId) attendanceOr.push({ userId });

  const records = await Attendance.find({
    orgId: org,
    date: { $gte: start, $lte: end },
    $or: attendanceOr
  })
    .select('status isLate')
    .lean();

  let presentDays = 0;
  let absentDays = 0;
  let halfDays = 0;
  let lateMarks = 0;

  for (const r of records) {
    const status = r.status || 'present';
    if (status === 'present') {
      presentDays += 1;
      if (r.isLate) lateMarks += 1;
    } else if (status === 'late') {
      presentDays += 1;
      lateMarks += 1;
    } else if (status === 'absent') {
      absentDays += 1;
    } else if (status === 'half-day') {
      halfDays += 1;
    }
  }

  const leaveOr = [{ employeeId }];
  if (userId) leaveOr.push({ userId });

  const approvedLeaves = await LeaveRequest.find({
    orgId: org,
    status: 'approved',
    startDate: { $lte: end },
    endDate: { $gte: start },
    $or: leaveOr
  })
    .select('type startDate endDate isHalfDay')
    .lean();

  let unpaidLeaveDays = 0;
  let paidLeaveDays = 0;

  for (const leave of approvedLeaves) {
    const days = overlapLeaveDays(leave, start, end);
    if (UNPAID_LEAVE_TYPES.has(leave.type)) {
      unpaidLeaveDays += days;
    } else {
      paidLeaveDays += days;
    }
  }

  if (records.length === 0) {
    presentDays = Math.max(0, totalWorkingDays - unpaidLeaveDays);
    absentDays = 0;
  }

  return {
    totalWorkingDays,
    presentDays,
    absentDays,
    halfDays,
    unpaidLeaveDays: Math.round(unpaidLeaveDays * 100) / 100,
    paidLeaveDays: Math.round(paidLeaveDays * 100) / 100,
    lateMarks,
    holidayDays: publicHolidays.length,
    hasAttendanceRecords: records.length > 0
  };
}
