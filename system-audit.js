/**
 * Comprehensive System Audit Script for REAL Data
 * Tests multiple CRUD functions across all key sections
 */
import axios from 'axios';

const API_BASE_URL = 'http://localhost:5000';

async function runSystemAudit() {
  console.log('='.repeat(70));
  console.log('WORKPLUS PRO - COMPREHENSIVE SYSTEM AUDIT (REAL DATA)');
  console.log('='.repeat(70));
  
  const client = axios.create({
    baseURL: API_BASE_URL,
    withCredentials: true,
    headers: { 'Content-Type': 'application/json' }
  });

  // 1. Authentication
  console.log('\n--- 1. AUTHENTICATION ---');
  let token, userId, orgId;
  try {
    const loginRes = await client.post('/api/auth/login', {
      email: 'atul@hexerve.com',
      password: 'Jadu@123'
    });
    token = loginRes.data.token;
    userId = loginRes.data.user.id || loginRes.data.user._id;
    orgId = loginRes.data.user.orgId || 'system';
    client.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    console.log(`✅ Logged in as: ${loginRes.data.user.name} (${loginRes.data.user.role})`);
  } catch (err) {
    console.log('❌ Login failed:', err.response?.data?.message || err.message);
    return;
  }

  const testSection = async (name, tests) => {
    console.log(`\n--- ${name.toUpperCase()} ---`);
    for (const test of tests) {
      try {
        const { method = 'GET', path, body = null, expectedStatus = 200 } = test;
        const config = { method, url: path, validateStatus: () => true };
        if (body) config.data = body;
        
        const res = await client(config);
        if (res.status === expectedStatus || (expectedStatus === 200 && res.status === 201)) {
          console.log(`✅ ${test.label.padEnd(30)} - Status ${res.status}`);
          if (test.onSuccess) test.onSuccess(res.data);
        } else {
          console.log(`❌ ${test.label.padEnd(30)} - Status ${res.status}: ${res.data.message || 'Error'}`);
        }
      } catch (err) {
        console.log(`❌ ${test.label.padEnd(30)} - Exception: ${err.message}`);
      }
    }
  };

  // Section: Dashboard
  await testSection('Dashboard', [
    { label: 'Admin Stats', path: '/api/dashboard/stats' },
    { label: 'Super Admin Stats', path: '/api/dashboard/superadmin' },
    { label: 'Expense Trends', path: '/api/dashboard/expense-trends' },
    { label: 'Recent Leaves', path: '/api/dashboard/recent-leave-requests' }
  ]);

  // Section: Attendance
  await testSection('Attendance', [
    { label: 'Today Attendance', path: '/api/attendance/today' },
    { label: 'Attendance History', path: '/api/attendance-history' },
    { label: 'Check-in (Audit)', method: 'POST', path: '/api/attendance/check-in', body: {
      userId, employeeId: '69f605d09d95acf557eb808b', employeeName: 'Atul verma', orgId, location: 'Office'
    }, expectedStatus: 201 }
  ]);

  // Section: Leave
  let leaveRequestId;
  await testSection('Leave Requests', [
    { label: 'Leave List', path: '/api/leave-requests' },
    { label: 'Leave Stats', path: '/api/leave-requests/stats/summary' },
    { label: 'Request Leave', method: 'POST', path: '/api/leave-requests', body: {
      userId, employeeId: '69f605d09d95acf557eb808b', employeeName: 'Atul verma', orgId,
      type: 'Casual Leave', startDate: new Date(), endDate: new Date(), reason: 'Audit Test'
    }, expectedStatus: 201, onSuccess: (data) => leaveRequestId = data.data?._id }
  ]);

  // Section: Expenses
  await testSection('Expenses', [
    { label: 'Expense List', path: '/api/expenses' },
    { label: 'My Expenses', path: `/api/expenses/user/${userId}` },
    { label: 'Submit Expense', method: 'POST', path: '/api/expenses', body: {
      userId, employeeId: '69f605d09d95acf557eb808b', employeeName: 'Atul verma', orgId,
      title: 'Audit Expense', category: 'travel', amount: 100, date: new Date(), description: 'Audit Test'
    }, expectedStatus: 201 }
  ]);

  // Section: Tasks
  let auditTaskId;
  await testSection('Tasks', [
    { label: 'Task List', path: '/api/tasks' },
    { label: 'My Tasks', path: '/api/tasks/my-tasks' },
    { label: 'Create Task', method: 'POST', path: '/api/tasks', body: {
      title: 'Audit Task', description: 'Testing task functions', assignedTo: userId, priority: 'high', orgId
    }, expectedStatus: 201, onSuccess: (data) => auditTaskId = data.data?._id }
  ]);

  if (auditTaskId) {
    await testSection('Task Operations', [
      { label: 'Update Task', method: 'PUT', path: `/api/tasks/${auditTaskId}`, body: { status: 'in_progress' } },
      { label: 'Delete Task', method: 'DELETE', path: `/api/tasks/${auditTaskId}` }
    ]);
  }

  // Section: Employees & Users
  await testSection('HR Management', [
    { label: 'Employee List', path: '/api/employees' },
    { label: 'User List', path: '/api/users' },
    { label: 'Role List', path: '/api/roles' },
    { label: 'Department List', path: '/api/organizations/departments' }
  ]);

  // Section: Communication
  await testSection('Communication', [
    { label: 'Announcements', path: '/api/announcements' },
    { label: 'Chat Conversations', path: '/api/chat/conversations' }
  ]);

  console.log('\n' + '='.repeat(70));
  console.log('AUDIT COMPLETE');
  console.log('='.repeat(70));
}

runSystemAudit();
