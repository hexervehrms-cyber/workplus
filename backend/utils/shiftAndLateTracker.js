/**
 * Shift and Late Tracking Utility
 * Handles shift timing configuration, late arrival detection, and working hours calculation
 */

/**
 * Parse time string in HH:MM format to minutes since midnight
 * @param {string} timeStr - Time in "HH:MM" format
 * @returns {number} Minutes since midnight
 */
export const timeToMinutes = (timeStr) => {
  if (!timeStr) return 0;
  const [hours, minutes] = timeStr.split(':').map(Number);
  return hours * 60 + minutes;
};

/**
 * Convert minutes since midnight to HH:MM format
 * @param {number} minutes - Minutes since midnight
 * @returns {string} Time in "HH:MM" format
 */
export const minutesToTime = (minutes) => {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
};

/**
 * Get day name from date
 * @param {Date} date - Date object
 * @returns {string} Day name (Monday, Tuesday, etc.)
 */
export const getDayName = (date) => {
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  return days[date.getDay()];
};

/**
 * Check if employee is working on a given day
 * @param {Date} date - Date to check
 * @param {Array} workingDays - Array of working day names
 * @returns {boolean} True if it's a working day
 */
export const isWorkingDay = (date, workingDays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']) => {
  const dayName = getDayName(date);
  return workingDays.includes(dayName);
};

/**
 * Calculate if employee is late and by how many minutes
 * @param {Date} checkInTime - Check-in time
 * @param {string} shiftStartTime - Shift start time in "HH:MM" format
 * @param {number} lateThreshold - Grace period in minutes (default: 0)
 * @returns {Object} { isLate: boolean, lateMinutes: number }
 */
export const calculateLateArrival = (checkInTime, shiftStartTime, lateThreshold = 0) => {
  if (!checkInTime || !shiftStartTime) {
    return { isLate: false, lateMinutes: 0 };
  }

  // Get time components
  const checkInDate = new Date(checkInTime);
  const checkInHours = checkInDate.getHours();
  const checkInMins = checkInDate.getMinutes();
  const checkInTotalMinutes = checkInHours * 60 + checkInMins;

  // Parse shift start time
  const shiftStartMinutes = timeToMinutes(shiftStartTime);
  
  // Calculate allowed time (shift start + grace period)
  const allowedMinutes = shiftStartMinutes + lateThreshold;

  // Check if late
  if (checkInTotalMinutes > allowedMinutes) {
    const lateMinutes = checkInTotalMinutes - allowedMinutes;
    return { isLate: true, lateMinutes };
  }

  return { isLate: false, lateMinutes: 0 };
};

/**
 * Calculate actual working hours excluding breaks
 * @param {Date} checkInTime - Check-in time
 * @param {Date} checkOutTime - Check-out time
 * @param {Array} breaks - Array of break objects with startTime and endTime
 * @param {string} shiftStartTime - Shift start time (used if employee is late)
 * @returns {number} Working hours (decimal)
 */
export const calculateActualWorkingHours = (checkInTime, checkOutTime, breaks = [], shiftStartTime = null) => {
  if (!checkInTime || !checkOutTime) {
    return 0;
  }

  // Use actual check-in time or shift start time (whichever is later)
  let startTime = new Date(checkInTime);
  
  if (shiftStartTime) {
    const shiftStartDate = new Date(checkInTime);
    const [hours, minutes] = shiftStartTime.split(':').map(Number);
    shiftStartDate.setHours(hours, minutes, 0, 0);
    
    // If employee checked in before shift start, use shift start time
    if (startTime < shiftStartDate) {
      startTime = shiftStartDate;
    }
  }

  const endTime = new Date(checkOutTime);

  // Calculate total time between check-in and check-out
  let totalMinutes = (endTime - startTime) / (1000 * 60);

  // Subtract break durations
  if (Array.isArray(breaks) && breaks.length > 0) {
    const totalBreakMinutes = breaks.reduce((sum, breakItem) => {
      if (breakItem.duration) {
        return sum + breakItem.duration;
      }
      if (breakItem.startTime && breakItem.endTime) {
        const breakStart = new Date(breakItem.startTime);
        const breakEnd = new Date(breakItem.endTime);
        return sum + ((breakEnd - breakStart) / (1000 * 60));
      }
      return sum;
    }, 0);

    totalMinutes -= totalBreakMinutes;
  }

  // Convert to hours and ensure non-negative
  const workingHours = Math.max(0, totalMinutes / 60);
  return Math.round(workingHours * 100) / 100; // Round to 2 decimal places
};

/**
 * Determine attendance status based on check-in time and shift timing
 * @param {Date} checkInTime - Check-in time
 * @param {Date} checkOutTime - Check-out time
 * @param {string} shiftStartTime - Shift start time in "HH:MM" format
 * @param {number} lateThreshold - Grace period in minutes
 * @returns {string} Status: "present", "late", "absent"
 */
export const determineAttendanceStatus = (checkInTime, checkOutTime, shiftStartTime, lateThreshold = 0) => {
  if (!checkInTime) {
    return 'absent';
  }

  const { isLate } = calculateLateArrival(checkInTime, shiftStartTime, lateThreshold);
  
  if (isLate) {
    return 'late';
  }

  return 'present';
};

/**
 * Process attendance record with shift timing
 * Updates isLate, lateMinutes, and actualWorkingHours fields
 * @param {Object} attendanceRecord - Attendance record from database
 * @param {Object} employeeShiftTiming - Employee's shift timing configuration
 * @returns {Object} Updated attendance record
 */
export const processAttendanceWithShiftTiming = (attendanceRecord, employeeShiftTiming) => {
  if (!attendanceRecord || !employeeShiftTiming) {
    return attendanceRecord;
  }

  const {
    startTime: shiftStartTime = '09:00',
    endTime: shiftEndTime = '18:00',
    lateThreshold = 0,
    workingDays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']
  } = employeeShiftTiming;

  // Check if it's a working day
  const attendanceDate = new Date(attendanceRecord.date);
  const isWorkDay = isWorkingDay(attendanceDate, workingDays);

  if (!isWorkDay) {
    // Not a working day, mark as present (or handle as per policy)
    return {
      ...attendanceRecord,
      isLate: false,
      lateMinutes: 0,
      actualWorkingHours: 0,
      status: 'present'
    };
  }

  // Calculate late arrival
  const { isLate, lateMinutes } = calculateLateArrival(
    attendanceRecord.checkIn,
    shiftStartTime,
    lateThreshold
  );

  // Calculate actual working hours
  const actualWorkingHours = calculateActualWorkingHours(
    attendanceRecord.checkIn,
    attendanceRecord.checkOut,
    attendanceRecord.breaks,
    shiftStartTime
  );

  // Determine status
  let status = attendanceRecord.status;
  if (attendanceRecord.checkIn && !attendanceRecord.checkOut) {
    status = isLate ? 'late' : 'present';
  } else if (attendanceRecord.checkIn && attendanceRecord.checkOut) {
    status = isLate ? 'late' : 'present';
  }

  return {
    ...attendanceRecord,
    isLate,
    lateMinutes,
    actualWorkingHours,
    status
  };
};

/**
 * Get employees who were late today
 * @param {Array} attendanceRecords - Array of attendance records for today
 * @param {Map} employeeShiftTimingMap - Map of employeeId to shift timing config
 * @returns {Array} Array of late employees with details
 */
export const getLateEmployeesToday = (attendanceRecords, employeeShiftTimingMap) => {
  return attendanceRecords
    .filter(record => {
      const shiftTiming = employeeShiftTimingMap.get(record.employeeId?.toString());
      if (!shiftTiming) return false;

      const processed = processAttendanceWithShiftTiming(record, shiftTiming);
      return processed.isLate;
    })
    .map(record => {
      const shiftTiming = employeeShiftTimingMap.get(record.employeeId?.toString());
      const processed = processAttendanceWithShiftTiming(record, shiftTiming);
      
      return {
        employeeId: record.employeeId,
        employeeName: record.employeeName,
        checkInTime: record.checkIn,
        shiftStartTime: shiftTiming.startTime,
        lateMinutes: processed.lateMinutes,
        actualWorkingHours: processed.actualWorkingHours,
        status: processed.status
      };
    });
};

/**
 * Format shift timing for display
 * @param {Object} shiftTiming - Shift timing configuration
 * @returns {string} Formatted string like "09:00 - 18:00"
 */
export const formatShiftTiming = (shiftTiming) => {
  if (!shiftTiming) return 'Not configured';
  
  const { startTime = '09:00', endTime = '18:00', workingDays = [] } = shiftTiming;
  const daysStr = workingDays.length > 0 ? ` (${workingDays.join(', ')})` : '';
  
  return `${startTime} - ${endTime}${daysStr}`;
};

export default {
  timeToMinutes,
  minutesToTime,
  getDayName,
  isWorkingDay,
  calculateLateArrival,
  calculateActualWorkingHours,
  determineAttendanceStatus,
  processAttendanceWithShiftTiming,
  getLateEmployeesToday,
  formatShiftTiming
};
