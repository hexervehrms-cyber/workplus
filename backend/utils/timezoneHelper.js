/**
 * Timezone Helper Utility
 * Handles timezone conversions and date calculations
 */

/**
 * Get user's timezone from request or default to Asia/Kolkata
 */
export const getUserTimezone = (req) => {
  // Try to get from user object
  if (req.user?.timezone) {
    return req.user.timezone;
  }

  // Try to get from headers
  const tzHeader = req.headers['x-timezone'];
  if (tzHeader) {
    return tzHeader;
  }

  // Default to Asia/Kolkata (India Standard Time)
  return 'Asia/Kolkata';
};

/**
 * Convert UTC date to user's timezone
 */
export const convertToUserTimezone = (utcDate, timezone = 'Asia/Kolkata') => {
  if (!utcDate) return null;

  try {
    const date = new Date(utcDate);
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    });

    return formatter.format(date);
  } catch (error) {
    console.error('Error converting timezone:', error);
    return utcDate.toISOString();
  }
};

/**
 * Get today's date in user's timezone
 */
export const getTodayInTimezone = (timezone = 'Asia/Kolkata') => {
  const now = new Date();
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });

  const parts = formatter.formatToParts(now);
  const year = parts.find(p => p.type === 'year').value;
  const month = parts.find(p => p.type === 'month').value;
  const day = parts.find(p => p.type === 'day').value;

  const date = new Date(`${year}-${month}-${day}T00:00:00Z`);
  return date;
};

/**
 * Get tomorrow's date in user's timezone
 */
export const getTomorrowInTimezone = (timezone = 'Asia/Kolkata') => {
  const today = getTodayInTimezone(timezone);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  return tomorrow;
};

/**
 * Get date range for a specific day in user's timezone
 */
export const getDateRangeInTimezone = (date, timezone = 'Asia/Kolkata') => {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });

  const parts = formatter.formatToParts(date);
  const year = parts.find(p => p.type === 'year').value;
  const month = parts.find(p => p.type === 'month').value;
  const day = parts.find(p => p.type === 'day').value;

  const startDate = new Date(`${year}-${month}-${day}T00:00:00Z`);
  const endDate = new Date(`${year}-${month}-${day}T23:59:59Z`);

  return { startDate, endDate };
};

/**
 * Format time in user's timezone
 */
export const formatTimeInTimezone = (date, timezone = 'Asia/Kolkata', format = 'HH:MM') => {
  if (!date) return '';

  try {
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    });

    return formatter.format(new Date(date));
  } catch (error) {
    console.error('Error formatting time:', error);
    return new Date(date).toLocaleTimeString();
  }
};

/**
 * Get offset of timezone from UTC in minutes
 */
export const getTimezoneOffset = (timezone = 'Asia/Kolkata') => {
  const now = new Date();
  const utcDate = new Date(now.toLocaleString('en-US', { timeZone: 'UTC' }));
  const tzDate = new Date(now.toLocaleString('en-US', { timeZone: timezone }));
  
  return (tzDate - utcDate) / (1000 * 60);
};

/**
 * List of common timezones
 */
export const COMMON_TIMEZONES = [
  { code: 'Asia/Kolkata', name: 'India Standard Time (IST)', offset: '+05:30' },
  { code: 'America/New_York', name: 'Eastern Time (ET)', offset: '-05:00' },
  { code: 'America/Chicago', name: 'Central Time (CT)', offset: '-06:00' },
  { code: 'America/Denver', name: 'Mountain Time (MT)', offset: '-07:00' },
  { code: 'America/Los_Angeles', name: 'Pacific Time (PT)', offset: '-08:00' },
  { code: 'Europe/London', name: 'Greenwich Mean Time (GMT)', offset: '+00:00' },
  { code: 'Europe/Paris', name: 'Central European Time (CET)', offset: '+01:00' },
  { code: 'Asia/Singapore', name: 'Singapore Time (SGT)', offset: '+08:00' },
  { code: 'Asia/Tokyo', name: 'Japan Standard Time (JST)', offset: '+09:00' },
  { code: 'Australia/Sydney', name: 'Australian Eastern Time (AEST)', offset: '+10:00' }
];

export default {
  getUserTimezone,
  convertToUserTimezone,
  getTodayInTimezone,
  getTomorrowInTimezone,
  getDateRangeInTimezone,
  formatTimeInTimezone,
  getTimezoneOffset,
  COMMON_TIMEZONES
};
