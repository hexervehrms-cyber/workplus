import AdminDepartments from '../admin/Departments';

/** Super-admin uses the same org-scoped departments API as admin. */
export default function SuperAdminDepartments() {
  return <AdminDepartments />;
}
