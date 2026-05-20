/**
 * Pure attendance query / status helpers (unit-tested).
 * Used by routes/attendance.js to tolerate JWT orgId vs Employee.orgId mismatch.
 */

import mongoose from 'mongoose';

/** Match attendance rows when JWT orgId and Employee.orgId differ. */
export function buildOrgIdClause(effectiveOrgId, authOrgId) {
  const orgIds = [...new Set([String(effectiveOrgId), String(authOrgId)].filter(Boolean))];
  return orgIds.length > 1 ? { orgId: { $in: orgIds } } : { orgId: orgIds[0] };
}

/** Match orgId stored as string or ObjectId (dashboard / activity logs). */
export function buildOrgIdFlexible(orgId) {
  const s = String(orgId || '');
  if (!s) return { orgId: s };
  const variants = [s];
  if (mongoose.Types.ObjectId.isValid(s)) {
    variants.push(new mongoose.Types.ObjectId(s));
  }
  return variants.length > 1 ? { orgId: { $in: variants } } : { orgId: s };
}

export function isOpenBreak(b) {
  return Boolean(
    b?.startTime &&
      (b.endTime == null || b.endTime === undefined || b.endTime === '')
  );
}

/** Monday 00:00 – next Monday 00:00 (calendar week, resets weekly). */
export function getCalendarWeekRange(now = new Date()) {
  const weekStart = new Date(now);
  const dow = weekStart.getDay();
  const toMonday = dow === 0 ? -6 : 1 - dow;
  weekStart.setDate(weekStart.getDate() + toMonday);
  weekStart.setHours(0, 0, 0, 0);
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 7);
  return { weekStart, weekEnd };
}

/** Stable id for the current Mon–Sun week (for client cache). */
export function calendarWeekKey(now = new Date()) {
  const { weekStart } = getCalendarWeekRange(now);
  const y = weekStart.getFullYear();
  const m = String(weekStart.getMonth() + 1).padStart(2, '0');
  const d = String(weekStart.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function buildUserIdClause(userId) {
  const s = String(userId);
  if (mongoose.Types.ObjectId.isValid(s)) {
    return { userId: { $in: [s, new mongoose.Types.ObjectId(s)] } };
  }
  return { userId: s };
}

/** Today's attendance lookup — tolerates orgId string drift between JWT and Employee row. */
/** Active shift today: checked in and not yet checked out (supports multiple sessions per day). */
export const OPEN_ATTENDANCE_SESSION_FILTER = {
  checkIn: { $exists: true, $ne: null },
  $or: [{ checkOut: { $exists: false } }, { checkOut: null }],
};

export function withOpenSessionFilter(query) {
  return { ...query, ...OPEN_ATTENDANCE_SESSION_FILTER };
}

export function buildTodayAttendanceQuery(
  authRole,
  currentUserId,
  effectiveEmployeeId,
  effectiveOrgId,
  authOrgId,
  now = new Date()
) {
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const base = {
    ...buildOrgIdClause(effectiveOrgId, authOrgId),
    date: { $gte: today, $lt: tomorrow },
  };

  if (authRole === 'employee') {
    return { ...base, ...buildUserIdClause(currentUserId) };
  }
  return { ...base, employeeId: effectiveEmployeeId };
}

export function buildLiveStatus(attendance) {
  let liveStatus = 'not_checked_in';
  let currentHours = 0;
  let isOnBreak = false;
  let currentBreakDuration = 0;
  let totalBreakTime = 0;
  let breakType = 'regular';
  let breakStartTime = null;

  if (!attendance || !attendance.checkIn) {
    return {
      status: liveStatus,
      currentHours,
      isOnBreak,
      currentBreakDuration,
      breakType,
      breakStartTime,
      totalBreakTime,
      lastUpdated: new Date(),
    };
  }

  const now = new Date();
  if (attendance.checkOut) {
    liveStatus = 'checked_out';
    currentHours =
      (new Date(attendance.checkOut) - new Date(attendance.checkIn)) / (1000 * 60 * 60);
  } else {
    liveStatus = 'checked_in';
    let grossHours = (now - new Date(attendance.checkIn)) / (1000 * 60 * 60);
    const breakH = breakHoursInRow(attendance, now);
    currentHours = Math.max(0, grossHours - breakH);

    if (attendance.breaks?.length) {
      const lastBreak = attendance.breaks[attendance.breaks.length - 1];
      if (isOpenBreak(lastBreak)) {
        isOnBreak = true;
        currentBreakDuration = (now - new Date(lastBreak.startTime)) / (1000 * 60);
        liveStatus = 'on_break';
        breakType = lastBreak.breakType || 'regular';
        breakStartTime = lastBreak.startTime;
      }
    }
  }

  if (attendance.breaks?.length) {
    totalBreakTime = attendance.breaks.reduce((sum, item) => {
      if (item?.startTime && item?.endTime) {
        return sum + (new Date(item.endTime) - new Date(item.startTime)) / (1000 * 60);
      }
      return sum;
    }, 0);
  }

  return {
    status: liveStatus,
    currentHours: Math.round(currentHours * 100) / 100,
    isOnBreak,
    currentBreakDuration: Math.round(currentBreakDuration),
    breakType,
    breakStartTime,
    totalBreakTime: Math.round(totalBreakTime),
    lastUpdated: new Date(),
  };
}

function breakHoursInRow(r, now = new Date()) {
  let breakH = 0;
  if (!Array.isArray(r?.breaks)) return 0;
  for (const b of r.breaks) {
    if (!b?.startTime) continue;
    if (b.endTime) {
      breakH += (new Date(b.endTime) - new Date(b.startTime)) / (1000 * 60 * 60);
    } else if (isOpenBreak(b)) {
      breakH += (now - new Date(b.startTime)) / (1000 * 60 * 60);
    }
  }
  return breakH;
}

/** Hours credited for one row (completed vs open shift), breaks excluded. */
export function recordWorkedHoursForRow(r, now = new Date()) {
  if (!r?.checkIn) return 0;
  if (r.checkOut) {
    let h = typeof r.hoursWorked === 'number' && !Number.isNaN(r.hoursWorked) ? r.hoursWorked : 0;
    if (h > 0) return h;
    let calc = (new Date(r.checkOut) - new Date(r.checkIn)) / (1000 * 60 * 60);
    calc -= breakHoursInRow(r, new Date(r.checkOut));
    return Math.max(0, Math.round(calc * 100) / 100);
  }
  let calc = (now - new Date(r.checkIn)) / (1000 * 60 * 60);
  calc -= breakHoursInRow(r, now);
  return Math.max(0, Math.round(calc * 100) / 100);
}

/** Sum worked hours for attendance rows in the current calendar week. */
export function sumHoursFromAttendanceRows(rows, now = new Date()) {
  let sum = 0;
  for (const r of rows || []) {
    sum += recordWorkedHoursForRow(r, now);
  }
  return Math.round(sum * 100) / 100;
}

/** Count employees whose latest break today is still open (matches on-break API). */
export async function countEmployeesCurrentlyOnBreak(Attendance, orgMatch, startOfDay, endOfDay) {
  const records = await Attendance.find({
    ...orgMatch,
    date: { $gte: startOfDay, $lt: endOfDay },
    checkIn: { $exists: true, $ne: null },
    $or: [{ checkOut: { $exists: false } }, { checkOut: null }],
    'breaks.0': { $exists: true },
  })
    .select('breaks')
    .lean();

  return records.filter((record) => {
    if (!record.breaks?.length) return false;
    const lastBreak = record.breaks[record.breaks.length - 1];
    return isOpenBreak(lastBreak);
  }).length;
}
