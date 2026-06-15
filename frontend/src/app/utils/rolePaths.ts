import type { UserRole } from '../context/AuthContext';

export function getDashboardPathForRole(role: UserRole): string {
  switch (role) {
    case 'super_admin':
      return '/super-admin';
    case 'admin':
    case 'hr':
      return '/admin';
    case 'employee':
    case 'manager':
    case 'accountant':
      return '/employee';
    default:
      return '/employee';
  }
}
