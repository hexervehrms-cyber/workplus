import { Navigate, useLocation } from 'react-router';
import { useAuth } from '../context/AuthContext';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredRole?: string[];
}

export function ProtectedRoute({ children, requiredRole }: ProtectedRouteProps) {
  const { user, loading } = useAuth();
  const location = useLocation();

  // Show loading spinner while checking authentication
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  // Redirect to login if not authenticated
  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Check role-based access if required
  if (requiredRole && requiredRole.length > 0) {
    const hasRequiredRole = requiredRole.includes(user.role);
    if (!hasRequiredRole) {
      // Redirect to appropriate dashboard based on user role
      switch (user.role) {
        case 'super_admin':
          return <Navigate to="/super-admin" replace />;
        case 'admin':
          return <Navigate to="/admin" replace />;
        case 'employee':
        case 'hr':
        case 'manager':
        case 'accountant':
          return <Navigate to="/employee" replace />;
        default:
          return <Navigate to="/employee" replace />;
      }
    }
  }

  return <>{children}</>;
}
