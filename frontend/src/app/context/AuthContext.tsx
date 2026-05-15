/**
 * Authentication Context - Production Ready
 * Features: Session persistence, proactive token refresh, role-based routing
 */

import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { AuthService, TokenManager, ApiError, TokenRefreshService } from '../utils/api';
import { socketService, ConnectionState } from '../utils/socket';
import { clearApiCache } from '../utils/apiHelper';
import { clearPersistedAttendance } from '../utils/attendancePersistence';
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

// Session check interval (15 minutes) — proactive refresh / expiry warnings only
const SESSION_CHECK_INTERVAL = 15 * 60 * 1000;

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [socketConnected, setSocketConnected] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);
  const userRef = useRef<User | null>(null);

  useEffect(() => {
    userRef.current = user;
  }, [user]);

  const performLogout = useCallback(async () => {
    setLoading(true);
    const uid = userRef.current?.id ? String(userRef.current.id) : null;

    try {
      await AuthService.logout();
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      try {
        await clearPersistedAttendance(uid);
      } catch (e) {
        console.warn('clearPersistedAttendance on logout:', e);
      }
      // Clear all state immediately
      setUser(null);
      setSocketConnected(false);
      socketService.disconnect();
      
      // Clear localStorage
      localStorage.removeItem('dashboardCache');
      localStorage.removeItem('userPreferences');
      localStorage.removeItem('user');
      localStorage.removeItem('authToken');
      localStorage.removeItem('token');
      localStorage.removeItem('refreshToken');
      localStorage.removeItem('cached_holidays');

      setLoading(false);
      toast.info('You have been logged out.');

      // Force redirect to login
      window.location.href = '/login';
    }
  }, []);

  const handleLogout = useCallback(async () => {
    if (!window.confirm('Sign out? You will need to log in again to continue.')) {
      return;
    }
    await performLogout();
  }, [performLogout]);

  // Socket state callback — registered first so connect() in bootstrap can update UI.
  useEffect(() => {
    let isMounted = true;
    socketService.setStateChangeCallback((state: ConnectionState) => {
      if (!isMounted) return;
      setSocketConnected(state === 'connected');
      if (state === 'reconnecting') {
        console.log('🔄 [AUTH] Socket reconnecting...');
      } else if (state === 'disconnected') {
        console.warn('⚠️ [AUTH] Socket disconnected');
        toast.error('Lost connection to real-time server');
      }
    });
    return () => {
      isMounted = false;
    };
  }, []);

  // Disconnect socket when the auth shell unmounts (full app teardown).
  useEffect(() => {
    return () => {
      socketService.disconnect();
    };
  }, []);

  // Initialize auth from Redis session via /api/auth/me endpoint - ONLY on mount
  useEffect(() => {
    let cancelled = false;

    const tryRefreshAccessToken = async (): Promise<boolean> => {
      try {
        const svc = new TokenRefreshService();
        const result = await svc.refreshToken();
        return !!(result.success && result.data?.token);
      } catch {
        return false;
      }
    };

    const initializeAuth = async () => {
      let userForSocket: User | null = null;

      const finish = async () => {
        if (cancelled) return;
        if (userForSocket) {
          try {
            // Connect to Socket.IO with proper error handling and timeout
            const connectionPromise = socketService.connect(
              userForSocket.id,
              userForSocket.role,
              userForSocket.tenantId || userForSocket.orgId
            );
            
            // Add timeout to prevent hanging
            const timeoutPromise = new Promise((_, reject) =>
              setTimeout(() => reject(new Error('Socket connection timeout')), 10000)
            );
            
            await Promise.race([connectionPromise, timeoutPromise]);
            
            if (!cancelled) {
              const state = socketService.getState();
              setSocketConnected(state === 'connected');
              console.log('✅ [AUTH] Socket.IO connected successfully, state:', state);
            }
          } catch (error) {
            console.error('❌ [AUTH] Failed to connect to Socket.IO during bootstrap:', error);
            if (!cancelled) {
              setSocketConnected(false);
              // Show warning but don't block app initialization
              toast.warning('Real-time updates unavailable. Some features may be limited.');
            }
          }
        }
        if (!cancelled) {
          setLoading(false);
          setIsInitialized(true);
        }
      };

      try {
        await TokenManager.hydrateFromIndexedDB();
        // Try to get current user from backend (uses httpOnly cookie + Redis session)
        try {
          const currentUser = await AuthService.getCurrentUser();
          if (currentUser) {
            console.log('✅ User restored from Redis session:', {
              id: currentUser.id,
              email: currentUser.email,
              role: currentUser.role
            });
            setUser(currentUser);
            userForSocket = currentUser;
            await finish();
            return;
          }
        } catch (error) {
          if (error instanceof ApiError && (error.code === 'TOKEN_EXPIRED' || error.code === 'INVALID_TOKEN')) {
            const recovered = await tryRefreshAccessToken();
            if (recovered) {
              try {
                const retryUser = await AuthService.getCurrentUser();
                if (retryUser) {
                  console.log('✅ User restored after token refresh:', {
                    id: retryUser.id,
                    email: retryUser.email,
                    role: retryUser.role
                  });
                  setUser(retryUser);
                  userForSocket = retryUser;
                  await finish();
                  return;
                }
              } catch {
                console.log('No valid session found');
                setUser(null);
                userForSocket = null;
                await finish();
                return;
              }
            } else {
              console.log('Token refresh failed, no session');
              setUser(null);
              userForSocket = null;
              await finish();
              return;
            }
          } else {
            console.warn('Could not verify session with backend:', error);
          }
        }
      } catch (error) {
        console.error('Auth initialization error:', error);
      }

      await finish();
    };

    // Only initialize on mount, not after login
    if (!isInitialized) {
      void initializeAuth();
    }

    return () => {
      cancelled = true;
    };
  }, []);

  // Session check interval — attempt refresh before forcing logout when access token expires
  useEffect(() => {
    if (!user) return;

    const tryRefreshAccessToken = async (): Promise<boolean> => {
      try {
        const svc = new TokenRefreshService();
        const result = await svc.refreshToken();
        return !!(result.success && result.data?.token);
      } catch {
        return false;
      }
    };

    const checkSession = () => {
      void (async () => {
        const token = TokenManager.get();
        if (!token) {
          return;
        }

        try {
          const payload = JSON.parse(atob(token.split('.')[1]));
          const exp = payload.exp * 1000;

          const timeUntilExpiry = exp - Date.now();
          if (timeUntilExpiry < 5 * 60 * 1000 && timeUntilExpiry > 0) {
            toast.warning('Your session will expire soon. Please save your work.');
          }

          if (Date.now() >= exp) {
            const refreshed = await tryRefreshAccessToken();
            if (!refreshed) {
              toast.error('Your session has expired. Please log in again.');
              await performLogout();
            }
          }
        } catch (error) {
          console.error('Session check error (ignored; not forcing logout):', error);
        }
      })();
    };

    const interval = setInterval(checkSession, SESSION_CHECK_INTERVAL);
    return () => clearInterval(interval);
  }, [user, performLogout]);

  // Login function
  const login = useCallback(async (email: string, password: string) => {
    setLoading(true);

    try {
      console.log('🔐 LOGIN START - Email:', email);
      const result = await AuthService.login(email, password);
      
      console.log('🔐 LOGIN RESULT:', {
        success: result.success,
        userEmail: result.user?.email,
        userRole: result.user?.role,
        userRoleType: typeof result.user?.role,
        fullUser: result.user
      });
      
      if (result.success && result.user) {
        // Verify role is present and valid
        if (!result.user.role) {
          console.error('❌ Login response missing role field', result.user);
          toast.error('Login failed: Invalid user data');
          setLoading(false);
          return { success: false, error: 'Invalid user data' };
        }

        // Validate role is one of the expected values
        const validRoles = ['super_admin', 'admin', 'hr', 'manager', 'accountant', 'employee'];
        if (!validRoles.includes(result.user.role)) {
          console.error('❌ Invalid role received:', result.user.role, 'Type:', typeof result.user.role);
          toast.error('Login failed: Invalid user role');
          setLoading(false);
          return { success: false, error: 'Invalid user role' };
        }

        console.log('✅ Login successful - User data:', {
          id: result.user.id,
          email: result.user.email,
          role: result.user.role,
          roleType: typeof result.user.role,
          name: result.user.name
        });

        // Update user state - this will trigger RoleBasedRedirect
        console.log('🔐 Setting user state with role:', result.user.role);
        setUser(result.user);
        setLoading(false);
        setIsInitialized(true); // Mark as initialized so we don't re-fetch
        toast.success(`Welcome back, ${result.user.name}!`);
        
        // Return success - RoleBasedRedirect will handle navigation
        return { success: true };
      }

      setLoading(false);
      return { success: false, error: 'Login failed' };
    } catch (error: any) {
      console.error('❌ Login error:', error);
      
      let errorMessage = 'Login failed. Please try again.';
      
      if (error instanceof ApiError) {
        errorMessage = error.getUserMessage();
      } else if (error.message) {
        errorMessage = error.message;
      }

      toast.error(errorMessage);
      setLoading(false);
      return { success: false, error: errorMessage };
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
    logout: performLogout,
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
  
  if (!user) {
    console.log('⚠️ useRoleRedirect - No user, returning /login');
    return '/login';
  }
  
  let path = '/employee'; // Default fallback
  
  switch (user.role) {
    case 'super_admin':
      path = '/super-admin';
      break;
    case 'admin':
      path = '/admin';
      break;
    case 'employee':
    case 'hr':
    case 'manager':
    case 'accountant':
      path = '/employee';
      break;
    default:
      console.warn('⚠️ useRoleRedirect - Unknown role:', user.role);
      path = '/employee';
  }
  
  console.log('✅ useRoleRedirect - Role:', user.role, 'Path:', path);
  return path;
}
