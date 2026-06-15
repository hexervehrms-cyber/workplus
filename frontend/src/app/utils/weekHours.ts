/** Monday-based calendar week key (matches backend calendarWeekKey). */
export function calendarWeekKey(d = new Date()): string {
  const weekStart = new Date(d);
  const dow = weekStart.getDay();
  const toMonday = dow === 0 ? -6 : 1 - dow;
  weekStart.setDate(weekStart.getDate() + toMonday);
  weekStart.setHours(0, 0, 0, 0);
  const y = weekStart.getFullYear();
  const m = String(weekStart.getMonth() + 1).padStart(2, '0');
  const day = String(weekStart.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function formatWeekHours(hours: number): string {
  if (!Number.isFinite(hours) || hours <= 0) return '0h';
  const rounded = Math.round(hours * 100) / 100;
  if (rounded < 1) {
    const totalSeconds = Math.max(0, Math.floor(hours * 3600));
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    if (mins > 0) return `${mins}m`;
    if (secs > 0) return `${secs}s`;
    return '<1m';
  }
  const whole = Math.floor(rounded);
  const mins = Math.round((rounded - whole) * 60);
  if (mins === 0) return `${whole}h`;
  return `${whole}h ${mins}m`;
}

const WEEK_HOURS_STORAGE_PREFIX = 'workplus:hours-this-week:';

export function readCachedWeekHours(userId: string | null): { hours: number; weekKey: string } | null {
  if (!userId || typeof localStorage === 'undefined') return null;
  try {
    const raw = localStorage.getItem(`${WEEK_HOURS_STORAGE_PREFIX}${userId}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { hours?: number; weekKey?: string };
    if (parsed.weekKey !== calendarWeekKey()) return null;
    if (typeof parsed.hours !== 'number') return null;
    return { hours: parsed.hours, weekKey: parsed.weekKey };
  } catch {
    return null;
  }
}

export function writeCachedWeekHours(userId: string | null, hours: number): void {
  if (!userId || typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(
      `${WEEK_HOURS_STORAGE_PREFIX}${userId}`,
      JSON.stringify({ hours, weekKey: calendarWeekKey(), updatedAt: Date.now() })
    );
  } catch {
    /* ignore */
  }
}
