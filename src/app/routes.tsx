import { createBrowserRouter, Navigate } from 'react-router';
import { MainLayout } from './layouts/MainLayout';
import { ProtectedRoute } from './components/ProtectedRoute';
import Login from './pages/Login';

// Super Admin Pages
import SuperAdminDashboard from './pages/super-admin/Dashboard';
import RoleManagement from './pages/super-admin/RoleManagement';
import Organizations from './pages/super-admin/Organizations';
import GlobalUsers from './pages/super-admin/Users';
import SuperAdminDepartments from './pages/super-admin/Departments';
import LiveActivity from './pages/super-admin/Activity';
import Announcements from './pages/super-admin/Announcements';
import Analytics from './pages/super-admin/Analytics';
import AuditLogs from './pages/super-admin/Audit';
import SuperAdminChat from './pages/super-admin/Chat';

// Admin Pages
import AdminDashboard from './pages/admin/Dashboard';
import Employees from './pages/admin/Employees';
import InviteManagement from './pages/admin/InviteManagement';
import AdminDepartments from './pages/admin/Departments';
import LeaveRequests from './pages/admin/LeaveRequests';
import LeaveManagement from './pages/admin/LeaveManagement';
import AttendanceAdmin from './pages/admin/Attendance';
import ExpensesAdmin from './pages/admin/Expenses';
import ExpenseManagement from './pages/admin/ExpenseManagement';
import AnnouncementsAdmin from './pages/admin/Announcements';
import AdminChat from './pages/admin/Chat';
import HREmployeeOnboarding from './pages/admin/EmployeeOnboarding';
import AdminCompanyDocs from './pages/admin/CompanyDocs';
import AdminHolidayCalendar from './pages/admin/HolidayCalendar';
import AdminPayroll from './pages/admin/Payroll';

// Employee Pages
import EmployeeDashboard from './pages/employee/Dashboard';
import Profile from './pages/employee/Profile';
import Leave from './pages/employee/Leave';
import Attendance from './pages/employee/Attendance';
import Performance from './pages/employee/Performance';
import Payroll from './pages/employee/Payroll';
import Expenses from './pages/employee/Expenses';
import Chat from './pages/employee/Chat';
import EmployeeOnboarding from './pages/employee/OnboardingForm';
import EmployeeCompanyDocs from './pages/employee/CompanyDocs';
import EmployeeHolidayCalendarPage from './pages/employee/HolidayCalendar';

// Public Pages
import Onboarding from './pages/public/Onboarding';

export const router = createBrowserRouter([
  {
    path: '/login',
    element: <Login />,
  },
  {
    path: '/',
    element: (
      <ProtectedRoute>
        <MainLayout />
      </ProtectedRoute>
    ),
    children: [
      // Redirect root to appropriate dashboard based on user role
      { index: true, element: <Navigate to="/employee" replace /> },
      
      // Super Admin Routes
      { 
        path: 'super-admin/*', 
        element: (
          <ProtectedRoute requiredRole={['super_admin']}>
            <SuperAdminDashboard />
          </ProtectedRoute>
        ) 
      },
      { 
        path: 'super-admin', 
        element: (
          <ProtectedRoute requiredRole={['super_admin']}>
            <SuperAdminDashboard />
          </ProtectedRoute>
        ) 
      },
      { 
        path: 'super-admin/role-management', 
        element: (
          <ProtectedRoute requiredRole={['super_admin']}>
            <RoleManagement />
          </ProtectedRoute>
        ) 
      },
      { 
        path: 'super-admin/organizations', 
        element: (
          <ProtectedRoute requiredRole={['super_admin']}>
            <Organizations />
          </ProtectedRoute>
        ) 
      },
      { 
        path: 'super-admin/users', 
        element: (
          <ProtectedRoute requiredRole={['super_admin']}>
            <GlobalUsers />
          </ProtectedRoute>
        ) 
      },
      { 
        path: 'super-admin/departments', 
        element: (
          <ProtectedRoute requiredRole={['super_admin']}>
            <SuperAdminDepartments />
          </ProtectedRoute>
        ) 
      },
      { 
        path: 'super-admin/activity', 
        element: (
          <ProtectedRoute requiredRole={['super_admin']}>
            <LiveActivity />
          </ProtectedRoute>
        ) 
      },
      { 
        path: 'super-admin/announcements', 
        element: (
          <ProtectedRoute requiredRole={['super_admin']}>
            <Announcements />
          </ProtectedRoute>
        ) 
      },
      { 
        path: 'super-admin/analytics', 
        element: (
          <ProtectedRoute requiredRole={['super_admin']}>
            <Analytics />
          </ProtectedRoute>
        ) 
      },
      { 
        path: 'super-admin/audit', 
        element: (
          <ProtectedRoute requiredRole={['super_admin']}>
            <AuditLogs />
          </ProtectedRoute>
        ) 
      },
      { 
        path: 'super-admin/chat', 
        element: (
          <ProtectedRoute requiredRole={['super_admin']}>
            <SuperAdminChat />
          </ProtectedRoute>
        ) 
      },
      
      // Admin Routes
      { 
        path: 'admin', 
        element: (
          <ProtectedRoute requiredRole={['admin']}>
            <AdminDashboard />
          </ProtectedRoute>
        ) 
      },
      { 
        path: 'admin/employees', 
        element: (
          <ProtectedRoute requiredRole={['admin']}>
            <Employees />
          </ProtectedRoute>
        ) 
      },
      { 
        path: 'admin/company-docs', 
        element: (
          <ProtectedRoute requiredRole={['admin']}>
            <AdminCompanyDocs />
          </ProtectedRoute>
        ) 
      },
      { 
        path: 'admin/invites', 
        element: (
          <ProtectedRoute requiredRole={['admin']}>
            <InviteManagement />
          </ProtectedRoute>
        ) 
      },
      { 
        path: 'admin/departments', 
        element: (
          <ProtectedRoute requiredRole={['admin']}>
            <AdminDepartments />
          </ProtectedRoute>
        ) 
      },
      { 
        path: 'admin/leaves', 
        element: (
          <ProtectedRoute requiredRole={['admin']}>
            <LeaveRequests />
          </ProtectedRoute>
        ) 
      },
      { 
        path: 'admin/leave-management', 
        element: (
          <ProtectedRoute requiredRole={['admin']}>
            <LeaveManagement />
          </ProtectedRoute>
        ) 
      },
      { 
        path: 'admin/holiday-calendar', 
        element: (
          <ProtectedRoute requiredRole={['admin']}>
            <AdminHolidayCalendar />
          </ProtectedRoute>
        ) 
      },
      { 
        path: 'admin/attendance', 
        element: (
          <ProtectedRoute requiredRole={['admin']}>
            <AttendanceAdmin />
          </ProtectedRoute>
        ) 
      },
      { 
        path: 'admin/expenses', 
        element: (
          <ProtectedRoute requiredRole={['admin']}>
            <ExpensesAdmin />
          </ProtectedRoute>
        ) 
      },
      { 
        path: 'admin/expense-management', 
        element: (
          <ProtectedRoute requiredRole={['admin']}>
            <ExpenseManagement />
          </ProtectedRoute>
        ) 
      },
      { 
        path: 'admin/payroll', 
        element: (
          <ProtectedRoute requiredRole={['admin']}>
            <AdminPayroll />
          </ProtectedRoute>
        ) 
      },
      { 
        path: 'admin/announcements', 
        element: (
          <ProtectedRoute requiredRole={['admin']}>
            <AnnouncementsAdmin />
          </ProtectedRoute>
        ) 
      },
      { 
        path: 'admin/chat', 
        element: (
          <ProtectedRoute requiredRole={['admin']}>
            <AdminChat />
          </ProtectedRoute>
        ) 
      },
      { 
        path: 'admin/employee-onboarding', 
        element: (
          <ProtectedRoute requiredRole={['admin']}>
            <HREmployeeOnboarding />
          </ProtectedRoute>
        ) 
      },
      
      // Employee Routes
      { 
        path: 'employee', 
        element: (
          <ProtectedRoute requiredRole={['employee', 'hr', 'manager', 'accountant']}>
            <EmployeeDashboard />
          </ProtectedRoute>
        ) 
      },
      { 
        path: 'employee/profile', 
        element: (
          <ProtectedRoute requiredRole={['employee', 'hr', 'manager', 'accountant']}>
            <Profile />
          </ProtectedRoute>
        ) 
      },
      { 
        path: 'employee/company-docs', 
        element: (
          <ProtectedRoute requiredRole={['employee', 'hr', 'manager', 'accountant']}>
            <EmployeeCompanyDocs />
          </ProtectedRoute>
        ) 
      },
      { 
        path: 'employee/leave', 
        element: (
          <ProtectedRoute requiredRole={['employee', 'hr', 'manager', 'accountant']}>
            <Leave />
          </ProtectedRoute>
        ) 
      },
      { 
        path: 'employee/holiday-calendar', 
        element: (
          <ProtectedRoute requiredRole={['employee', 'hr', 'manager', 'accountant']}>
            <EmployeeHolidayCalendarPage />
          </ProtectedRoute>
        ) 
      },
      { 
        path: 'employee/attendance', 
        element: (
          <ProtectedRoute requiredRole={['employee', 'hr', 'manager', 'accountant']}>
            <Attendance />
          </ProtectedRoute>
        ) 
      },
      { 
        path: 'employee/performance', 
        element: (
          <ProtectedRoute requiredRole={['employee', 'hr', 'manager', 'accountant']}>
            <Performance />
          </ProtectedRoute>
        ) 
      },
      { 
        path: 'employee/payroll', 
        element: (
          <ProtectedRoute requiredRole={['employee', 'hr', 'manager', 'accountant']}>
            <Payroll />
          </ProtectedRoute>
        ) 
      },
      { 
        path: 'employee/expenses', 
        element: (
          <ProtectedRoute requiredRole={['employee', 'hr', 'manager', 'accountant']}>
            <Expenses />
          </ProtectedRoute>
        ) 
      },
      { 
        path: 'employee/chat', 
        element: (
          <ProtectedRoute requiredRole={['employee', 'hr', 'manager', 'accountant']}>
            <Chat />
          </ProtectedRoute>
        ) 
      },
      { 
        path: 'employee/onboarding', 
        element: (
          <ProtectedRoute requiredRole={['employee', 'hr', 'manager', 'accountant']}>
            <EmployeeOnboarding />
          </ProtectedRoute>
        ) 
      },
      
      // Settings (placeholder)
      { 
        path: 'settings', 
        element: (
          <ProtectedRoute>
            <EmployeeDashboard />
          </ProtectedRoute>
        ) 
      },
    ],
  },
  {
    path: '/onboarding/:token',
    element: <Onboarding />
  }
]);
