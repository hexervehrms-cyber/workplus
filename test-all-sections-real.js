/**
 * Test ALL Employee and Admin sections with REAL data
 */

const API_BASE_URL = 'https://workplus-backend-sg3a.onrender.com';

async function testAllSections() {
  console.log('='.repeat(70));
  console.log('WORKPLUS PRO - COMPREHENSIVE SECTION TESTING (REAL DATA)');
  console.log('='.repeat(70));
  
  // Login with real credentials
  const loginResponse = await fetch(`${API_BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'atul@hexerve.com',
      password: 'Jadu@123'
    })
  });
  
  const loginData = await loginResponse.json();
  
  if (!loginResponse.ok || !loginData.token) {
    console.log('❌ Login failed');
    return;
  }
  
  const token = loginData.token;
  const userId = loginData.user.id || loginData.user._id;
  const orgId = loginData.user.orgId || 'system';
  console.log(`✅ Logged in as: ${loginData.user.name} (${loginData.user.role})`);
  console.log(`✅ Org ID: ${orgId}\n`);
  
  // Test Admin Sections
  console.log('='.repeat(70));
  console.log('ADMIN DASHBOARD SECTIONS');
  console.log('='.repeat(70));
  
  const adminTests = [
    { name: 'Dashboard Stats', path: '/api/dashboard/stats' },
    { name: 'Super Admin Dashboard', path: '/api/dashboard/superadmin' },
    { name: 'Employee List', path: '/api/employees?simple=true' },
    { name: 'Employee Stats', path: '/api/employees/stats/summary' },
    { name: 'Attendance Records', path: '/api/attendance' },
    { name: 'Attendance Stats', path: '/api/attendance/stats/summary' },
    { name: 'Leave Requests', path: '/api/leave-requests' },
    { name: 'Leave Stats', path: '/api/leave-requests/stats/summary' },
    { name: 'Leave Allocations', path: `/api/leave-allocation/organization/${orgId}` },
    { name: 'Leave Type Settings', path: `/api/leave-type-settings/${orgId}` },
    { name: 'Expenses', path: '/api/expenses' },
    { name: 'Holidays', path: '/api/holidays' },
    { name: 'Documents', path: '/api/documents/employee/' + userId },
    { name: 'Users', path: '/api/users' },
    { name: 'Roles', path: '/api/roles' },
    { name: 'Profile', path: '/api/profile' },
    { name: 'Announcements', path: '/api/announcements' },
    { name: 'Tasks', path: '/api/tasks' },
    { name: 'Organizations', path: '/api/organizations' },
    { name: 'Chat Conversations', path: '/api/chat/conversations' }
  ];
  
  let passed = 0;
  let failed = 0;
  
  for (const test of adminTests) {
    try {
      const response = await fetch(`${API_BASE_URL}${test.path}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (response.ok) {
        console.log(`✅ ${test.name.padEnd(30)} - Status ${response.status}`);
        passed++;
      } else {
        const data = await response.json();
        console.log(`❌ ${test.name.padEnd(30)} - Status ${response.status}: ${data.message || 'Error'}`);
        failed++;
      }
    } catch (err) {
      console.log(`❌ ${test.name.padEnd(30)} - Error: ${err.message}`);
      failed++;
    }
  }
  
  // Test Employee Sections
  console.log('\n' + '='.repeat(70));
  console.log('EMPLOYEE DASHBOARD SECTIONS');
  console.log('='.repeat(70));
  
  const employeeTests = [
    { name: 'Employee Dashboard', path: '/api/dashboard/employee' },
    { name: 'My Expenses', path: `/api/expenses/user/${userId}` },
    { name: 'My Tasks', path: '/api/tasks/my-tasks' },
    { name: 'My Payroll Dashboard', path: '/api/payroll/employee/dashboard' }
  ];
  
  for (const test of employeeTests) {
    try {
      const response = await fetch(`${API_BASE_URL}${test.path}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (response.ok) {
        console.log(`✅ ${test.name.padEnd(30)} - Status ${response.status}`);
        passed++;
      } else {
        const data = await response.json();
        console.log(`❌ ${test.name.padEnd(30)} - Status ${response.status}: ${data.message || 'Error'}`);
        failed++;
      }
    } catch (err) {
      console.log(`❌ ${test.name.padEnd(30)} - Error: ${err.message}`);
      failed++;
    }
  }
  
  // Summary
  console.log('\n' + '='.repeat(70));
  console.log('TEST SUMMARY');
  console.log('='.repeat(70));
  console.log(`Total Tests: ${passed + failed}`);
  console.log(`Passed:      ${passed} ✅`);
  console.log(`Failed:      ${failed} ❌`);
  console.log(`Success Rate: ${((passed / (passed + failed)) * 100).toFixed(1)}%`);
}

testAllSections();
