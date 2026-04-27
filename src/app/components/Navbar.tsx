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

export function Navbar() {
  const { theme, toggleTheme } = useTheme();
  const { user, switchRole, logout } = useAuth();
  const navigate = useNavigate();

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
          
          {/* Demo Role Switcher */}
          <div className="flex items-center gap-1 bg-accent/50 rounded-xl p-1 border border-border/50">
            <Button
              variant={user?.role === 'super_admin' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => {
                switchRole('super_admin');
                navigate('/super-admin');
              }}
              className="rounded-lg text-xs font-medium h-8 px-3"
            >
              Super Admin
            </Button>
            <Button
              variant={user?.role === 'admin' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => {
                switchRole('admin');
                navigate('/admin');
              }}
              className="rounded-lg text-xs font-medium h-8 px-3"
            >
              Admin
            </Button>
            <Button
              variant={user?.role === 'employee' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => {
                switchRole('employee');
                navigate('/employee');
              }}
              className="rounded-lg text-xs font-medium h-8 px-3"
            >
              User
            </Button>
          </div>
          
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
                <span className="absolute top-1 right-1 w-2 h-2 bg-destructive rounded-full"></span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-80">
              <DropdownMenuLabel>Notifications</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <div className="p-4 space-y-3">
                <div 
                  className="flex gap-3 p-3 rounded-lg bg-accent/50 hover:bg-accent cursor-pointer transition-colors"
                  onClick={() => navigate('/admin/leaves')}
                >
                  <div className="w-2 h-2 bg-primary rounded-full mt-2"></div>
                  <div className="flex-1">
                    <p className="text-sm font-medium">New leave request</p>
                    <p className="text-xs text-muted-foreground">Sarah Johnson submitted a leave request</p>
                    <p className="text-xs text-muted-foreground mt-1">2 minutes ago</p>
                  </div>
                </div>
                <div 
                  className="flex gap-3 p-3 rounded-lg hover:bg-accent cursor-pointer transition-colors"
                  onClick={() => navigate('/employee/expenses')}
                >
                  <div className="w-2 h-2 bg-muted rounded-full mt-2"></div>
                  <div className="flex-1">
                    <p className="text-sm font-medium">Expense approved</p>
                    <p className="text-xs text-muted-foreground">Your expense claim #1234 was approved</p>
                    <p className="text-xs text-muted-foreground mt-1">1 hour ago</p>
                  </div>
                </div>
              </div>
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
              <DropdownMenuItem onClick={() => navigate('/employee/profile')}>
                <User className="w-4 h-4 mr-2" />
                Profile
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem className="text-destructive" onClick={async () => {
                await logout();
                navigate('/login');
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
