export const ATTENDANCE_ACTIVITY_ACTIONS = [
  'attendance_checkin',
  'attendance_checkout',
  'attendance_break_start',
  'attendance_break_end',
];

export function eventsFromAttendanceRow(att, employeeNameFallback = 'Employee') {
  const events = [];
  if (!att) return events;

  const userId = att.userId?._id || att.userId || null;
  const name =
    att.employeeName ||
    employeeNameFallback ||
    (att.userId?.name ? String(att.userId.name) : 'Employee');

  const baseDetails = {
    employeeName: name,
    attendanceId: String(att._id),
  };

  if (att.checkIn) {
    const ts = new Date(att.checkIn);
    events.push({
      _id: `syn-in-${att._id}`,
      sourceKey: `${att._id}-checkin-${ts.getTime()}`,
      userId,
      employeeName: name,
      action: 'attendance_checkin',
      timestamp: ts,
      details: { ...baseDetails, location: att.checkInLocation },
      synthetic: true,
    });
  }

  if (Array.isArray(att.breaks)) {
    att.breaks.forEach((b, i) => {
      if (b?.startTime) {
        const ts = new Date(b.startTime);
        events.push({
          _id: `syn-bs-${att._id}-${i}`,
          sourceKey: `${att._id}-break-start-${i}-${ts.getTime()}`,
          userId,
          employeeName: name,
          action: 'attendance_break_start',
          timestamp: ts,
          details: { ...baseDetails, breakType: b.breakType || 'regular' },
          synthetic: true,
        });
      }
      if (b?.endTime) {
        const ts = new Date(b.endTime);
        events.push({
          _id: `syn-be-${att._id}-${i}`,
          sourceKey: `${att._id}-break-end-${i}-${ts.getTime()}`,
          userId,
          employeeName: name,
          action: 'attendance_break_end',
          timestamp: ts,
          details: { ...baseDetails, duration: b.duration },
          synthetic: true,
        });
      }
    });
  }

  if (att.checkOut) {
    const ts = new Date(att.checkOut);
    events.push({
      _id: `syn-out-${att._id}`,
      sourceKey: `${att._id}-checkout-${ts.getTime()}`,
      userId,
      employeeName: name,
      action: 'attendance_checkout',
      timestamp: ts,
      details: { ...baseDetails, hoursWorked: att.hoursWorked },
      synthetic: true,
    });
  }

  return events;
}

function logDedupeKey(log) {
  if (log.details?.sourceKey) return String(log.details.sourceKey);
  const ts = new Date(log.timestamp || log.createdAt).getTime();
  const attId = log.details?.attendanceId || log.entity?.entityId || 'log';
  return `${attId}-${log.action}-${ts}`;
}

export function mapDbActivityLog(log) {
  return {
    _id: log._id,
    userId: log.userId?._id || log.userId || null,
    employeeName: log.details?.employeeName || log.userId?.name || 'Employee',
    action: log.action,
    timestamp: log.createdAt,
    details: log.details || {},
    ipAddress: log.ipAddress,
    deviceInfo: log.deviceInfo,
    sourceKey: log.details?.sourceKey || logDedupeKey({
      ...log,
      timestamp: log.createdAt,
    }),
    synthetic: false,
  };
}

/** Merge DB activity logs with events reconstructed from Attendance rows (no skipped employee actions). */
export function mergeActivityLogs(dbLogs, syntheticEvents) {
  const byKey = new Map();

  for (const log of dbLogs) {
    const mapped = mapDbActivityLog(log);
    byKey.set(logDedupeKey(mapped), mapped);
  }

  for (const ev of syntheticEvents) {
    const key = ev.sourceKey || logDedupeKey(ev);
    if (!byKey.has(key)) {
      byKey.set(key, ev);
    }
  }

  return Array.from(byKey.values()).sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );
}
