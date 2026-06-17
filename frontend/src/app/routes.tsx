import { createBrowserRouter, Navigate, Outlet } from 'react-router';
import { lazy, Suspense, type ComponentType } from 'react';

/** Retry dynamic import once (handles stale CDN chunks after deploy). */
function lazyPage<T extends ComponentType<unknown>>(
  loader: () => Promise<{ default: T }>
) {
  return lazy(async () => {
    try {
      return await loader();
    } catch (first) {
      await new Promise((r) => setTimeout(r, 500));
      try {
        return await loader();
      } catch {
        throw first;
      }
    }
  });
}
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
const AdminDepartments = lazy(() => import('./pages/admin/Departments'));
const AdminRoles = lazy(() => import('./pages/admin/Roles'));
const LeaveRequests = lazy(() => import('./pages/admin/LeaveRequests'));
const AttendanceAdmin = lazy(() => import('./pages/admin/Attendance'));
const ExpensesAdmin = lazy(() => import('./pages/admin/Expenses'));
const AnnouncementsAdmin = lazyPage(() => import('./pages/admin/Announcements'));
const AdminChat = lazyPage(() => import('./pages/admin/Chat'));
const AdminCompanyDocs = lazy(() => import('./pages/admin/CompanyDocs'));
const AdminHolidayCalendar = lazy(() => import('./pages/admin/HolidayCalendar'));
const AdminPayroll = lazyPage(() => import('./pages/admin/Payroll'));
const AdminPayrollRuns = lazy(() => import('./pages/admin/PayrollCalculation'));
const AttendanceCalendar = lazy(() => import('./pages/admin/AttendanceCalendar'));
const AttendanceHistory = lazy(() => import('./pages/admin/AttendanceHistory'));
const LeaveAllocation = lazy(() => import('./pages/admin/LeaveAllocation'));
const LeaveSettings = lazy(() => import('./pages/admin/LeaveSettings'));
const AdminSettings = lazyPage(() => import('./pages/admin/Settings'));

// Sales Pages - Lazy loaded
const SalesDashboard = lazy(() => import('./pages/sales/SalesDashboard'));
const Leads = lazy(() => import('./pages/sales/Leads'));
const Deals = lazy(() => import('./pages/sales/Deals'));
const Calls = lazy(() => import('./pages/sales/Calls'));

// Employee Pages - Lazy loaded
const EmployeeDashboard = lazy(() => import('./pages/employee/Dashboard'));
const Profile = lazy(() => import('./pages/employee/Profile'));
const Leave = lazy(() => import('./pages/employee/Leave'));
const Attendance = lazy(() => import('./pages/employee/Attendance'));
const Performance = lazy(() => import('./pages/employee/Performance'));
const Payroll = lazy(() => import('./pages/employee/Payroll'));
const Expenses = lazy(() => import('./pages/employee/Expenses'));
const Chat = lazy(() => import('./pages/employee/Chat'));
const EmployeeOnboarding = lazy(() => import('./pages/employee/OnboardingForm'));
const EmployeeCompanyDocs = lazy(() => import('./pages/employee/CompanyDocs'));
const EmployeeSettings = lazy(() => import('./pages/employee/Settings'));
const EmployeeAssets = lazy(() => import('./pages/employee/Assets'));

// Public Pages
import OnboardingPage from './pages/public/OnboardingPage';
import { RoleHomeRedirect, SettingsRoleRedirect } from './components/RoleHomeRedirect';

/** HR users share most admin HR screens; sales/roles stay admin-only. */
const HR_ADMIN = ['admin', 'hr'] as const;
const ADMIN_ONLY = ['admin'] as const;

const AdminSalaryStructure = lazy(() => import('./pages/admin/SalaryStructure'));
const AdminSalaryCycle = lazy(() => import('./pages/admin/SalaryCycle'));
const AdminAssets = lazy(() => import('./pages/admin/Assets'));

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
          <ProtectedRoute requiredRole={[...HR_ADMIN]}>
            <AdminDashboard />
          </ProtectedRoute>
        ),
      },
      {
        path: 'admin/employees',
        element: (
          <ProtectedRoute requiredRole={[...HR_ADMIN]}>
            <Employees />
          </ProtectedRoute>
        ),
      },
      {
        path: 'admin/employees/:employeeId/correspondence',
        element: (
          <ProtectedRoute requiredRole={[...HR_ADMIN]}>
            <EmployeeCorrespondence />
          </ProtectedRoute>
        ),
      },
      {
        path: 'admin/company-docs',
        element: (
          <ProtectedRoute requiredRole={[...HR_ADMIN]}>
            <AdminCompanyDocs />
          </ProtectedRoute>
        ),
      },
      {
        path: 'admin/departments',
        element: (
          <ProtectedRoute requiredRole={['admin', 'hr']}>
            <AdminDepartments />
          </ProtectedRoute>
        ),
      },
      {
        path: 'admin/roles',
        element: (
          <ProtectedRoute requiredRole={[...ADMIN_ONLY]}>
            <AdminRoles />
          </ProtectedRoute>
        ),
      },
      {
        path: 'admin/leaves',
        element: (
          <ProtectedRoute requiredRole={[...HR_ADMIN]}>
            <LeaveRequests />
          </ProtectedRoute>
        ),
      },
      {
        path: 'admin/leave-allocation',
        element: (
          <ProtectedRoute requiredRole={[...HR_ADMIN]}>
            <LeaveAllocation />
          </ProtectedRoute>
        ),
      },
      {
        path: 'admin/leave-settings',
        element: (
          <ProtectedRoute requiredRole={[...HR_ADMIN]}>
            <LeaveSettings />
          </ProtectedRoute>
        ),
      },
      {
        path: 'admin/holiday-calendar',
        element: (
          <ProtectedRoute requiredRole={[...HR_ADMIN]}>
            <AdminHolidayCalendar />
          </ProtectedRoute>
        ),
      },
      {
        path: 'admin/attendance',
        element: (
          <ProtectedRoute requiredRole={[...HR_ADMIN]}>
            <AttendanceAdmin />
          </ProtectedRoute>
        ),
      },
      {
        path: 'admin/attendance-calendar',
        element: (
          <ProtectedRoute requiredRole={[...HR_ADMIN]}>
            <AttendanceCalendar />
          </ProtectedRoute>
        ),
      },
      {
        path: 'admin/attendance-history',
        element: (
          <ProtectedRoute requiredRole={[...HR_ADMIN]}>
            <AttendanceHistory />
          </ProtectedRoute>
        ),
      },
      {
        path: 'admin/expenses',
        element: (
          <ProtectedRoute requiredRole={[...HR_ADMIN]}>
            <ExpensesAdmin />
          </ProtectedRoute>
        ),
      },
      {
        path: 'admin/payroll',
        element: (
          <ProtectedRoute requiredRole={[...HR_ADMIN]}>
            <AdminPayroll />
          </ProtectedRoute>
        ),
      },
      {
        path: 'admin/payroll-runs',
        element: (
          <ProtectedRoute requiredRole={[...HR_ADMIN]}>
            <AdminPayrollRuns />
          </ProtectedRoute>
        ),
      },
      {
        path: 'admin/salary-structure',
        element: (
          <ProtectedRoute requiredRole={[...HR_ADMIN]}>
            <Suspense fallback={<LazyLoader />}>
              <AdminSalaryStructure />
            </Suspense>
          </ProtectedRoute>
        ),
      },
      {
        path: 'admin/salary-cycle',
        element: (
          <ProtectedRoute requiredRole={[...HR_ADMIN]}>
            <Suspense fallback={<LazyLoader />}>
              <AdminSalaryCycle />
            </Suspense>
          </ProtectedRoute>
        ),
      },
      {
        path: 'admin/assets',
        element: (
          <ProtectedRoute requiredRole={[...HR_ADMIN]}>
            <Suspense fallback={<LazyLoader />}>
              <AdminAssets />
            </Suspense>
          </ProtectedRoute>
        ),
      },
      {
        path: 'admin/announcements',
        element: (
          <ProtectedRoute requiredRole={[...HR_ADMIN]}>
            <AnnouncementsAdmin />
          </ProtectedRoute>
        ),
      },
      {
        path: 'admin/chat',
        element: (
          <ProtectedRoute requiredRole={[...HR_ADMIN]}>
            <AdminChat />
          </ProtectedRoute>
        ),
      },
      {
        path: 'admin/sales',
        element: (
          <ProtectedRoute requiredRole={[...ADMIN_ONLY]}>
            <SalesDashboard />
          </ProtectedRoute>
        ),
      },
      {
        path: 'admin/sales/leads',
        element: (
          <ProtectedRoute requiredRole={[...ADMIN_ONLY]}>
            <Leads />
          </ProtectedRoute>
        ),
      },
      {
        path: 'admin/sales/deals',
        element: (
          <ProtectedRoute requiredRole={[...ADMIN_ONLY]}>
            <Deals />
          </ProtectedRoute>
        ),
      },
      {
        path: 'admin/sales/calls',
        element: (
          <ProtectedRoute requiredRole={[...ADMIN_ONLY]}>
            <Calls />
          </ProtectedRoute>
        ),
      },
      {
        path: 'employee',
        element: (
          <ProtectedRoute requiredRole={['employee', 'manager', 'accountant']}>
            <EmployeeDashboard />
          </ProtectedRoute>
        ),
      },
      {
        path: 'employee/profile',
        element: (
          <ProtectedRoute requiredRole={['employee', 'manager', 'accountant']}>
            <Profile />
          </ProtectedRoute>
        ),
      },
      {
        path: 'employee/company-docs',
        element: (
          <ProtectedRoute requiredRole={['employee', 'manager', 'accountant']}>
            <EmployeeCompanyDocs />
          </ProtectedRoute>
        ),
      },
      {
        path: 'employee/leave',
        element: (
          <ProtectedRoute requiredRole={['employee', 'manager', 'accountant']}>
            <Leave />
          </ProtectedRoute>
        ),
      },
      {
        path: 'employee/calendar',
        element: <Navigate to="/employee" replace />,
      },
      {
        path: 'employee/attendance',
        element: (
          <ProtectedRoute requiredRole={['employee', 'manager', 'accountant']}>
            <Attendance />
          </ProtectedRoute>
        ),
      },
      {
        path: 'employee/performance',
        element: (
          <ProtectedRoute requiredRole={['employee', 'manager', 'accountant']}>
            <Performance />
          </ProtectedRoute>
        ),
      },
      {
        path: 'employee/payroll',
        element: (
          <ProtectedRoute requiredRole={['employee', 'manager', 'accountant']}>
            <Payroll />
          </ProtectedRoute>
        ),
      },
      {
        path: 'employee/expenses',
        element: (
          <ProtectedRoute requiredRole={['employee', 'manager', 'accountant']}>
            <Expenses />
          </ProtectedRoute>
        ),
      },
      {
        path: 'employee/chat',
        element: (
          <ProtectedRoute requiredRole={['employee', 'manager', 'accountant']}>
            <Chat />
          </ProtectedRoute>
        ),
      },
      {
        path: 'employee/assets',
        element: (
          <ProtectedRoute requiredRole={['employee', 'manager', 'accountant']}>
            <Suspense fallback={<LazyLoader />}>
              <EmployeeAssets />
            </Suspense>
          </ProtectedRoute>
        ),
      },
      {
        path: 'employee/onboarding',
        element: (
          <ProtectedRoute requiredRole={['employee', 'manager', 'accountant']}>
            <EmployeeOnboarding />
          </ProtectedRoute>
        ),
      },
      {
        path: 'settings',
        element: (
          <ProtectedRoute>
            <SettingsRoleRedirect />
          </ProtectedRoute>
        ),
      },
      {
        path: 'employee/settings',
        element: (
          <ProtectedRoute requiredRole={['employee', 'manager', 'accountant']}>
            <EmployeeSettings />
          </ProtectedRoute>
        ),
      },
      {
        path: 'admin/settings',
        element: (
          <ProtectedRoute requiredRole={[...HR_ADMIN]}>
            <AdminSettings />
          </ProtectedRoute>
        ),
      },
      {
        path: '*',
        element: (
          <ProtectedRoute>
            <RoleHomeRedirect />
          </ProtectedRoute>
        ),
      },
        ],
      },
      {
        path: 'onboarding/:token',
        element: <OnboardingPage />,
      },
    ],
  },
];

export const router = createBrowserRouter(routes);
