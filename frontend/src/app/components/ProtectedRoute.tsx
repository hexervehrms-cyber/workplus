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
          <Loader2 className="w-8 h-8 animate-spin text-primary mx-auto" />
          <p className="mt-4 text-muted-foreground">Verifying session...</p>
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
    
    if (!hasRequiredRole) {
      // Redirect to appropriate dashboard based on user role
      const targetPath = fallbackPath || roleRedirect;
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
  if (!user) return '/login';
  
  const roleArray = Array.isArray(roles) ? roles : [roles];
  if (roleArray.includes(user.role)) {
    return useRoleRedirect();
  }
  return '/login';
}
