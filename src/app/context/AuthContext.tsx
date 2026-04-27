import React, { createContext, useContext, useState, useEffect } from 'react';
import { AuthService } from '../utils/api';
import { socketService } from '../utils/socket';

export type UserRole = 'super_admin' | 'admin' | 'hr' | 'manager' | 'accountant' | 'employee';

interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  avatar?: string;
  organization?: string;
  tenantId?: string;
}

interface AuthContextType {
  user: User | null;
  setUser: (user: User | null) => void;
  login: (email: string, password: string) => Promise<boolean>;
  logout: () => Promise<void>;
  switchRole: (role: UserRole) => void;
  loading: boolean;
  socketConnected: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(false);
  const [socketConnected, setSocketConnected] = useState(false);

  // Check for existing token on mount
  useEffect(() => {
    const token = localStorage.getItem('authToken');
    const userStr = localStorage.getItem('user');
    
    if (token && userStr) {
      try {
        const userData = JSON.parse(userStr);
        setUser(userData);
      } catch (error) {
        console.error('Failed to parse user data:', error);
        localStorage.removeItem('authToken');
        localStorage.removeItem('user');
      }
    } else if (token) {
      // Fallback: fetch user from API if token exists but no user data
      AuthService.getCurrentUser()
        .then(userData => {
          if (userData) {
            setUser(userData);
            localStorage.setItem('user', JSON.stringify(userData));
          }
        })
        .catch(() => {
          localStorage.removeItem('authToken');
        });
    }
  }, []);

  // Socket.IO connection management
  useEffect(() => {
    if (user) {
      socketService.connect(user.id, user.role)
        .then(() => {
          setSocketConnected(true);
        })
        .catch((error) => {
          console.error('Failed to connect to Socket.IO server:', error);
        });

      return () => {
        socketService.disconnect();
        setSocketConnected(false);
      };
    }
  }, [user]);

  const login = async (email: string, password: string): Promise<boolean> => {
    setLoading(true);
    try {
      const result = await AuthService.login(email, password);
      if (result.success && result.user) {
        setUser(result.user);
        // Store user in localStorage for persistence
        localStorage.setItem('user', JSON.stringify(result.user));
        return true;
      }
      return false;
    } catch (error) {
      console.error('Login error:', error);
      return false;
    } finally {
      setLoading(false);
    }
  };

  const logout = async (): Promise<void> => {
    setLoading(true);
    try {
      await AuthService.logout();
      setUser(null);
      socketService.disconnect();
      setSocketConnected(false);
      // Clear all auth data
      localStorage.removeItem('authToken');
      localStorage.removeItem('user');
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      setLoading(false);
    }
  };
const switchRole = (role: UserRole): void => {
    if (user) {
      const updatedUser = { ...user, role };
      setUser(updatedUser);
      localStorage.setItem('user', JSON.stringify(updatedUser));
      // Reconnect socket with new role
      socketService.disconnect();
      socketService.connect(user.id, role)
        .then(() => {
          setSocketConnected(true);
        })
        .catch((error) => {
          console.error('Failed to reconnect to Socket.IO server:', error);
        });
    }
  };

  
  return (
    <AuthContext.Provider value={{ user, setUser, login, logout, switchRole, loading, socketConnected }}>
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
