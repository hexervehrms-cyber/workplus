/**
 * Authentication Context - Production Ready
 * Features: Session persistence, proactive token refresh, role-based routing
 */

import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { AuthService, TokenManager, ApiError, TokenRefreshService } from '../utils/api';
import { socketService, ConnectionState } from '../utils/socket';
import realTimeSocket from '../utils/realTimeSocket';
import { clearApiCache } from '../utils/apiHelper';
import { clearPersistedAttendance } from '../utils/attendancePersistence';
import { isPublicBootstrapPath, hasStoredSessionHint } from '../utils/publicPaths';

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
  const socketWasConnectedRef = useRef(false);

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
      realTimeSocket.disconnect();
      socketWasConnectedRef.current = false;
      
      // Clear localStorage
      localStorage.removeItem('dashboardCache');
      localStorage.removeItem('userPreferences');
      localStorage.removeItem('user');
      localStorage.removeItem('authToken');
      localStorage.removeItem('token');
      localStorage.removeItem('refreshToken');
      localStorage.removeItem('cached_holidays');

      setLoading(false);

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

  const connectSocketsInBackground = useCallback((sessionUser: User) => {
    void (async () => {
      try {
        const connectionPromise = socketService.connect(
          sessionUser.id,
          sessionUser.role,
          sessionUser.tenantId || sessionUser.orgId
        );
        const timeoutPromise = new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Socket connection timeout')), 8000)
        );
        await Promise.race([connectionPromise, timeoutPromise]);

        realTimeSocket.connectFromAuth({
          id: sessionUser.id,
          role: sessionUser.role,
          orgId: sessionUser.orgId,
          tenantId: sessionUser.tenantId || sessionUser.orgId,
        });

        setSocketConnected(socketService.getState() === 'connected');
      } catch (error) {
        console.warn('[AUTH] Socket connect deferred failed:', error);
        setSocketConnected(false);
      }
    })();
  }, []);

  // Socket state callback — registered first so connect() in bootstrap can update UI.
  useEffect(() => {
    let isMounted = true;
    socketService.setStateChangeCallback((state: ConnectionState) => {
      if (!isMounted) return;
      setSocketConnected(state === 'connected');
      if (state === 'connected') {
        socketWasConnectedRef.current = true;
      } else if (state === 'reconnecting') {
        console.log('🔄 [AUTH] Socket reconnecting...');
      } else if (state === 'disconnected' && socketWasConnectedRef.current && userRef.current) {
        console.warn('⚠️ [AUTH] Socket disconnected');
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

    const finish = (sessionUser: User | null) => {
      if (cancelled) return;
      setLoading(false);
      setIsInitialized(true);
      if (sessionUser) connectSocketsInBackground(sessionUser);
    };

    const fetchCurrentUser = async () => {
      const timeoutMs = 8000;
      return Promise.race([
        AuthService.getCurrentUser(),
        new Promise<null>((resolve) => setTimeout(() => resolve(null), timeoutMs)),
      ]);
    };

    const initializeAuth = async () => {
      let userForSocket: User | null = null;

      try {
        await TokenManager.hydrateFromIndexedDB();

        if (
          isPublicBootstrapPath() &&
          !TokenManager.get() &&
          !hasStoredSessionHint()
        ) {
          finish(null);
          return;
        }

        try {
          const currentUser = await fetchCurrentUser();
          if (currentUser) {
            console.log('✅ User restored from Redis session:', {
              id: currentUser.id,
              email: currentUser.email,
              role: currentUser.role
            });
            setUser(currentUser);
            userForSocket = currentUser;
            finish(userForSocket);
            return;
          }
        } catch (error) {
          if (error instanceof ApiError && (error.code === 'TOKEN_EXPIRED' || error.code === 'INVALID_TOKEN')) {
            const recovered = await tryRefreshAccessToken();
            if (recovered) {
              try {
                const retryUser = await fetchCurrentUser();
                if (retryUser) {
                  console.log('✅ User restored after token refresh:', {
                    id: retryUser.id,
                    email: retryUser.email,
                    role: retryUser.role
                  });
                  setUser(retryUser);
                  userForSocket = retryUser;
                  finish(userForSocket);
                  return;
                }
              } catch {
                console.log('No valid session found');
                setUser(null);
                finish(null);
                return;
              }
            } else {
              console.log('Token refresh failed, no session');
              setUser(null);
              finish(null);
              return;
            }
          } else {
            console.warn('Could not verify session with backend:', error);
          }
        }
      } catch (error) {
        console.error('Auth initialization error:', error);
      }

      finish(userForSocket);
    };

    // Only initialize on mount, not after login
    if (!isInitialized) {
      void initializeAuth();
    }

    return () => {
      cancelled = true;
    };
  }, [connectSocketsInBackground, isInitialized]);

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
          if (Date.now() >= exp) {
            const refreshed = await tryRefreshAccessToken();
            if (!refreshed) {
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
          setLoading(false);
          return { success: false, error: 'Invalid user data' };
        }

        // Validate role is one of the expected values
        const validRoles = ['super_admin', 'admin', 'hr', 'manager', 'accountant', 'employee'];
        if (!validRoles.includes(result.user.role)) {
          console.error('❌ Invalid role received:', result.user.role, 'Type:', typeof result.user.role);
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
        setIsInitialized(true);
        connectSocketsInBackground(result.user);

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

      setLoading(false);
      return { success: false, error: errorMessage };
    }
  }, [connectSocketsInBackground]);

  // Switch role (for demo/testing)
  const switchRole = useCallback((role: UserRole) => {
    if (user) {
      const updatedUser = { ...user, role };
      setUser(updatedUser);
      TokenManager.setUser(updatedUser);

      // Reconnect socket with new role
      socketService.disconnect();
      realTimeSocket.disconnect();
      socketService.connect(user.id, role, user.tenantId)
        .then(() => {
          realTimeSocket.connectFromAuth({
            id: user.id,
            role,
            orgId: user.orgId,
            tenantId: user.tenantId || user.orgId
          });
          setSocketConnected(true);
        })
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
