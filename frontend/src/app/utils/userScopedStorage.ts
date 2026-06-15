/**
 * Per-user localStorage keys and cleanup on login/logout/account switch.
 */

export function educationalDocumentsKey(userId: string | null | undefined): string {
  return `workplus:educationalDocuments:${userId || 'anon'}`;
}

export function userCurrencyKey(userId: string | null | undefined): string {
  return `workplus:userCurrency:${userId || 'anon'}`;
}

/** Remove legacy global attendance keys (pre–user-scoped builds). */
export function purgeLegacyGlobalAttendanceKeys(): void {
  if (typeof window === 'undefined') return;
  try {
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const key = localStorage.key(i);
      if (!key) continue;
      if (key.startsWith('checkedIn_') || key === 'educationalDocuments') {
        localStorage.removeItem(key);
      }
    }
  } catch {
    /* ignore */
  }
}

/** Clear user-specific client caches (call on logout and before login as another user). */
export function clearUserScopedLocalStorage(userId: string | null | undefined): void {
  if (typeof window === 'undefined') return;
  purgeLegacyGlobalAttendanceKeys();
  try {
    const keys = [
      educationalDocumentsKey(userId),
      userCurrencyKey(userId),
      'educationalDocuments',
      'userCurrency',
      'dashboardCache',
      'userPreferences',
      'user',
      'authToken',
      'token',
      'refreshToken',
    ];
    for (const k of keys) localStorage.removeItem(k);
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const key = localStorage.key(i);
      if (
        key?.startsWith('workplus:attendance:') ||
        key?.startsWith('employee_attendance_state_') ||
        key?.startsWith('cached_holidays') ||
        key?.startsWith('workplus:educationalDocuments:') ||
        key?.startsWith('workplus:userCurrency:')
      ) {
        localStorage.removeItem(key);
      }
    }
  } catch {
    /* ignore */
  }
}
