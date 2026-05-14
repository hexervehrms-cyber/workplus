/**
 * Login Page - Production Ready
 * Features: Secure authentication, error handling, loading states
 */

import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router';
import { useAuth, useRoleRedirect } from '../context/AuthContext';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '../components/ui/card';
import { Alert, AlertDescription } from '../components/ui/alert';
import { Briefcase, Loader2, AlertCircle, Eye, EyeOff } from 'lucide-react';
import { ApiError } from '../utils/api';

const REMEMBER_EMAIL_KEY = 'workplus_login_email';
const LOGIN_ATTEMPTS_KEY = 'workplus_login_attempts_ts';

function recordLoginAttempt(): { ok: boolean; retryAfterMs?: number } {
  const now = Date.now();
  const windowMs = 60_000;
  const maxAttempts = 12;
  try {
    const raw = sessionStorage.getItem(LOGIN_ATTEMPTS_KEY);
    const times: number[] = raw ? JSON.parse(raw).filter((t: number) => now - t < windowMs) : [];
    if (times.length >= maxAttempts) {
      const oldest = Math.min(...times);
      return { ok: false, retryAfterMs: windowMs - (now - oldest) };
    }
    times.push(now);
    sessionStorage.setItem(LOGIN_ATTEMPTS_KEY, JSON.stringify(times));
    return { ok: true };
  } catch {
    sessionStorage.setItem(LOGIN_ATTEMPTS_KEY, JSON.stringify([now]));
    return { ok: true };
  }
}

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  
  const navigate = useNavigate();
  const location = useLocation();
  const { login, user, loading: authLoading } = useAuth();
  const roleRedirect = useRoleRedirect();

  // Redirect if already logged in
  useEffect(() => {
    if (user && !authLoading) {
      const from = (location.state as any)?.from?.pathname || roleRedirect;
      console.log('🔄 User already logged in, redirecting to:', from, 'Role:', user.role, 'User:', user);
      navigate(from, { replace: true });
    }
  }, [user, authLoading, navigate, location.state, roleRedirect]);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(REMEMBER_EMAIL_KEY);
      if (saved) {
        setEmail(saved);
        setRememberMe(true);
      }
    } catch {
      /* ignore */
    }
  }, []);

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    const limit = recordLoginAttempt();
    if (!limit.ok) {
      const waitSec = Math.max(1, Math.ceil((limit.retryAfterMs || 60_000) / 1000));
      setError(`Too many sign-in attempts. Please wait about ${waitSec} seconds and try again.`);
      setLoading(false);
      return;
    }

    // Validate inputs
    if (!email.trim()) {
      setError('Please enter your email address');
      setLoading(false);
      return;
    }

    if (!password) {
      setError('Please enter your password');
      setLoading(false);
      return;
    }

    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      setError('Please enter a valid email address');
      setLoading(false);
      return;
    }

    try {
      const result = await login(email.trim().toLowerCase(), password);

      console.log('🔐 Login result:', {
        success: result.success,
        error: result.error
      });

      if (result.success) {
        console.log('✅ Login successful, waiting for redirect...');
        try {
          if (rememberMe) {
            localStorage.setItem(REMEMBER_EMAIL_KEY, email.trim().toLowerCase());
          } else {
            localStorage.removeItem(REMEMBER_EMAIL_KEY);
          }
        } catch {
          /* ignore */
        }
      } else {
        setError(result.error || 'Invalid email or password');
        setPassword('');
        requestAnimationFrame(() => document.getElementById('password')?.focus());
        setLoading(false);
      }
    } catch (err: any) {
      console.error('Login submission error:', err);

      if (err instanceof ApiError) {
        setError(err.getUserMessage());
      } else {
        setError('An unexpected error occurred. Please try again.');
      }
      setPassword('');
      requestAnimationFrame(() => document.getElementById('password')?.focus());
      setLoading(false);
    }
  };

  // Show loading while checking auth state
  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-primary mx-auto" />
          <p className="mt-4 text-muted-foreground">Checking session...</p>
        </div>
      </div>
    );
  }

  // Don't render login form if already authenticated
  if (user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-primary mx-auto" />
          <p className="mt-4 text-muted-foreground">Redirecting...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-primary/5 p-4">
      <Card className="w-full max-w-md shadow-xl border-primary/10">
        <CardHeader className="text-center space-y-4">
          <div className="flex justify-center">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-primary to-primary/80 flex items-center justify-center shadow-lg shadow-primary/25">
              <Briefcase className="w-8 h-8 text-primary-foreground" />
            </div>
          </div>
          <div>
            <CardTitle className="text-2xl font-bold">WorkPlus Pro</CardTitle>
            <CardDescription className="text-base mt-1">
              Sign in to your HRMS dashboard
            </CardDescription>
          </div>
        </CardHeader>
        
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <p className="sr-only">
              Sign-in uses your email and password. CSRF for API routes is optional when using JWT; the backend may enable it with ENABLE_CSRF.
            </p>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Enter your email"
                required
                disabled={loading}
                autoComplete="email"
                autoFocus
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  required
                  disabled={loading}
                  autoComplete="current-password"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                  onClick={() => setShowPassword(!showPassword)}
                  tabIndex={-1}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  aria-pressed={showPassword}
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <Eye className="h-4 w-4 text-muted-foreground" />
                  )}
                </Button>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <input
                id="remember-me"
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                disabled={loading}
                className="h-4 w-4 rounded border border-border"
              />
              <Label htmlFor="remember-me" className="text-sm font-normal cursor-pointer">
                Remember my email on this device
              </Label>
            </div>

            {error && (
              <Alert variant="destructive" className="animate-in fade-in-0 slide-in-from-top-2">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <Button 
              type="submit" 
              className="w-full" 
              disabled={loading}
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Signing in...
                </>
              ) : (
                'Sign In'
              )}
            </Button>
          </form>
        </CardContent>

        <CardFooter className="pt-0">
          <p className="text-xs text-center text-muted-foreground w-full">
            Contact your administrator for account access
          </p>
        </CardFooter>
      </Card>
    </div>
  );
}
