/** Shared UI-safe helpers — avoid throws from bad API/date data. */

export function safeLocaleTime(value: unknown): string | null {
  if (value == null || value === '') return null;
  const d = new Date(value as string | number | Date);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
}

export function safeFormatTime(seconds: number): string {
  const s = Number.isFinite(seconds) ? Math.max(0, seconds) : 0;
  const hours = Math.floor(s / 3600);
  const minutes = Math.floor((s % 3600) / 60);
  const secs = Math.floor(s % 60);
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

export function hasCheckOutValue(checkOut: unknown): boolean {
  return safeLocaleTime(checkOut) != null;
}

/** Format currency without throwing when API returns null/undefined/strings. */
export function safeFormatInr(value: unknown): string {
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(n)) return '0';
  return n.toLocaleString('en-IN');
}

/** Coerce API list payloads to arrays (paginated wrappers sometimes nest data). */
export function ensureArray<T>(value: unknown): T[] {
  if (Array.isArray(value)) return value;
  if (value && typeof value === 'object') {
    const obj = value as Record<string, unknown>;
    if (Array.isArray(obj.data)) return obj.data as T[];
    if (Array.isArray(obj.items)) return obj.items as T[];
    if (Array.isArray(obj.results)) return obj.results as T[];
  }
  return [];
}

/** Safe table cell text — never throw when API returns objects/null. */
export function safeCell(value: unknown): string {
  if (value == null || value === '') return '—';
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  if (typeof value === 'object') {
    const o = value as Record<string, unknown>;
    if (typeof o.name === 'string') return o.name;
    if (typeof o.label === 'string') return o.label;
  }
  return '—';
}

/** Run async work without bubbling rejections to the error boundary. */
export function runSafe(
  label: string,
  fn: () => void | Promise<void>
): void {
  void Promise.resolve()
    .then(fn)
    .catch((err) => {
      console.warn(`[${label}]`, err);
    });
}
