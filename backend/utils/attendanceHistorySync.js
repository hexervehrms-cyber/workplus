import AttendanceHistory from '../models/AttendanceHistory.js';
import logger from './logger.js';

function sumBreakMinutes(breaks = []) {
  return breaks.reduce((total, breakItem) => {
    if (breakItem?.startTime && breakItem?.endTime) {
      return (
        total +
        (new Date(breakItem.endTime).getTime() - new Date(breakItem.startTime).getTime()) /
          (1000 * 60)
      );
    }
    return total;
  }, 0);
}

/**
 * Upsert admin AttendanceHistory whenever an Attendance row changes (check-in, break, check-out).
 */
export async function syncAttendanceHistoryFromRecord(attendance, options = {}) {
  if (!attendance?.employeeId || !attendance?.date) return null;

  const effectiveUserId = options.userId || attendance.userId;
  const effectiveOrgId = String(options.orgId || attendance.orgId);
  const effectiveEmployeeId = options.employeeId || attendance.employeeId;
  const updatedBy = options.updatedBy || effectiveUserId;

  let hoursWorked = attendance.hoursWorked ?? 0;
  if (!hoursWorked && attendance.checkIn && attendance.checkOut) {
    hoursWorked =
      (new Date(attendance.checkOut).getTime() - new Date(attendance.checkIn).getTime()) /
      (1000 * 60 * 60);
    hoursWorked -= sumBreakMinutes(attendance.breaks) / 60;
    hoursWorked = Math.max(0, Math.round(hoursWorked * 100) / 100);
  }

  const totalBreakDuration = Math.round(sumBreakMinutes(attendance.breaks));

  try {
    return await AttendanceHistory.findOneAndUpdate(
      {
        employeeId: effectiveEmployeeId,
        date: attendance.date,
      },
      {
        userId: effectiveUserId,
        orgId: effectiveOrgId,
        date: attendance.date,
        checkInTime: attendance.checkIn || undefined,
        checkOutTime: attendance.checkOut || undefined,
        hoursWorked,
        status: attendance.status || 'present',
        breaks:
          attendance.breaks?.map((breakItem) => ({
            breakType: breakItem.breakType || 'regular',
            startTime: breakItem.startTime,
            endTime: breakItem.endTime,
            duration: breakItem.duration || 0,
            reason: breakItem.notes || breakItem.endNotes || '',
          })) || [],
        totalBreakDuration,
        breakCount: attendance.breaks?.length || 0,
        isLate: attendance.isLate || false,
        lateMinutes: attendance.lateMinutes || 0,
        notes: attendance.checkOutNotes || attendance.checkInNotes || attendance.notes || '',
        isApproved: true,
        updatedBy,
        ...(options.isInsert ? { createdBy: updatedBy } : {}),
      },
      {
        upsert: true,
        new: true,
        setDefaultsOnInsert: true,
      }
    );
  } catch (error) {
    logger.error('Failed to sync attendance history', {
      employeeId: String(effectiveEmployeeId),
      error: error.message,
    });
    return null;
  }
}
