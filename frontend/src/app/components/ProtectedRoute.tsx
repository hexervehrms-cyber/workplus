/**
 * Protected Route Component - Production Ready
 * Features: Role-based access, loading states, redirect handling
 */

import { Navigate, useLocation } from 'react-router';
import { useAuth, useRoleRedirect } from '../context/AuthContext';
import { Loader2 } from 'lucide-react';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredRole?: string | string[];
  fallbackPath?: string;
}

export function ProtectedRoute({ 
  children, 
  requiredRole, 
  fallbackPath 
}: ProtectedRouteProps) {
  const { user, loading: authLoading } = useAuth();
  const location = useLocation();
  const roleRedirect = useRoleRedirect();

  // Show loading while checking authentication
  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <Loader2 className="w-6 h-6 animate-spin text-primary mx-auto" aria-hidden />
        </div>
      </div>
    );
  }

  // Redirect to login if not authenticated
  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Check role-based access if required
  if (requiredRole) {
    const roleArray = Array.isArray(requiredRole) ? requiredRole : [requiredRole];
    const hasRequiredRole = roleArray.includes(user.role);
    
    console.log('🔐 ProtectedRoute - Role check:', {
      userRole: user.role,
      requiredRoles: roleArray,
      hasAccess: hasRequiredRole,
      path: location.pathname
    });
    
    if (!hasRequiredRole) {
      // Redirect to appropriate dashboard based on user role
      const targetPath = fallbackPath || roleRedirect;
      console.log('❌ Access denied - Redirecting to:', targetPath);
      return <Navigate to={targetPath} replace />;
    }
  }

  return <>{children}</>;
}

// Hook for checking if user has specific role
export function useCheckRole(roles: string | string[]): boolean {
  const { user } = useAuth();
  if (!user) return false;
  
  const roleArray = Array.isArray(roles) ? roles : [roles];
  return roleArray.includes(user.role);
}

// Hook for getting redirect path
export function useRedirectOnRole(roles: string | string[]): string {
  const { user } = useAuth();
  const roleRedirect = useRoleRedirect();
  if (!user) return '/login';

  const roleArray = Array.isArray(roles) ? roles : [roles];
  if (roleArray.includes(user.role)) {
    return roleRedirect;
  }
  return '/login';
}
