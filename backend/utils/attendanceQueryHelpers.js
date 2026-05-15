/**
 * Pure attendance query / status helpers (unit-tested).
 * Used by routes/attendance.js to tolerate JWT orgId vs Employee.orgId mismatch.
 */

/** Match attendance rows when JWT orgId and Employee.orgId differ. */
export function buildOrgIdClause(effectiveOrgId, authOrgId) {
  const orgIds = [...new Set([String(effectiveOrgId), String(authOrgId)].filter(Boolean))];
  return orgIds.length > 1 ? { orgId: { $in: orgIds } } : { orgId: orgIds[0] };
}

export function isOpenBreak(b) {
  return Boolean(
    b?.startTime &&
      (b.endTime == null || b.endTime === undefined || b.endTime === '')
  );
}

/** Today's attendance lookup — tolerates orgId string drift between JWT and Employee row. */
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
    return { ...base, userId: currentUserId };
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
    currentHours = (now - new Date(attendance.checkIn)) / (1000 * 60 * 60);

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

/** Hours credited for one row (completed vs open shift). */
export function recordWorkedHoursForRow(r) {
  if (!r?.checkIn) return 0;
  if (r.checkOut) {
    let h = typeof r.hoursWorked === 'number' && !Number.isNaN(r.hoursWorked) ? r.hoursWorked : 0;
    if (h > 0) return h;
    let calc = (new Date(r.checkOut) - new Date(r.checkIn)) / (1000 * 60 * 60);
    if (Array.isArray(r.breaks)) {
      for (const b of r.breaks) {
        if (b?.startTime && b?.endTime) {
          calc -= (new Date(b.endTime) - new Date(b.startTime)) / (1000 * 60 * 60);
        }
      }
    }
    return Math.max(0, Math.round(calc * 100) / 100);
  }
  return buildLiveStatus(r).currentHours || 0;
}
