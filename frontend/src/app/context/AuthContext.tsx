/**
 * Authentication Context - Production Ready
 * Features: Session persistence, proactive token refresh, role-based routing
 */

import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { AuthService, TokenManager, ApiError } from '../utils/api';
import { socketService, ConnectionState } from '../utils/socket';
import realTimeSocket from '../utils/realTimeSocket';
import { clearApiCache, clearAllHolidayCaches } from '../utils/apiHelper';
import {
  ensureAccessToken,
  refreshAccessToken,
  hydrateAccessToken,
  isRefreshEndpointUnavailable,
} from '../utils/sessionAuth';
import { getRefreshTokenMirror } from '../utils/sessionAccessMirror';
import { clearPersistedAttendance } from '../utils/attendancePersistence';
import { clearUserScopedLocalStorage } from '../utils/userScopedStorage';
import { broadcastUserSessionCleared } from '../utils/clientSessionSync';
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

// Proactive JWT refresh (access token TTL is 15m on server)
const SESSION_CHECK_INTERVAL = 4 * 60 * 1000;

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
      localStorage.removeItem('wp_session_hint');
      localStorage.removeItem('cached_holidays');
      clearAllHolidayCaches();

      clearUserScopedLocalStorage(uid);
      clearApiCache();
      broadcastUserSessionCleared();

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
        await ensureAccessToken();
        const socketUserId = String(sessionUser.userId || sessionUser.id);
        const connectionPromise = socketService.connect(
          socketUserId,
          sessionUser.role,
          sessionUser.tenantId || sessionUser.orgId
        );
        const timeoutPromise = new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Socket connection timeout')), 8000)
        );
        await Promise.race([connectionPromise, timeoutPromise]);

        realTimeSocket.connectFromAuth({
          id: socketUserId,
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
      const token = await refreshAccessToken();
      return !!token;
    };

    const finish = (sessionUser: User | null) => {
      if (cancelled) return;
      setLoading(false);
      setIsInitialized(true);
      if (sessionUser) connectSocketsInBackground(sessionUser);
    };

    const fetchCurrentUser = async () => {
      const timeoutMs = 15000;
      return Promise.race([
        AuthService.getCurrentUser(),
        new Promise<null>((resolve) => setTimeout(() => resolve(null), timeoutMs))
      ]);
    };

    const initializeAuth = async () => {
      let userForSocket: User | null = null;

      try {
        await TokenManager.hydrateFromIndexedDB();

        if (
          isPublicBootstrapPath() &&
          !TokenManager.get() &&
          !hasStoredSessionHint() &&
          !getRefreshTokenMirror()
        ) {
          finish(null);
          return;
        }

        try {
          let currentUser = await fetchCurrentUser();
          if (!currentUser && (TokenManager.get() || getRefreshTokenMirror())) {
            await tryRefreshAccessToken();
            await ensureAccessToken();
            currentUser = await fetchCurrentUser();
          }
          if (currentUser) {
            if (!TokenManager.get()) {
              await tryRefreshAccessToken();
            }
            await ensureAccessToken();
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
                  await ensureAccessToken();
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
            } else if (getRefreshTokenMirror()) {
              console.warn('[AUTH] Refresh token present but session restore failed');
              setUser(null);
              finish(null);
              return;
            } else {
              console.log('Token refresh failed, no session');
              setUser(null);
              finish(null);
              return;
            }
          } else {
            console.warn('Could not verify session with backend:', error);
            if (getRefreshTokenMirror()) {
              const recovered = await tryRefreshAccessToken();
              if (recovered) {
                try {
                  const retryUser = await fetchCurrentUser();
                  if (retryUser) {
                    await ensureAccessToken();
                    setUser(retryUser);
                    userForSocket = retryUser;
                    finish(userForSocket);
                    return;
                  }
                } catch {
                  /* fall through */
                }
              }
            }
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

    const checkSession = () => {
      void (async () => {
        await hydrateAccessToken();
        if (!TokenManager.get() && !getRefreshTokenMirror()) {
          return;
        }
        if (isRefreshEndpointUnavailable()) {
          return;
        }
        try {
          await ensureAccessToken();
        } catch (error) {
          console.warn('[AUTH] Proactive refresh failed (not logging out):', error);
        }
      })();
    };

    const interval = setInterval(checkSession, SESSION_CHECK_INTERVAL);
    return () => clearInterval(interval);
  }, [user]);

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
        const userRole = String(result.user.role) as UserRole;
        if (!validRoles.includes(userRole)) {
          console.error('❌ Invalid role received:', userRole, 'Type:', typeof userRole);
          setLoading(false);
          return { success: false, error: 'Invalid user role' };
        }

        const normalizedUser: User = {
          id: String(result.user.id),
          userId: result.user.userId != null ? String(result.user.userId) : undefined,
          name: String(result.user.name ?? ''),
          email: String(result.user.email ?? ''),
          role: userRole,
          avatar: result.user.avatar != null ? String(result.user.avatar) : undefined,
          organization: result.user.organization != null ? String(result.user.organization) : undefined,
          tenantId: result.user.tenantId != null ? String(result.user.tenantId) : undefined,
          orgId: result.user.orgId != null ? String(result.user.orgId) : undefined,
          employeeId: result.user.employeeId != null ? String(result.user.employeeId) : undefined,
          employeeCode: result.user.employeeCode != null ? String(result.user.employeeCode) : undefined,
        };

        console.log('✅ Login successful - User data:', {
          id: normalizedUser.id,
          email: normalizedUser.email,
          role: normalizedUser.role,
          roleType: typeof normalizedUser.role,
          name: normalizedUser.name
        });

        // Update user state - this will trigger RoleBasedRedirect
        console.log('🔐 Setting user state with role:', normalizedUser.role);
        clearUserScopedLocalStorage(normalizedUser.id);
        setUser(normalizedUser);
        setLoading(false);
        setIsInitialized(true);
        clearApiCache();
        connectSocketsInBackground(normalizedUser);

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

  // UI-only role preview (JWT / API always use server-assigned role; disabled in production builds)
  const switchRole = useCallback((role: UserRole) => {
    if (!import.meta.env.DEV) {
      return;
    }
    if (!user) return;

    const token = TokenManager.get();
    let jwtRole: UserRole = user.role;
    if (token) {
      try {
        const payload = JSON.parse(atob(token.split('.')[1])) as { role?: UserRole };
        if (payload.role) jwtRole = payload.role;
      } catch {
        /* use stored role */
      }
    }

    const updatedUser = { ...user, role };
    setUser(updatedUser);
    TokenManager.setUser(updatedUser);
    clearApiCache();

    socketService.disconnect();
    realTimeSocket.disconnect();
    const tenant = user.tenantId || user.orgId;
    socketService
      .connect(user.id, jwtRole, tenant)
      .then(() => {
        realTimeSocket.connectFromAuth({
          id: user.id,
          role: jwtRole,
          orgId: user.orgId,
          tenantId: tenant
        });
        setSocketConnected(true);
      })
      .catch((error) => {
        console.error('Failed to reconnect socket:', error);
        setSocketConnected(false);
      });
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
    case 'hr':
      path = '/admin';
      break;
    case 'employee':
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
