import { Navigate } from 'react-router';
import { useAuth, useRoleRedirect } from '../context/AuthContext';

/** Sends unknown app paths to the correct home for the signed-in role. */
export function RoleHomeRedirect() {
  const target = useRoleRedirect();
  return <Navigate to={target} replace />;
}

/** Sends generic /settings to the correct settings page for the signed-in role. */
export function SettingsRoleRedirect() {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  if (user.role === 'admin' || user.role === 'hr') {
    return <Navigate to="/admin/settings" replace />;
  }
  if (user.role === 'super_admin') {
    return <Navigate to="/super-admin" replace />;
  }
  return <Navigate to="/employee/settings" replace />;
}
