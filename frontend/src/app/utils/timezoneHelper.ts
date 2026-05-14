/**
 * Frontend Timezone Helper
 * Handles timezone conversions and date formatting
 */

/**
 * Get user's timezone from localStorage or browser
 */
export const getUserTimezone = (): string => {
  // Try to get from localStorage
  const stored = localStorage.getItem('userTimezone');
  if (stored) {
    return stored;
  }

  // Try to get from browser
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Kolkata';
  } catch (error) {
    console.warn('Could not detect timezone, defaulting to Asia/Kolkata');
    return 'Asia/Kolkata';
  }
};

/**
 * Set user's timezone in localStorage
 */
export const setUserTimezone = (timezone: string): void => {
  localStorage.setItem('userTimezone', timezone);
};

/**
 * Convert UTC date to user's timezone string
 */
export const convertToUserTimezone = (utcDate: Date | string, timezone?: string): string => {
  if (!utcDate) return '';

  try {
    const date = new Date(utcDate);
    const tz = timezone || getUserTimezone();

    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
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
    return new Date(utcDate).toISOString();
  }
};

/**
 * Format time in user's timezone (HH:MM format)
 */
export const formatTimeInTimezone = (date: Date | string, timezone?: string): string => {
  if (!date) return '';

  try {
    const d = new Date(date);
    const tz = timezone || getUserTimezone();

    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    });

    return formatter.format(d);
  } catch (error) {
    console.error('Error formatting time:', error);
    return new Date(date).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  }
};

/**
 * Format date in user's timezone (YYYY-MM-DD format)
 */
export const formatDateInTimezone = (date: Date | string, timezone?: string): string => {
  if (!date) return '';

  try {
    const d = new Date(date);
    const tz = timezone || getUserTimezone();

    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    });

    const parts = formatter.formatToParts(d);
    const year = parts.find(p => p.type === 'year')?.value;
    const month = parts.find(p => p.type === 'month')?.value;
    const day = parts.find(p => p.type === 'day')?.value;

    return `${year}-${month}-${day}`;
  } catch (error) {
    console.error('Error formatting date:', error);
    return new Date(date).toLocaleDateString('en-US');
  }
};

/**
 * Get today's date in user's timezone
 */
export const getTodayInTimezone = (timezone?: string): Date => {
  const now = new Date();
  const tz = timezone || getUserTimezone();

  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });

  const parts = formatter.formatToParts(now);
  const year = parts.find(p => p.type === 'year')?.value;
  const month = parts.find(p => p.type === 'month')?.value;
  const day = parts.find(p => p.type === 'day')?.value;

  return new Date(`${year}-${month}-${day}T00:00:00Z`);
};

/**
 * Get tomorrow's date in user's timezone
 */
export const getTomorrowInTimezone = (timezone?: string): Date => {
  const today = getTodayInTimezone(timezone);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  return tomorrow;
};

/**
 * Get date range for a specific day in user's timezone
 */
export const getDateRangeInTimezone = (date: Date | string, timezone?: string): { startDate: Date; endDate: Date } => {
  const d = new Date(date);
  const tz = timezone || getUserTimezone();

  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });

  const parts = formatter.formatToParts(d);
  const year = parts.find(p => p.type === 'year')?.value;
  const month = parts.find(p => p.type === 'month')?.value;
  const day = parts.find(p => p.type === 'day')?.value;

  const startDate = new Date(`${year}-${month}-${day}T00:00:00Z`);
  const endDate = new Date(`${year}-${month}-${day}T23:59:59Z`);

  return { startDate, endDate };
};

/**
 * Common timezones
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
  setUserTimezone,
  convertToUserTimezone,
  formatTimeInTimezone,
  formatDateInTimezone,
  getTodayInTimezone,
  getTomorrowInTimezone,
  getDateRangeInTimezone,
  COMMON_TIMEZONES
};
