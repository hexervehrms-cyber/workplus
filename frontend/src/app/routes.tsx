import { createBrowserRouter, Outlet } from 'react-router';
import { lazy, Suspense } from 'react';
import { MainLayout } from './layouts/MainLayout';
import { ProtectedRoute } from './components/ProtectedRoute';
import Login from './pages/Login';
import HomeGate from './components/landing/HomeGate';

// Minimal loading fallback - no visible spinner for faster perceived performance
const LazyLoader = () => null;

// Lazy load pages for better performance
const SuperAdminDashboard = lazy(() => import('./pages/super-admin/Dashboard'));
const RoleManagement = lazy(() => import('./pages/super-admin/RoleManagement'));
const Organizations = lazy(() => import('./pages/super-admin/Organizations'));
const GlobalUsers = lazy(() => import('./pages/super-admin/Users'));
const SuperAdminDepartments = lazy(() => import('./pages/super-admin/Departments'));
const LiveActivity = lazy(() => import('./pages/super-admin/Activity'));
const Announcements = lazy(() => import('./pages/super-admin/Announcements'));
const Analytics = lazy(() => import('./pages/super-admin/Analytics'));
const AuditLogs = lazy(() => import('./pages/super-admin/Audit'));
const SuperAdminChat = lazy(() => import('./pages/super-admin/Chat'));

// Admin Pages - Lazy loaded
const AdminDashboard = lazy(() => import('./pages/admin/Dashboard'));
const Employees = lazy(() => import('./pages/admin/Employees'));
const EmployeeCorrespondence = lazy(() => import('./pages/admin/EmployeeCorrespondence'));
const InviteManagement = lazy(() => import('./pages/admin/InviteManagement'));
const AdminDepartments = lazy(() => import('./pages/admin/Departments'));
const AdminRoles = lazy(() => import('./pages/admin/Roles'));
const LeaveRequests = lazy(() => import('./pages/admin/LeaveRequests'));
const AttendanceAdmin = lazy(() => import('./pages/admin/Attendance'));
const ExpensesAdmin = lazy(() => import('./pages/admin/Expenses'));
const AnnouncementsAdmin = lazy(() => import('./pages/admin/Announcements'));
const AdminChat = lazy(() => import('./pages/admin/Chat'));
const HREmployeeOnboarding = lazy(() => import('./pages/admin/EmployeeOnboarding'));
const AdminCompanyDocs = lazy(() => import('./pages/admin/CompanyDocs'));
const AdminHolidayCalendar = lazy(() => import('./pages/admin/HolidayCalendar'));
const AdminPayroll = lazy(() => import('./pages/admin/Payroll'));
const AdminPayrollRuns = lazy(() => import('./pages/admin/PayrollCalculation'));
const AttendanceCalendar = lazy(() => import('./pages/admin/AttendanceCalendar'));
const AttendanceHistory = lazy(() => import('./pages/admin/AttendanceHistory'));
const LeaveAllocation = lazy(() => import('./pages/admin/LeaveAllocation'));
const LeaveSettings = lazy(() => import('./pages/admin/LeaveSettings'));
const AdminSettings = lazy(() => import('./pages/admin/Settings'));
const AdminManagement = lazy(() => import('./pages/admin/AdminManagement'));

// Sales Pages - Lazy loaded
const SalesDashboard = lazy(() => import('./pages/sales/SalesDashboard'));
const Leads = lazy(() => import('./pages/sales/Leads'));
const Deals = lazy(() => import('./pages/sales/Deals'));
const Calls = lazy(() => import('./pages/sales/Calls'));

// Employee Pages - Lazy loaded
const EmployeeDashboard = lazy(() => import('./pages/employee/Dashboard'));
const Profile = lazy(() => import('./pages/employee/Profile'));
const Leave = lazy(() => import('./pages/employee/Leave'));
const Calendar = lazy(() => import('./pages/employee/Calendar'));
const Attendance = lazy(() => import('./pages/employee/Attendance'));
const Performance = lazy(() => import('./pages/employee/Performance'));
const Payroll = lazy(() => import('./pages/employee/Payroll'));
const Expenses = lazy(() => import('./pages/employee/Expenses'));
const Chat = lazy(() => import('./pages/employee/Chat'));
const EmployeeOnboarding = lazy(() => import('./pages/employee/OnboardingForm'));
const EmployeeCompanyDocs = lazy(() => import('./pages/employee/CompanyDocs'));
const EmployeeSettings = lazy(() => import('./pages/employee/Settings'));

// Public Pages
import Onboarding from './pages/public/Onboarding';

const routes = [
  {
    element: <Outlet />,
    children: [
      { index: true, element: <HomeGate /> },
      { path: 'login', element: <Login /> },
      {
        element: (
          <ProtectedRoute>
            <MainLayout />
          </ProtectedRoute>
        ),
        children: [
      {
        path: 'super-admin',
        element: (
          <ProtectedRoute requiredRole={['super_admin']}>
            <Suspense fallback={<LazyLoader />}>
              <SuperAdminDashboard />
            </Suspense>
          </ProtectedRoute>
        ),
      },
      {
        path: 'super-admin/role-management',
        element: (
          <ProtectedRoute requiredRole={['super_admin']}>
            <Suspense fallback={<LazyLoader />}>
              <RoleManagement />
            </Suspense>
          </ProtectedRoute>
        ),
      },
      {
        path: 'super-admin/organizations',
        element: (
          <ProtectedRoute requiredRole={['super_admin']}>
            <Organizations />
          </ProtectedRoute>
        ),
      },
      {
        path: 'super-admin/users',
        element: (
          <ProtectedRoute requiredRole={['super_admin']}>
            <GlobalUsers />
          </ProtectedRoute>
        ),
      },
      {
        path: 'super-admin/departments',
        element: (
          <ProtectedRoute requiredRole={['super_admin']}>
            <SuperAdminDepartments />
          </ProtectedRoute>
        ),
      },
      {
        path: 'super-admin/activity',
        element: (
          <ProtectedRoute requiredRole={['super_admin']}>
            <LiveActivity />
          </ProtectedRoute>
        ),
      },
      {
        path: 'super-admin/announcements',
        element: (
          <ProtectedRoute requiredRole={['super_admin']}>
            <Announcements />
          </ProtectedRoute>
        ),
      },
      {
        path: 'super-admin/analytics',
        element: (
          <ProtectedRoute requiredRole={['super_admin']}>
            <Analytics />
          </ProtectedRoute>
        ),
      },
      {
        path: 'super-admin/audit',
        element: (
          <ProtectedRoute requiredRole={['super_admin']}>
            <AuditLogs />
          </ProtectedRoute>
        ),
      },
      {
        path: 'super-admin/chat',
        element: (
          <ProtectedRoute requiredRole={['super_admin']}>
            <SuperAdminChat />
          </ProtectedRoute>
        ),
      },
      {
        path: 'admin',
        element: (
          <ProtectedRoute requiredRole={['admin']}>
            <AdminDashboard />
          </ProtectedRoute>
        ),
      },
      {
        path: 'admin/employees',
        element: (
          <ProtectedRoute requiredRole={['admin']}>
            <Employees />
          </ProtectedRoute>
        ),
      },
      {
        path: 'admin/employees/:employeeId/correspondence',
        element: (
          <ProtectedRoute requiredRole={['admin']}>
            <EmployeeCorrespondence />
          </ProtectedRoute>
        ),
      },
      {
        path: 'admin/company-docs',
        element: (
          <ProtectedRoute requiredRole={['admin']}>
            <AdminCompanyDocs />
          </ProtectedRoute>
        ),
      },
      {
        path: 'admin/invites',
        element: (
          <ProtectedRoute requiredRole={['admin']}>
            <InviteManagement />
          </ProtectedRoute>
        ),
      },
      {
        path: 'admin/departments',
        element: (
          <ProtectedRoute requiredRole={['admin']}>
            <AdminDepartments />
          </ProtectedRoute>
        ),
      },
      {
        path: 'admin/roles',
        element: (
          <ProtectedRoute requiredRole={['admin']}>
            <AdminRoles />
          </ProtectedRoute>
        ),
      },
      {
        path: 'admin/leaves',
        element: (
          <ProtectedRoute requiredRole={['admin']}>
            <LeaveRequests />
          </ProtectedRoute>
        ),
      },
      {
        path: 'admin/leave-allocation',
        element: (
          <ProtectedRoute requiredRole={['admin']}>
            <LeaveAllocation />
          </ProtectedRoute>
        ),
      },
      {
        path: 'admin/leave-settings',
        element: (
          <ProtectedRoute requiredRole={['admin']}>
            <LeaveSettings />
          </ProtectedRoute>
        ),
      },
      {
        path: 'admin/holiday-calendar',
        element: (
          <ProtectedRoute requiredRole={['admin']}>
            <AdminHolidayCalendar />
          </ProtectedRoute>
        ),
      },
      {
        path: 'admin/attendance',
        element: (
          <ProtectedRoute requiredRole={['admin']}>
            <AttendanceAdmin />
          </ProtectedRoute>
        ),
      },
      {
        path: 'admin/attendance-calendar',
        element: (
          <ProtectedRoute requiredRole={['admin']}>
            <AttendanceCalendar />
          </ProtectedRoute>
        ),
      },
      {
        path: 'admin/attendance-history',
        element: (
          <ProtectedRoute requiredRole={['admin']}>
            <AttendanceHistory />
          </ProtectedRoute>
        ),
      },
      {
        path: 'admin/expenses',
        element: (
          <ProtectedRoute requiredRole={['admin']}>
            <ExpensesAdmin />
          </ProtectedRoute>
        ),
      },
      {
        path: 'admin/payroll',
        element: (
          <ProtectedRoute requiredRole={['admin']}>
            <AdminPayroll />
          </ProtectedRoute>
        ),
      },
      {
        path: 'admin/payroll-runs',
        element: (
          <ProtectedRoute requiredRole={['admin']}>
            <AdminPayrollRuns />
          </ProtectedRoute>
        ),
      },
      {
        path: 'admin/announcements',
        element: (
          <ProtectedRoute requiredRole={['admin']}>
            <AnnouncementsAdmin />
          </ProtectedRoute>
        ),
      },
      {
        path: 'admin/chat',
        element: (
          <ProtectedRoute requiredRole={['admin']}>
            <AdminChat />
          </ProtectedRoute>
        ),
      },
      {
        path: 'admin/employee-onboarding',
        element: (
          <ProtectedRoute requiredRole={['admin']}>
            <HREmployeeOnboarding />
          </ProtectedRoute>
        ),
      },
      {
        path: 'admin/sales',
        element: (
          <ProtectedRoute requiredRole={['admin']}>
            <SalesDashboard />
          </ProtectedRoute>
        ),
      },
      {
        path: 'admin/sales/leads',
        element: (
          <ProtectedRoute requiredRole={['admin']}>
            <Leads />
          </ProtectedRoute>
        ),
      },
      {
        path: 'admin/sales/deals',
        element: (
          <ProtectedRoute requiredRole={['admin']}>
            <Deals />
          </ProtectedRoute>
        ),
      },
      {
        path: 'admin/sales/calls',
        element: (
          <ProtectedRoute requiredRole={['admin']}>
            <Calls />
          </ProtectedRoute>
        ),
      },
      {
        path: 'employee',
        element: (
          <ProtectedRoute requiredRole={['employee', 'hr', 'manager', 'accountant']}>
            <EmployeeDashboard />
          </ProtectedRoute>
        ),
      },
      {
        path: 'employee/profile',
        element: (
          <ProtectedRoute requiredRole={['employee', 'hr', 'manager', 'accountant']}>
            <Profile />
          </ProtectedRoute>
        ),
      },
      {
        path: 'employee/company-docs',
        element: (
          <ProtectedRoute requiredRole={['employee', 'hr', 'manager', 'accountant']}>
            <EmployeeCompanyDocs />
          </ProtectedRoute>
        ),
      },
      {
        path: 'employee/leave',
        element: (
          <ProtectedRoute requiredRole={['employee', 'hr', 'manager', 'accountant']}>
            <Leave />
          </ProtectedRoute>
        ),
      },
      {
        path: 'employee/calendar',
        element: (
          <ProtectedRoute requiredRole={['employee', 'hr', 'manager', 'accountant']}>
            <Calendar />
          </ProtectedRoute>
        ),
      },
      {
        path: 'employee/attendance',
        element: (
          <ProtectedRoute requiredRole={['employee', 'hr', 'manager', 'accountant']}>
            <Attendance />
          </ProtectedRoute>
        ),
      },
      {
        path: 'employee/performance',
        element: (
          <ProtectedRoute requiredRole={['employee', 'hr', 'manager', 'accountant']}>
            <Performance />
          </ProtectedRoute>
        ),
      },
      {
        path: 'employee/payroll',
        element: (
          <ProtectedRoute requiredRole={['employee', 'hr', 'manager', 'accountant']}>
            <Payroll />
          </ProtectedRoute>
        ),
      },
      {
        path: 'employee/expenses',
        element: (
          <ProtectedRoute requiredRole={['employee', 'hr', 'manager', 'accountant']}>
            <Expenses />
          </ProtectedRoute>
        ),
      },
      {
        path: 'employee/chat',
        element: (
          <ProtectedRoute requiredRole={['employee', 'hr', 'manager', 'accountant']}>
            <Chat />
          </ProtectedRoute>
        ),
      },
      {
        path: 'employee/onboarding',
        element: (
          <ProtectedRoute requiredRole={['employee', 'hr', 'manager', 'accountant']}>
            <EmployeeOnboarding />
          </ProtectedRoute>
        ),
      },
      {
        path: 'settings',
        element: (
          <ProtectedRoute>
            {/* Route to appropriate settings page based on role */}
            <EmployeeSettings />
          </ProtectedRoute>
        ),
      },
      {
        path: 'employee/settings',
        element: (
          <ProtectedRoute requiredRole={['employee', 'hr', 'manager', 'accountant']}>
            <EmployeeSettings />
          </ProtectedRoute>
        ),
      },
      {
        path: 'admin/settings',
        element: (
          <ProtectedRoute requiredRole={['admin']}>
            <AdminSettings />
          </ProtectedRoute>
        ),
      },
      {
        path: 'admin/admin-management',
        element: (
          <ProtectedRoute requiredRole={['admin']}>
            <AdminManagement />
          </ProtectedRoute>
        ),
      },
        ],
      },
      {
        path: 'onboarding/:token',
        element: <Onboarding />,
      },
    ],
  },
];

export const router = createBrowserRouter(routes);
