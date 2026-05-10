/**
 * Comprehensive API Testing Script - ALL Endpoints
 * Tests public endpoints and tries to create a test user for authenticated testing
 */

const API_BASE_URL = 'https://workplus-backend-sg3a.onrender.com';
const API_TIMEOUT = 30000;

let authToken = null;
let testUser = null;
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
  console.log(`${status === 'PASS' ? '✅' : status === 'SKIP' ? '⚠️' : '❌'} ${testName}: ${message}`);
}

async function testEndpoint(name, method, endpoint, body = null, headers = {}, expectAuth = false) {
  try {
    const url = `${API_BASE_URL}${endpoint}`;
    const options = {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...headers,
        ...(authToken && { Authorization: `Bearer ${authToken}` })
      },
      ...(body && { body: JSON.stringify(body) })
    };

    const response = await fetch(url, options);
    let data;
    try {
      data = await response.json();
    } catch {
      data = { raw: await response.text() };
    }
    
    if (response.ok) {
      logResult(name, 'PASS', `Status ${response.status}`, data);
      return { success: true, data, status: response.status };
    } else {
      if (expectAuth && response.status === 401) {
        logResult(name, 'SKIP', `Status ${response.status}: Authentication required`, data);
      } else {
        logResult(name, 'FAIL', `Status ${response.status}: ${data.message || 'Unknown error'}`, data);
      }
      return { success: false, error: data, status: response.status };
    }
  } catch (error) {
    logResult(name, 'FAIL', `Error: ${error.message}`);
    return { success: false, error: error.message };
  }
}

async function runTests() {
  console.log('='.repeat(70));
  console.log('WORKPLUS PRO - COMPREHENSIVE API TESTING SUITE');
  console.log('='.repeat(70));
  console.log(`Backend: ${API_BASE_URL}`);
  console.log(`Frontend: https://workplus-qbshegha8-hexervehrms-8667s-projects.vercel.app`);
  console.log(`Started: ${new Date().toISOString()}`);
  console.log('='.repeat(70));

  // ============================================================
  // SECTION 1: PUBLIC ENDPOINTS (No Authentication Required)
  // ============================================================
  console.log('\n\n🔓 SECTION 1: PUBLIC ENDPOINTS');
  console.log('-'.repeat(70));

  // Health & Status
  console.log('\n📊 Health & Status');
  await testEndpoint('Health Check', 'GET', '/health');
  await testEndpoint('API Health', 'GET', '/api/health');
  await testEndpoint('Database Health', 'GET', '/api/health/db');
  await testEndpoint('Root Endpoint', 'GET', '/');

  // Authentication
  console.log('\n🔐 Authentication (Public)');
  
  // Try multiple credential sets for login
  const credsToTry = [
    { email: 'admin@workpluspro.com', password: 'admin123' },
    { email: 'superadmin@company.com', password: 'admin123' },
    { email: 'admin@hexerve.com', password: 'admin123' },
    { email: 'demo@workplus.com', password: 'demo123' }
  ];
  
  let loginSuccess = false;
  for (const creds of credsToTry) {
    const result = await testEndpoint(`Login Attempt (${creds.email})`, 'POST', '/api/auth/login', creds);
    if (result.success && result.data.token) {
      authToken = result.data.token;
      testUser = result.data.user;
      loginSuccess = true;
      console.log(`   ✓ Logged in as: ${result.data.user.name} (${result.data.user.role})`);
      break;
    }
  }

  // If login failed, try to register
  if (!loginSuccess) {
    console.log('\n📝 Attempting to register test user...');
    const registerResult = await testEndpoint('Register Test User', 'POST', '/api/auth/register', {
      name: 'Test User',
      email: `test${Date.now()}@workplus.com`,
      password: 'TestPass123!',
      role: 'employee'
    });
    
    if (registerResult.success) {
      console.log('   ✓ User registered, attempting login...');
      const loginAfterRegister = await testEndpoint('Login After Register', 'POST', '/api/auth/login', {
        email: registerResult.data.user?.email,
        password: 'TestPass123!'
      });
      if (loginAfterRegister.success && loginAfterRegister.data.token) {
        authToken = loginAfterRegister.data.token;
        testUser = loginAfterRegister.data.user;
        loginSuccess = true;
      }
    }
  }

  // Onboarding (Public)
  console.log('\n📋 Onboarding (Public)');
  await testEndpoint('Validate Onboarding Token', 'GET', '/api/onboarding/validate/test-token-123');
  await testEndpoint('Submit Onboarding', 'POST', '/api/onboarding/submit', {
    token: 'test-token',
    personalInfo: { firstName: 'Test', lastName: 'User' }
  });

  // ============================================================
  // SECTION 2: AUTHENTICATED ENDPOINTS
  // ============================================================
  if (!authToken) {
    console.log('\n\n⚠️ SECTION 2: AUTHENTICATED ENDPOINTS - SKIPPED');
    console.log('   No valid authentication token obtained.');
    console.log('   To test authenticated endpoints, provide valid credentials.');
  } else {
    console.log('\n\n🔒 SECTION 2: AUTHENTICATED ENDPOINTS');
    console.log('-'.repeat(70));

    // Dashboard
    console.log('\n📈 Dashboard APIs');
    await testEndpoint('Admin Dashboard Stats', 'GET', '/api/dashboard/stats');
    await testEndpoint('Super Admin Dashboard', 'GET', '/api/dashboard/superadmin');
    await testEndpoint('Employee Dashboard', 'GET', '/api/dashboard/employee/stats');
    await testEndpoint('Today\'s Attendance', 'GET', '/api/dashboard/todays-attendance');
    await testEndpoint('Dashboard Activity', 'GET', '/api/dashboard/activity');

    // Profile
    console.log('\n👤 Profile APIs');
    await testEndpoint('Get My Profile', 'GET', '/api/profile');
    await testEndpoint('Get Profile Stats', 'GET', '/api/profile/stats');

    // Employees
    console.log('\n👥 Employee APIs');
    await testEndpoint('Get All Employees', 'GET', '/api/employees?simple=true');
    await testEndpoint('Get Employees Paginated', 'GET', '/api/employees?page=1&limit=10');
    await testEndpoint('Get Employee Stats', 'GET', '/api/employees/stats');
    await testEndpoint('Get Departments', 'GET', '/api/employees/departments');

    // Attendance
    console.log('\n⏰ Attendance APIs');
    await testEndpoint('Get Attendance Records', 'GET', '/api/attendance');
    await testEndpoint('Get Attendance Stats', 'GET', '/api/attendance/statistics');
    await testEndpoint('Get Today\'s Activity Logs', 'GET', '/api/attendance/activity-logs/today');
    await testEndpoint('Attendance History', 'GET', '/api/attendance-history');

    // Leave Requests
    console.log('\n🏖️ Leave Request APIs');
    await testEndpoint('Get All Leave Requests', 'GET', '/api/leave-requests');
    await testEndpoint('Get Leave Statistics', 'GET', '/api/leave-requests/statistics');
    await testEndpoint('Get Leave Types', 'GET', '/api/leave-requests/types');

    // Expenses
    console.log('\n💰 Expense APIs');
    await testEndpoint('Get All Expenses', 'GET', '/api/expenses');
    await testEndpoint('Get Expense Statistics', 'GET', '/api/expenses/statistics');
    await testEndpoint('Get My Expenses', 'GET', '/api/expenses/my-expenses');

    // Payroll
    console.log('\n💵 Payroll APIs');
    await testEndpoint('Get All Payslips', 'GET', '/api/payslips');
    await testEndpoint('Get My Payslips', 'GET', '/api/payslips/my-payslips');
    await testEndpoint('Get Salary Info', 'GET', '/api/salary');
    await testEndpoint('Get Payroll Info', 'GET', '/api/payroll');

    // Holidays
    console.log('\n📅 Holiday APIs');
    await testEndpoint('Get All Holidays', 'GET', '/api/holidays');
    await testEndpoint('Get Holiday Calendars', 'GET', '/api/holiday-calendars');

    // Documents
    console.log('\n📄 Document APIs');
    await testEndpoint('Get Documents', 'GET', '/api/documents');
    await testEndpoint('Get Company Documents', 'GET', '/api/documents/company');

    // Users & Roles
    console.log('\n👤 User & Role APIs');
    await testEndpoint('Get All Users', 'GET', '/api/users');
    await testEndpoint('Get All Roles', 'GET', '/api/roles');

    // Announcements
    console.log('\n📢 Announcement APIs');
    await testEndpoint('Get Announcements', 'GET', '/api/announcements');

    // Tasks
    console.log('\n✅ Task APIs');
    await testEndpoint('Get Tasks', 'GET', '/api/tasks');

    // Organizations
    console.log('\n🏢 Organization APIs');
    await testEndpoint('Get Organizations', 'GET', '/api/organizations');

    // Onboarding (Protected)
    console.log('\n📋 Onboarding (Protected)');
    await testEndpoint('Get Onboarding Links', 'GET', '/api/onboarding/links');
    await testEndpoint('Get Onboarding Submissions', 'GET', '/api/onboarding/submissions');

    // Chat
    console.log('\n💬 Chat APIs');
    await testEndpoint('Get Chat Conversations', 'GET', '/api/chat/conversations');

    // Advance/Loan
    console.log('\n💳 Advance/Loan APIs');
    await testEndpoint('Get Advances/Loans', 'GET', '/api/advances-loans');
    await testEndpoint('Get My Advance Requests', 'GET', '/api/advances-loans/my-requests');

    // Leave Allocation
    console.log('\n📊 Leave Allocation APIs');
    await testEndpoint('Get Leave Allocations', 'GET', '/api/leave-allocation');

    // Notifications
    console.log('\n🔔 Notification APIs');
    await testEndpoint('Get Notifications', 'GET', '/api/notifications');

    // Sales
    console.log('\n📈 Sales APIs');
    await testEndpoint('Get Sales Calls', 'GET', '/api/sales/calls');
    await testEndpoint('Get Sales Leads', 'GET', '/api/sales/leads');
    await testEndpoint('Get Sales Deals', 'GET', '/api/sales/deals');
    await testEndpoint('Get Sales Performance', 'GET', '/api/sales/performance');
    await testEndpoint('Get Revenue', 'GET', '/api/sales/revenue');
  }

  // ============================================================
  // TEST SUMMARY
  // ============================================================
  console.log('\n\n' + '='.repeat(70));
  console.log('TEST SUMMARY');
  console.log('='.repeat(70));
  
  const passed = testResults.filter(r => r.status === 'PASS').length;
  const failed = testResults.filter(r => r.status === 'FAIL').length;
  const skipped = testResults.filter(r => r.status === 'SKIP').length;
  const total = testResults.length;
  
  console.log(`\nTotal Tests:    ${total}`);
  console.log(`Passed:         ${passed} ✅`);
  console.log(`Failed:         ${failed} ❌`);
  console.log(`Skipped (Auth): ${skipped} ⚠️`);
  console.log(`Success Rate:   ${total > 0 ? ((passed / total) * 100).toFixed(2) : 0}%`);

  // Category breakdown
  console.log('\n' + '-'.repeat(70));
  console.log('CATEGORY BREAKDOWN');
  console.log('-'.repeat(70));
  
  const categories = {
    'Health': testResults.filter(r => r.test.includes('Health')),
    'Auth': testResults.filter(r => r.test.includes('Login') || r.test.includes('Register') || r.test.includes('Logout')),
    'Dashboard': testResults.filter(r => r.test.includes('Dashboard')),
    'Employee': testResults.filter(r => r.test.includes('Employee')),
    'Attendance': testResults.filter(r => r.test.includes('Attendance')),
    'Leave': testResults.filter(r => r.test.includes('Leave')),
    'Expense': testResults.filter(r => r.test.includes('Expense')),
    'Payroll': testResults.filter(r => r.test.includes('Payroll') || r.test.includes('Payslip') || r.test.includes('Salary')),
    'Holiday': testResults.filter(r => r.test.includes('Holiday')),
    'Document': testResults.filter(r => r.test.includes('Document')),
    'Onboarding': testResults.filter(r => r.test.includes('Onboarding')),
    'User/Role': testResults.filter(r => r.test.includes('User') || r.test.includes('Role') || r.test.includes('Profile')),
    'Task': testResults.filter(r => r.test.includes('Task')),
    'Org': testResults.filter(r => r.test.includes('Organization')),
    'Chat': testResults.filter(r => r.test.includes('Chat')),
    'Sales': testResults.filter(r => r.test.includes('Sales') || r.test.includes('Revenue')),
    'Advance': testResults.filter(r => r.test.includes('Advance')),
    'Notification': testResults.filter(r => r.test.includes('Notification'))
  };

  for (const [cat, results] of Object.entries(categories)) {
    if (results.length > 0) {
      const catPassed = results.filter(r => r.status === 'PASS').length;
      const catFailed = results.filter(r => r.status === 'FAIL').length;
      const catSkipped = results.filter(r => r.status === 'SKIP').length;
      console.log(`${cat.padEnd(15)} ${catPassed}/${results.length} passed${catFailed > 0 ? `, ${catFailed} failed` : ''}${catSkipped > 0 ? `, ${catSkipped} skipped` : ''}`);
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

  // Skipped tests
  if (skipped > 0) {
    console.log('\n' + '-'.repeat(70));
    console.log('SKIPPED TESTS (Authentication Required)');
    console.log('-'.repeat(70));
    testResults.filter(r => r.status === 'SKIP').forEach(r => {
      console.log(`⚠️ ${r.test}`);
    });
  }

  // Recommendations
  console.log('\n' + '='.repeat(70));
  console.log('RECOMMENDATIONS');
  console.log('='.repeat(70));
  
  if (!authToken) {
    console.log('\n⚠️ AUTHENTICATION REQUIRED');
    console.log('   To test authenticated endpoints:');
    console.log('   1. Check Render dashboard for SUPER_ADMIN_EMAIL and SUPER_ADMIN_PASSWORD');
    console.log('   2. Or test via the frontend at https://workplus-qbshegha8-hexervehrms-8667s-projects.vercel.app');
    console.log('   3. Or create a test user via the registration endpoint if enabled');
  } else {
    console.log('\n✅ AUTHENTICATED TESTING COMPLETE');
    console.log(`   Tested as: ${testUser?.name} (${testUser?.role})`);
  }

  console.log('\n✅ PUBLIC ENDPOINTS');
  const publicPassed = testResults.filter(r => !r.test.includes('Dashboard') && 
    !r.test.includes('Employee') && !r.test.includes('Attendance') && 
    !r.test.includes('Leave') && !r.test.includes('Expense') && 
    !r.test.includes('Payroll') && !r.test.includes('Payslip') && 
    !r.test.includes('Salary') && !r.test.includes('Holiday') && 
    !r.test.includes('Document') && !r.test.includes('Profile') && 
    !r.test.includes('User') && !r.test.includes('Role') && 
    !r.test.includes('Task') && !r.test.includes('Organization') && 
    !r.test.includes('Chat') && !r.test.includes('Sales') && 
    !r.test.includes('Revenue') && !r.test.includes('Advance') && 
    !r.test.includes('Notification') && r.status === 'PASS').length;
  console.log(`   ${publicPassed} public endpoints responding correctly`);

  console.log('\n' + '='.repeat(70));
}

runTests().catch(err => {
  console.error('Test suite error:', err);
  process.exit(1);
});
