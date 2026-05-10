/**
 * Comprehensive Dashboard Functions Test
 * Tests all sections, operations, and features for Employee and Admin dashboards
 */

const API_BASE_URL = 'https://workplus-backend-sg3a.onrender.com';
let authToken = null;
let currentUser = null;
let testResults = [];

function logResult(testName, status, message, data = null) {
  const result = {
    test: testName,
    status,
    message,
    data,
    timestamp: new Date().toISOString()
  };
  testResults.push(result);
  console.log(`${status === 'PASS' ? '✅' : '❌'} ${testName}: ${message}`);
  if (data && data.length < 500) console.log('   Response:', JSON.stringify(data));
}

async function testEndpoint(name, method, endpoint, body = null) {
  try {
    const url = `${API_BASE_URL}${endpoint}`;
    const options = {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(authToken && { Authorization: `Bearer ${authToken}` })
      },
      ...(body && { body: JSON.stringify(body) })
    };

    const response = await fetch(url, options);
    const data = await response.json();
    
    if (response.ok) {
      logResult(name, 'PASS', `Status ${response.status}`, data);
      return { success: true, data };
    } else {
      logResult(name, 'FAIL', `Status ${response.status}: ${data.message || 'Unknown error'}`, data);
      return { success: false, error: data };
    }
  } catch (error) {
    logResult(name, 'FAIL', `Error: ${error.message}`);
    return { success: false, error: error.message };
  }
}

async function runDashboardTests() {
  console.log('='.repeat(70));
  console.log('WORKPLUS PRO - COMPREHENSIVE DASHBOARD FUNCTIONS TEST');
  console.log('='.repeat(70));
  console.log(`Backend: ${API_BASE_URL}`);
  console.log(`Frontend: https://workplus-qbshegha8-hexervehrms-8667s-projects.vercel.app`);
  console.log(`Started: ${new Date().toISOString()}`);
  console.log('='.repeat(70));

  // ============================================================
  // 1. AUTHENTICATION
  // ============================================================
  console.log('\n🔐 STEP 1: AUTHENTICATION');
  console.log('-'.repeat(70));

  const loginResult = await testEndpoint('Super Admin Login', 'POST', '/api/auth/login', {
    email: 'superadmin@company.com',
    password: 'Admin123!SecurePassword'
  });

  if (loginResult.success && loginResult.data.token) {
    authToken = loginResult.data.token;
    currentUser = loginResult.data.user;
    console.log(`\n✅ Logged in as: ${currentUser.name} (${currentUser.role})`);
    console.log(`   Email: ${currentUser.email}`);
    console.log(`   Organization: ${currentUser.organization || 'N/A'}`);
  } else {
    console.log('\n❌ Login failed - cannot proceed with authenticated tests');
    return;
  }

  // ============================================================
  // 2. ADMIN DASHBOARD SECTIONS
  // ============================================================
  console.log('\n\n📊 STEP 2: ADMIN DASHBOARD SECTIONS & OPERATIONS');
  console.log('-'.repeat(70));

  // 2.1 Dashboard Overview
  console.log('\n📈 2.1 Dashboard Overview');
  await testEndpoint('Admin Dashboard Stats', 'GET', '/api/dashboard/stats');
  await testEndpoint('Super Admin Dashboard', 'GET', '/api/dashboard/superadmin');
  await testEndpoint('Today\'s Attendance', 'GET', '/api/dashboard/todays-attendance');
  await testEndpoint('Dashboard Activity', 'GET', '/api/dashboard/activity');

  // 2.2 Employee Management
  console.log('\n👥 2.2 Employee Management');
  await testEndpoint('Get All Employees (Simple)', 'GET', '/api/employees?simple=true');
  await testEndpoint('Get Employees Paginated', 'GET', '/api/employees?page=1&limit=10');
  await testEndpoint('Get Employee Statistics', 'GET', '/api/employees/stats');
  await testEndpoint('Get Departments', 'GET', '/api/employees/departments');
  await testEndpoint('Get Employee Count', 'GET', '/api/employees/count');

  // 2.3 Attendance Management
  console.log('\n⏰ 2.3 Attendance Management');
  await testEndpoint('Get Attendance Records', 'GET', '/api/attendance');
  await testEndpoint('Get Attendance Statistics', 'GET', '/api/attendance/statistics');
  await testEndpoint('Get Today\'s Activity Logs', 'GET', '/api/attendance/activity-logs/today');
  await testEndpoint('Get Attendance History', 'GET', '/api/attendance-history');

  // 2.4 Leave Management
  console.log('\n🏖️ 2.4 Leave Management');
  await testEndpoint('Get All Leave Requests', 'GET', '/api/leave-requests');
  await testEndpoint('Get Leave Statistics', 'GET', '/api/leave-requests/statistics');
  await testEndpoint('Get Leave Types', 'GET', '/api/leave-requests/types');
  await testEndpoint('Get Leave Allocations', 'GET', '/api/leave-allocation');
  await testEndpoint('Get Leave Type Settings', 'GET', '/api/leave-type-settings');

  // 2.5 Expense Management
  console.log('\n💰 2.5 Expense Management');
  await testEndpoint('Get All Expenses', 'GET', '/api/expenses');
  await testEndpoint('Get Expense Statistics', 'GET', '/api/expenses/statistics');
  await testEndpoint('Get My Expenses', 'GET', '/api/expenses/my-expenses');
  await testEndpoint('Get Expense Categories', 'GET', '/api/expenses/categories');

  // 2.6 Payroll Management
  console.log('\n💵 2.6 Payroll Management');
  await testEndpoint('Get All Payslips', 'GET', '/api/payslips');
  await testEndpoint('Get My Payslips', 'GET', '/api/payslips/my-payslips');
  await testEndpoint('Get Salary Information', 'GET', '/api/salary');
  await testEndpoint('Get Payroll Information', 'GET', '/api/payroll');
  await testEndpoint('Get Advances/Loans', 'GET', '/api/advances-loans');
  await testEndpoint('Get My Advance Requests', 'GET', '/api/advances-loans/my-requests');

  // 2.7 Document Management
  console.log('\n📄 2.7 Document Management');
  await testEndpoint('Get Documents', 'GET', '/api/documents');
  await testEndpoint('Get Company Documents', 'GET', '/api/documents/company');
  await testEndpoint('Get My Documents', 'GET', '/api/documents/my-documents');

  // 2.8 Holiday Management
  console.log('\n📅 2.8 Holiday Management');
  await testEndpoint('Get All Holidays', 'GET', '/api/holidays');
  await testEndpoint('Get Holiday Calendars', 'GET', '/api/holiday-calendars');

  // 2.9 User & Role Management
  console.log('\n👤 2.9 User & Role Management');
  await testEndpoint('Get All Users', 'GET', '/api/users');
  await testEndpoint('Get All Roles', 'GET', '/api/roles');
  await testEndpoint('Get My Profile', 'GET', '/api/profile');
  await testEndpoint('Get Profile Statistics', 'GET', '/api/profile/stats');

  // 2.10 Organization Management
  console.log('\n🏢 2.10 Organization Management');
  await testEndpoint('Get Organizations', 'GET', '/api/organizations');
  await testEndpoint('Get Organization Settings', 'GET', '/api/organizations/settings');

  // 2.11 Announcements
  console.log('\n📢 2.11 Announcements');
  await testEndpoint('Get Announcements', 'GET', '/api/announcements');

  // 2.12 Tasks
  console.log('\n✅ 2.12 Tasks');
  await testEndpoint('Get Tasks', 'GET', '/api/tasks');
  await testEndpoint('Get My Tasks', 'GET', '/api/tasks/my-tasks');

  // ============================================================
  // 3. EMPLOYEE DASHBOARD SECTIONS
  // ============================================================
  console.log('\n\n👷 STEP 3: EMPLOYEE DASHBOARD SECTIONS & OPERATIONS');
  console.log('-'.repeat(70));

  await testEndpoint('Employee Dashboard Stats', 'GET', '/api/dashboard/employee/stats');
  await testEndpoint('Employee Today\'s Attendance', 'GET', '/api/dashboard/employee/todays-attendance');
  await testEndpoint('Employee Leave Balance', 'GET', '/api/dashboard/employee/leave-balance');
  await testEndpoint('Employee Upcoming Holidays', 'GET', '/api/dashboard/employee/upcoming-holidays');

  // ============================================================
  // 4. COMMUNICATION & COLLABORATION
  // ============================================================
  console.log('\n\n💬 STEP 4: COMMUNICATION & COLLABORATION');
  console.log('-'.repeat(70));

  await testEndpoint('Get Chat Conversations', 'GET', '/api/chat/conversations');
  await testEndpoint('Get Chat Messages', 'GET', '/api/chat/messages');
  await testEndpoint('Get Teams Integration Status', 'GET', '/api/chat/teams/status');

  // ============================================================
  // 5. SALES MODULE
  // ============================================================
  console.log('\n\n📈 STEP 5: SALES MODULE');
  console.log('-'.repeat(70));

  await testEndpoint('Get Sales Calls', 'GET', '/api/sales/calls');
  await testEndpoint('Get Sales Leads', 'GET', '/api/sales/leads');
  await testEndpoint('Get Sales Deals', 'GET', '/api/sales/deals');
  await testEndpoint('Get Sales Performance', 'GET', '/api/sales/performance');
  await testEndpoint('Get Revenue', 'GET', '/api/sales/revenue');

  // ============================================================
  // 6. ONBOARDING SYSTEM
  // ============================================================
  console.log('\n\n📋 STEP 6: ONBOARDING SYSTEM');
  console.log('-'.repeat(70));

  await testEndpoint('Get Onboarding Links', 'GET', '/api/onboarding/links');
  await testEndpoint('Get Onboarding Submissions', 'GET', '/api/onboarding/submissions');

  // ============================================================
  // 7. TEST SUMMARY
  // ============================================================
  console.log('\n\n' + '='.repeat(70));
  console.log('COMPREHENSIVE TEST SUMMARY');
  console.log('='.repeat(70));
  
  const passed = testResults.filter(r => r.status === 'PASS').length;
  const failed = testResults.filter(r => r.status === 'FAIL').length;
  const total = testResults.length;
  
  console.log(`\nTotal Tests: ${total}`);
  console.log(`Passed: ${passed} ✅`);
  console.log(`Failed: ${failed} ❌`);
  console.log(`Success Rate: ${((passed / total) * 100).toFixed(2)}%`);

  // Category breakdown
  console.log('\n' + '-'.repeat(70));
  console.log('SECTION BREAKDOWN');
  console.log('-'.repeat(70));
  
  const sections = {
    'Authentication': testResults.filter(r => r.test.includes('Login')),
    'Dashboard Overview': testResults.filter(r => r.test.includes('Dashboard')),
    'Employee Management': testResults.filter(r => r.test.includes('Employee') && !r.test.includes('Dashboard')),
    'Attendance': testResults.filter(r => r.test.includes('Attendance')),
    'Leave Management': testResults.filter(r => r.test.includes('Leave')),
    'Expense Management': testResults.filter(r => r.test.includes('Expense')),
    'Payroll': testResults.filter(r => r.test.includes('Payslip') || r.test.includes('Salary') || r.test.includes('Payroll') || r.test.includes('Advance')),
    'Document Management': testResults.filter(r => r.test.includes('Document')),
    'Holiday Management': testResults.filter(r => r.test.includes('Holiday')),
    'User/Role Management': testResults.filter(r => r.test.includes('User') || r.test.includes('Role') || r.test.includes('Profile')),
    'Organization': testResults.filter(r => r.test.includes('Organization')),
    'Announcements': testResults.filter(r => r.test.includes('Announcement')),
    'Tasks': testResults.filter(r => r.test.includes('Task')),
    'Communication': testResults.filter(r => r.test.includes('Chat') || r.test.includes('Teams')),
    'Sales': testResults.filter(r => r.test.includes('Sales') || r.test.includes('Revenue') || r.test.includes('Deal') || r.test.includes('Lead') || r.test.includes('Call')),
    'Onboarding': testResults.filter(r => r.test.includes('Onboarding'))
  };

  for (const [section, results] of Object.entries(sections)) {
    if (results.length > 0) {
      const sectionPassed = results.filter(r => r.status === 'PASS').length;
      const sectionFailed = results.filter(r => r.status === 'FAIL').length;
      console.log(`${section.padEnd(25)} ${sectionPassed}/${results.length} passed${sectionFailed > 0 ? `, ${sectionFailed} failed` : ''}`);
    }
  }

  // Failed tests detail
  if (failed > 0) {
    console.log('\n' + '-'.repeat(70));
    console.log('FAILED TESTS DETAIL');
    console.log('-'.repeat(70));
    testResults.filter(r => r.status === 'FAIL').forEach(r => {
      console.log(`\n❌ ${r.test}`);
      console.log(`   ${r.message}`);
    });
  }

  console.log('\n' + '='.repeat(70));
  console.log('TEST COMPLETED');
  console.log('='.repeat(70));
}

runDashboardTests().catch(err => {
  console.error('Test suite error:', err);
  process.exit(1);
});
