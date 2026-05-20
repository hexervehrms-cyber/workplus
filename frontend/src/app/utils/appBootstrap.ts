/**
 * One-time app bootstrap: global error logging, legacy storage cleanup.
 */

export function bootstrapApp(): void {
  if (typeof window === 'undefined') return;

  window.addEventListener('unhandledrejection', (event) => {
    console.error('[app] Unhandled promise rejection:', event.reason);
  });

  window.addEventListener('error', (event) => {
    console.error('[app] Uncaught error:', event.error ?? event.message);
  });

  try {
    localStorage.removeItem('user');
  } catch (e) {
    console.error('[app] localStorage check failed:', e);
  }
}
