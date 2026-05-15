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
