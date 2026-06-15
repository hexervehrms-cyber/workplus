/** True when the tab is visible — use to pause background polling and timers. */
export function isPageVisible(): boolean {
  if (typeof document === 'undefined') return true;
  return document.visibilityState === 'visible';
}

/** Run callback when tab becomes visible again (e.g. refresh stale data once). */
export function onPageVisible(callback: () => void): () => void {
  if (typeof document === 'undefined') return () => {};
  const handler = () => {
    if (document.visibilityState === 'visible') callback();
  };
  document.addEventListener('visibilitychange', handler);
  return () => document.removeEventListener('visibilitychange', handler);
}
