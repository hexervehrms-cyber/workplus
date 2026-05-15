import { Search, Bell, Moon, Sun, ChevronDown, LogOut, User } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Avatar, AvatarFallback, AvatarImage } from './ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from './ui/dropdown-menu';
import { Badge } from './ui/badge';
import CurrencyChanger from './CurrencyChanger';
import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { buildApiUrl } from '../utils/apiHelper';
import { socketService } from '../utils/socket';

interface Notification {
  _id: string;
  title: string;
  message: string;
  type: string;
  priority: string;
  isRead: boolean;
  createdAt: string;
  actionUrl?: string;
  readAt?: string;
}

function profilePathForRole(role: string | undefined): string {
  switch (role) {
    case 'admin':
      return '/admin/settings';
    case 'super_admin':
      return '/settings';
    case 'employee':
    case 'hr':
    case 'manager':
    case 'accountant':
    default:
      return '/employee/profile';
  }
}

export function Navbar() {
  const { theme, toggleTheme } = useTheme();
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);

  // Fetch notifications
  const fetchNotifications = async () => {
    try {
      setLoading(true);
      
      const response = await fetch(buildApiUrl('/notifications?limit=10&status=all'), {
        credentials: 'include',  // ✅ Send httpOnly cookies
        headers: {
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const result = await response.json();
        if (result.success && result.data) {
          setNotifications(result.data.notifications || []);
          setUnreadCount(result.data.unreadCount || 0);
        }
      } else if (response.status === 401) {
        // Unauthorized - user session expired
        console.warn('Notifications: Session expired');
      }
    } catch (error) {
      console.error('Failed to fetch notifications:', error);
    } finally {
      setLoading(false);
    }
  };

  // Mark notification as read
  const markAsRead = async (notificationId: string) => {
    try {
      const response = await fetch(buildApiUrl(`/notifications/${notificationId}/read`), {
        method: 'PATCH',
        credentials: 'include',  // ✅ Send httpOnly cookies
        headers: {
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        // Update local state
        setNotifications(prev => 
          prev.map(n => n._id === notificationId ? { ...n, isRead: true, readAt: new Date().toISOString() } : n)
        );
        setUnreadCount(prev => Math.max(0, prev - 1));
      }
    } catch (error) {
      console.error('Failed to mark notification as read:', error);
    }
  };

  // Mark all as read
  const markAllAsRead = async () => {
    try {
      const response = await fetch(buildApiUrl('/notifications/mark-all-read'), {
        method: 'PATCH',
        credentials: 'include',  // ✅ Send httpOnly cookies
        headers: {
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        setNotifications(prev => 
          prev.map(n => ({ ...n, isRead: true, readAt: new Date().toISOString() }))
        );
        setUnreadCount(0);
        toast.success('All notifications marked as read');
      }
    } catch (error) {
      console.error('Failed to mark all as read:', error);
      toast.error('Failed to mark all as read');
    }
  };

  // Handle notification click
  const handleNotificationClick = (notification: Notification) => {
    // Mark as read
    if (!notification.isRead) {
      markAsRead(notification._id);
    }

    // Navigate to action URL if available
    if (notification.actionUrl) {
      navigate(notification.actionUrl);
    } else {
      // Default navigation based on type
      switch (notification.type) {
        case 'leave_request':
        case 'leave_approved':
        case 'leave_rejected':
          navigate(user?.role === 'employee' ? '/employee/leave' : '/admin/leaves');
          break;
        case 'expense_submitted':
        case 'expense_approved':
        case 'expense_rejected':
          navigate(user?.role === 'employee' ? '/employee/expenses' : '/admin/expenses');
          break;
        case 'payroll_generated':
          navigate(user?.role === 'employee' ? '/employee/payroll' : '/admin/payroll');
          break;
        case 'attendance_reminder':
          navigate('/employee/attendance');
          break;
        default:
          break;
      }
    }
  };

  // Format time ago
  const formatTimeAgo = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (seconds < 60) return 'Just now';
    if (seconds < 3600) return `${Math.floor(seconds / 60)} minutes ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)} hours ago`;
    if (seconds < 604800) return `${Math.floor(seconds / 86400)} days ago`;
    return date.toLocaleDateString();
  };

  // Get notification icon color based on type
  const getNotificationColor = (notification: Notification) => {
    if (!notification.isRead) return 'bg-primary';
    return 'bg-muted';
  };

  // Fetch notifications on mount, poll, and listen for real-time socket events
  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 30000);

    const onSocketNotification = (payload: {
      id?: string;
      _id?: string;
      title?: string;
      message?: string;
      type?: string;
      priority?: string;
      createdAt?: string;
      actionUrl?: string;
    }) => {
      const id = payload.id || payload._id;
      if (!id || !payload.title) {
        fetchNotifications();
        return;
      }
      setNotifications((prev) => {
        if (prev.some((n) => n._id === String(id))) return prev;
        const entry: Notification = {
          _id: String(id),
          title: payload.title!,
          message: payload.message || '',
          type: payload.type || 'announcement',
          priority: payload.priority || 'medium',
          isRead: false,
          createdAt: payload.createdAt || new Date().toISOString(),
          actionUrl: payload.actionUrl
        };
        return [entry, ...prev].slice(0, 10);
      });
      setUnreadCount((c) => c + 1);
    };

    socketService.on('notification', onSocketNotification);
    socketService.on('notification:received', onSocketNotification);

    return () => {
      clearInterval(interval);
      socketService.off('notification', onSocketNotification);
      socketService.off('notification:received', onSocketNotification);
    };
  }, []);

  return (
    <header className="h-16 border-b border-border bg-card/50 backdrop-blur-xl sticky top-0 z-40">
      <div className="h-full px-6 flex items-center justify-between gap-4">
        {/* Search */}
        <div className="flex-1 max-w-md">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search anything..."
              className="pl-10 bg-background/50 border-border/50 rounded-xl"
            />
          </div>
        </div>

        {/* Right Actions */}
        <div className="flex items-center gap-3">
          {/* Currency Changer */}
          <CurrencyChanger />
          
          {/* Theme Toggle */}
          <Button
            variant="ghost"
            size="icon"
            onClick={toggleTheme}
            className="rounded-xl"
          >
            {theme === 'light' ? (
              <Moon className="w-5 h-5" />
            ) : (
              <Sun className="w-5 h-5" />
            )}
          </Button>

          {/* Notifications */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="rounded-xl relative">
                <Bell className="w-5 h-5" />
                {unreadCount > 0 && (
                  <span className="absolute top-1 right-1 w-5 h-5 bg-destructive text-white text-xs rounded-full flex items-center justify-center">
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-96">
              <div className="flex items-center justify-between px-4 py-2">
                <DropdownMenuLabel className="p-0">Notifications</DropdownMenuLabel>
                {unreadCount > 0 && (
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="h-auto py-1 px-2 text-xs"
                    onClick={markAllAsRead}
                  >
                    Mark all read
                  </Button>
                )}
              </div>
              <DropdownMenuSeparator />
              <div className="max-h-[400px] overflow-y-auto">
                {loading ? (
                  <div className="p-8 text-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
                  </div>
                ) : notifications.length === 0 ? (
                  <div className="p-8 text-center">
                    <Bell className="w-12 h-12 text-muted-foreground mx-auto mb-2" />
                    <p className="text-sm text-muted-foreground">No notifications</p>
                  </div>
                ) : (
                  <div className="p-2 space-y-1">
                    {notifications.map((notification) => (
                      <div
                        key={notification._id}
                        className={`flex gap-3 p-3 rounded-lg hover:bg-accent cursor-pointer transition-colors ${
                          !notification.isRead ? 'bg-accent/50' : ''
                        }`}
                        onClick={() => handleNotificationClick(notification)}
                      >
                        <div className={`w-2 h-2 rounded-full mt-2 flex-shrink-0 ${getNotificationColor(notification)}`}></div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{notification.title}</p>
                          <p className="text-xs text-muted-foreground line-clamp-2">{notification.message}</p>
                          <p className="text-xs text-muted-foreground mt-1">{formatTimeAgo(notification.createdAt)}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              {notifications.length > 0 && (
                <>
                  <DropdownMenuSeparator />
                  <div className="p-2">
                    <Button 
                      variant="ghost" 
                      className="w-full text-sm"
                      onClick={() => navigate('/notifications')}
                    >
                      View all notifications
                    </Button>
                  </div>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* User Menu */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="rounded-xl gap-3 h-auto py-2 px-3">
                <Avatar className="w-8 h-8">
                  <AvatarImage src={user?.avatar} />
                  <AvatarFallback>{user?.name?.charAt(0)}</AvatarFallback>
                </Avatar>
                <div className="text-left">
                  <p className="text-sm font-medium">{user?.name}</p>
                  <p className="text-xs text-muted-foreground capitalize">{user?.role.replace('_', ' ')}</p>
                </div>
                <ChevronDown className="w-4 h-4 text-muted-foreground" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>My Account</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => navigate(profilePathForRole(user?.role))}>
                <User className="w-4 h-4 mr-2" />
                Profile
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem className="text-destructive" onClick={async () => {
                try {
                  await logout();
                } catch (error) {
                  console.error('Logout error:', error);
                } finally {
                  // Force redirect to login regardless of logout result
                  window.location.href = '/login';
                }
              }}>
                <LogOut className="w-4 h-4 mr-2" />
                Logout
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
}
