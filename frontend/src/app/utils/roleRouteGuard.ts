/** True if the signed-in user may open this path (prevents post-login bounce to wrong dashboard). */
export function isPathAllowedForRole(pathname: string, role: string): boolean {
  const p = pathname || '/';
  if (p === '/' || p === '') return true;
  if (p.startsWith('/super-admin')) return role === 'super_admin';
  if (p.startsWith('/admin')) return role === 'admin' || role === 'hr';
  if (p.startsWith('/employee')) {
    return ['employee', 'manager', 'accountant'].includes(role);
  }
  return true;
}
