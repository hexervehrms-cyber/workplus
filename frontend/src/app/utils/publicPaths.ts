/** Routes that should not block on auth/socket bootstrap */
export function isPublicBootstrapPath(pathname?: string): boolean {
  const p = pathname ?? (typeof window !== 'undefined' ? window.location.pathname : '/');
  return p === '/' || p === '/login' || p.startsWith('/onboarding/');
}

export function hasStoredSessionHint(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return !!localStorage.getItem('user');
  } catch {
    return false;
  }
}
