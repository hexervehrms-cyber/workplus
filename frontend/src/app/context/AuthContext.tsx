/**
 * Authentication Context - Production Ready
 * Features: Session persistence, auto logout, role-based routing
 */

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { AuthService, TokenManager, ApiError } from '../utils/api';
import { socketService, ConnectionState } from '../utils/socket';
import { toast } from 'sonner';

export type UserRole = 'super_admin' | 'admin' | 'hr' | 'manager' | 'accountant' | 'employee';

interface User {
  id: string;
  userId?: string;
  name: string;
  email: string;
  role: UserRole;
  avatar?: string;
  organization?: string;
  tenantId?: string;
  orgId?: string;
  employeeId?: string;
  employeeCode?: string;
}

interface AuthContextType {
  user: User | null;
  setUser: (user: User | null) => void;
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
  switchRole: (role: UserRole) => void;
  loading: boolean;
  socketConnected: boolean;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Session check interval (5 minutes)
const SESSION_CHECK_INTERVAL = 5 * 60 * 1000;

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [socketConnected, setSocketConnected] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);

  // Initialize auth state from storage
  useEffect(() => {
    const initializeAuth = async () => {
      try {
        try {
          const token = TokenManager.get();
          const storedUser = TokenManager.getUser();

          if (token && storedUser) {
            // Check if token is expired
            try {
              const payload = JSON.parse(atob(token.split('.')[1]));
              const exp = payload.exp * 1000;
              
              if (Date.now() >= exp) {
                // Token expired, clear and redirect to login
                console.log('Token expired, clearing session');
                TokenManager.clear();
                setLoading(false);
                setIsInitialized(true);
                return;
              }

              // Token valid, restore user
              setUser(storedUser);

              // Verify with backend
              try {
                const currentUser = await AuthService.getCurrentUser();
                if (currentUser) {
                  setUser(currentUser);
                  TokenManager.setUser(currentUser);
                }
              } catch (error) {
                // Backend verification failed - check if it's an auth error
                if (error instanceof ApiError && (error.code === 'TOKEN_EXPIRED' || error.code === 'INVALID_TOKEN')) {
                  console.log('Token invalid on backend verification, clearing session');
                  TokenManager.clear();
                  setUser(null);
                  setLoading(false);
                  setIsInitialized(true);
                  return;
                }
                // Other errors (network, server) - keep session but warn
                console.warn('Could not verify session with backend:', error);
              }
            } catch (error) {
              console.error('Error parsing token:', error);
              TokenManager.clear();
            }
          }
        } catch (error) {
          console.error('Auth initialization error:', error);
        }
      } catch (error) {
        console.error('Unexpected error in auth initialization:', error);
      } finally {
        setLoading(false);
        setIsInitialized(true);
      }
    };

    initializeAuth();
  }, []);

  // Socket.IO connection management
  useEffect(() => {
    if (!user || !isInitialized) return;

    const connectSocket = async () => {
      try {
        await socketService.connect(user.id, user.role, user.tenantId);
        setSocketConnected(true);
      } catch (error) {
        console.error('Failed to connect to Socket.IO:', error);
        setSocketConnected(false);
      }
    };

    connectSocket();

    // Set up connection state listener
    socketService.setStateChangeCallback((state: ConnectionState) => {
      setSocketConnected(state === 'connected');
      
      if (state === 'reconnecting') {
        // Keep silent during transient reconnects to avoid noisy UI popups
      } else if (state === 'disconnected') {
        toast.error('Lost connection to real-time server');
      }
    });

    return () => {
      socketService.disconnect();
      setSocketConnected(false);
    };
  }, [user?.id, isInitialized]);

  // Session check interval
  useEffect(() => {
    if (!user) return;

    const checkSession = () => {
      const token = TokenManager.get();
      if (!token) {
        // No token, logout
        handleLogout();
        return;
      }

      try {
        const payload = JSON.parse(atob(token.split('.')[1]));
        const exp = payload.exp * 1000;
        
        // If token expires in less than 5 minutes, warn user
        const timeUntilExpiry = exp - Date.now();
        if (timeUntilExpiry < 5 * 60 * 1000 && timeUntilExpiry > 0) {
          toast.warning('Your session will expire soon. Please save your work.');
        }
        
        if (Date.now() >= exp) {
          toast.error('Your session has expired. Please log in again.');
          handleLogout();
        }
      } catch (error) {
        console.error('Session check error:', error);
        handleLogout();
      }
    };

    const interval = setInterval(checkSession, SESSION_CHECK_INTERVAL);
    return () => clearInterval(interval);
  }, [user]);

  // Login function
  const login = useCallback(async (email: string, password: string) => {
    setLoading(true);

    try {
      const result = await AuthService.login(email, password);
      
      if (result.success && result.user) {
        setUser(result.user);
        toast.success(`Welcome back, ${result.user.name}!`);
        
        // Redirect based on role
        const redirectPath = result.user.role === 'super_admin' 
          ? '/super-admin' 
          : result.user.role === 'admin'
          ? '/admin'
          : '/employee';
        
        window.location.href = redirectPath;
        return { success: true };
      }

      return { success: false, error: 'Login failed' };
    } catch (error: any) {
      console.error('Login error:', error);
      
      let errorMessage = 'Login failed. Please try again.';
      
      if (error instanceof ApiError) {
        errorMessage = error.getUserMessage();
      } else if (error.message) {
        errorMessage = error.message;
      }

      toast.error(errorMessage);
      return { success: false, error: errorMessage };
    } finally {
      setLoading(false);
    }
  }, []);

  // Logout function
  const handleLogout = useCallback(async () => {
    setLoading(true);

    try {
      await AuthService.logout();
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      setUser(null);
      socketService.disconnect();
      setSocketConnected(false);
      TokenManager.clear();
      
      // Clear any cached data
      localStorage.removeItem('dashboardCache');
      localStorage.removeItem('userPreferences');
      
      setLoading(false);
      toast.info('You have been logged out.');
      
      // Force redirect to login
      window.location.href = '/login';
    }
  }, []);

  // Switch role (for demo/testing)
  const switchRole = useCallback((role: UserRole) => {
    if (user) {
      const updatedUser = { ...user, role };
      setUser(updatedUser);
      TokenManager.setUser(updatedUser);

      // Reconnect socket with new role
      socketService.disconnect();
      socketService.connect(user.id, role, user.tenantId)
        .then(() => setSocketConnected(true))
        .catch((error) => {
          console.error('Failed to reconnect socket:', error);
          setSocketConnected(false);
        });
    }
  }, [user]);

  const value: AuthContextType = {
    user,
    setUser,
    login,
    logout: handleLogout,
    switchRole,
    loading,
    socketConnected,
    isAuthenticated: !!user
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}

// Hook for role-based access
export function useHasRole(roles: UserRole | UserRole[]): boolean {
  const { user } = useAuth();
  if (!user) return false;
  
  const roleArray = Array.isArray(roles) ? roles : [roles];
  return roleArray.includes(user.role);
}

// Hook for getting redirect path based on role
export function useRoleRedirect(): string {
  const { user } = useAuth();
  
  if (!user) return '/login';
  
  switch (user.role) {
    case 'super_admin':
      return '/super-admin';
    case 'admin':
      return '/admin';
    case 'employee':
    case 'hr':
    case 'manager':
    case 'accountant':
    default:
      return '/employee';
  }
}
