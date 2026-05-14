import { Link, useLocation, useNavigate } from 'react-router';
import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import {
  LayoutDashboard,
  Users,
  Building2,
  Activity,
  Megaphone,
  BarChart3,
  FileText,
  UserCircle,
  Calendar,
  CalendarDays,
  Clock,
  TrendingUp,
  DollarSign,
  Receipt,
  MessageSquare,
  Bell,
  Settings,
  Shield,
  Briefcase,
  Target,
  Award,
  ShieldCheck,
  FolderOpen,
  ChevronDown,
  Phone,
  Zap,
  ChevronLeft
} from 'lucide-react';

interface NavItem {
  icon: any;
  label: string;
  path: string;
  roles: string[];
  children?: NavItem[];
}

const navigationItems: NavItem[] = [
  // Super Admin
  { icon: LayoutDashboard, label: 'Control Room', path: '/super-admin', roles: ['super_admin'] },
  { icon: ShieldCheck, label: 'Role Management', path: '/super-admin/role-management', roles: ['super_admin'] },
  { icon: Building2, label: 'Organizations', path: '/super-admin/organizations', roles: ['super_admin'] },
  { icon: Users, label: 'Global Users', path: '/super-admin/users', roles: ['super_admin'] },
  { icon: Building2, label: 'Departments', path: '/super-admin/departments', roles: ['super_admin'] },
  { icon: Activity, label: 'Live Activity', path: '/super-admin/activity', roles: ['super_admin'] },
  { icon: Megaphone, label: 'Announcements', path: '/super-admin/announcements', roles: ['super_admin'] },
  { icon: BarChart3, label: 'Analytics', path: '/super-admin/analytics', roles: ['super_admin'] },
  { icon: FileText, label: 'Audit Logs', path: '/super-admin/audit', roles: ['super_admin'] },
  { icon: MessageSquare, label: 'Client Chat', path: '/super-admin/chat', roles: ['super_admin'] },
  
  // Admin
  { icon: LayoutDashboard, label: 'Dashboard', path: '/admin', roles: ['admin'] },
  { icon: Users, label: 'Employees', path: '/admin/employees', roles: ['admin'] },
  { icon: Users, label: 'Admin Management', path: '/admin/admin-management', roles: ['admin'] },
  { icon: FolderOpen, label: 'Company Docs', path: '/admin/company-docs', roles: ['admin'] },
  { icon: Building2, label: 'Departments', path: '/admin/departments', roles: ['admin'] },
  { icon: ShieldCheck, label: 'Roles', path: '/admin/roles', roles: ['admin'] },
  { 
    icon: Calendar, 
    label: 'Leave Management', 
    path: '/admin/leaves', 
    roles: ['admin'],
    children: [
      { icon: CalendarDays, label: 'Holiday Calendar', path: '/admin/holiday-calendar', roles: ['admin'] },
      { icon: FileText, label: 'Leave Requests', path: '/admin/leaves', roles: ['admin'] },
      { icon: Zap, label: 'Leave Allocation', path: '/admin/leave-allocation', roles: ['admin'] }
    ]
  },
  { icon: Clock, label: 'Attendance', path: '/admin/attendance', roles: ['admin'] },
  { 
    icon: Zap, 
    label: 'Sales', 
    path: '/admin/sales', 
    roles: ['admin'],
    children: [
      { icon: BarChart3, label: 'Dashboard', path: '/admin/sales', roles: ['admin'] },
      { icon: Target, label: 'Leads', path: '/admin/sales/leads', roles: ['admin'] },
      { icon: TrendingUp, label: 'Deals', path: '/admin/sales/deals', roles: ['admin'] },
      { icon: Phone, label: 'Calls', path: '/admin/sales/calls', roles: ['admin'] }
    ]
  },
  { icon: Receipt, label: 'Expenses', path: '/admin/expenses', roles: ['admin'] },
  { icon: DollarSign, label: 'Payroll', path: '/admin/payroll', roles: ['admin'] },
  { icon: Megaphone, label: 'Announcements', path: '/admin/announcements', roles: ['admin'] },
  { icon: MessageSquare, label: 'Team Chat', path: '/admin/chat', roles: ['admin'] },
  
  // Employee
  { icon: LayoutDashboard, label: 'Dashboard', path: '/employee', roles: ['employee', 'hr', 'manager', 'accountant'] },
  { icon: UserCircle, label: 'My Profile', path: '/employee/profile', roles: ['employee', 'hr', 'manager', 'accountant'] },
  { icon: FolderOpen, label: 'Company Docs', path: '/employee/company-docs', roles: ['employee', 'hr', 'manager', 'accountant'] },
  { 
    icon: Calendar, 
    label: 'Leave', 
    path: '/employee/leave', 
    roles: ['employee', 'hr', 'manager', 'accountant']
  },
  { icon: Clock, label: 'Attendance', path: '/employee/attendance', roles: ['employee', 'hr', 'manager', 'accountant'] },
  { icon: TrendingUp, label: 'Performance', path: '/employee/performance', roles: ['employee', 'hr', 'manager', 'accountant'] },
  { icon: DollarSign, label: 'Payroll', path: '/employee/payroll', roles: ['employee', 'hr', 'manager', 'accountant'] },
  { icon: Receipt, label: 'Expenses', path: '/employee/expenses', roles: ['employee', 'hr', 'manager', 'accountant'] },
  { icon: MessageSquare, label: 'Chat', path: '/employee/chat', roles: ['employee', 'hr', 'manager', 'accountant'] },
];

export function Sidebar() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());
  const [isCollapsed, setIsCollapsed] = useState(false);

  const filteredNavItems = navigationItems.filter(item => 
    user && item.roles.includes(user.role)
  );

  const toggleExpanded = (itemPath: string) => {
    setExpandedItems((prev: Set<string>) => {
      const newSet = new Set(prev);
      if (newSet.has(itemPath)) {
        newSet.delete(itemPath);
      } else {
        newSet.add(itemPath);
      }
      return newSet;
    });
  };

  return (
    <aside className={`${isCollapsed ? 'w-20' : 'w-64'} bg-card border-r border-border h-screen sticky top-0 flex flex-col transition-all duration-300`}>
      {/* Logo */}
      <div className="p-6 border-b border-border">
        <Link 
          to="/" 
          className="flex items-center gap-3"
          onClick={(e) => {
            e.preventDefault();
            if (user?.role === 'super_admin') {
              navigate('/super-admin');
            } else if (user?.role === 'admin') {
              navigate('/admin');
            } else {
              navigate('/employee');
            }
          }}
        >
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-secondary flex items-center justify-center flex-shrink-0">
            <Briefcase className="w-6 h-6 text-white" />
          </div>
          {!isCollapsed && (
            <div>
              <h1 className="text-xl font-bold text-foreground">WorkPlus Pro</h1>
              <p className="text-xs text-muted-foreground">
                {user?.role === 'super_admin' ? 'Super Admin' : 
                 user?.role === 'admin' ? 'Admin Panel' : 'Employee Portal'}
              </p>
            </div>
          )}
        </Link>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto p-4 space-y-1">
        {filteredNavItems.map((item) => {
          const Icon = item.icon;
          const hasChildren = item.children && item.children.length > 0;
          const isExpanded = expandedItems.has(item.path);
          const isActive = location.pathname === item.path || 
                     (item.path !== '/super-admin' && item.path !== '/admin' && item.path !== '/employee' && location.pathname.startsWith(item.path));
          
          // Check if any child is active
          const isChildActive = hasChildren && item.children!.some(child => 
            location.pathname === child.path || location.pathname.startsWith(child.path)
          );
          
          return (
            <div key={item.path}>
              <div
                className={`
                  flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 cursor-pointer
                  ${isActive || isChildActive
                    ? 'bg-primary text-primary-foreground shadow-lg shadow-primary/25' 
                    : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
                  }
                `}
                onClick={() => {
                  if (hasChildren) {
                    toggleExpanded(item.path);
                  } else {
                    navigate(item.path);
                  }
                }}
                title={isCollapsed ? item.label : ''}
              >
                <Icon className="w-5 h-5 flex-shrink-0" />
                {!isCollapsed && (
                  <>
                    <span className="font-medium flex-1">{item.label}</span>
                    {hasChildren && (
                      <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`} />
                    )}
                  </>
                )}
              </div>
              
              {!isCollapsed && hasChildren && isExpanded && (
                <div className="ml-4 mt-1 space-y-1">
                  {item.children!.map((child) => {
                    const ChildIcon = child.icon;
                    const isChildActive = location.pathname === child.path || location.pathname.startsWith(child.path);
                    
                    return (
                      <Link
                        key={child.path}
                        to={child.path}
                        className={`
                          flex items-center gap-3 px-4 py-2 rounded-lg transition-all duration-200
                          ${isChildActive
                            ? 'bg-primary/20 text-primary' 
                            : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
                          }
                        `}
                      >
                        <ChildIcon className="w-4 h-4" />
                        <span className="text-sm font-medium">{child.label}</span>
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="p-4 border-t border-border space-y-1">
        <button
          onClick={() => {
            if (user?.role === 'admin') {
              navigate('/admin/settings');
            } else if (user?.role === 'super_admin') {
              navigate('/super-admin');
            } else {
              navigate('/employee/settings');
            }
          }}
          className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-all"
          title={isCollapsed ? 'Settings' : ''}
        >
          <Settings className="w-5 h-5 flex-shrink-0" />
          {!isCollapsed && <span className="font-medium">Settings</span>}
        </button>
        
        {/* Collapse Button */}
        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-all"
          title={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          <ChevronLeft className={`w-5 h-5 flex-shrink-0 transition-transform duration-300 ${isCollapsed ? 'rotate-180' : ''}`} />
          {!isCollapsed && <span className="font-medium">Collapse</span>}
        </button>
      </div>
    </aside>
  );
}
