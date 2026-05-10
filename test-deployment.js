/**
 * Comprehensive API Testing Script for WorkPlus Pro
 * Tests all major endpoints for employee and admin dashboards
 */

const API_BASE_URL = 'https://workplus-backend-sg3a.onrender.com';
const API_TIMEOUT = 30000;

let authToken = null;
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
  if (data) console.log('   Data:', JSON.stringify(data, null, 2).substring(0, 200));
}

async function testEndpoint(name, method, endpoint, body = null, headers = {}) {
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
    const data = await response.json();
    
    if (response.ok) {
      logResult(name, 'PASS', `Status ${response.status}`, data);
      return { success: true, data };
    } else {
      logResult(name, 'FAIL', `Status ${response.status}: ${data.message || 'Unknown error'}`, data);
      return { success: false, error: data };
    }
  } catch (error) {
    logResult(name, 'FAIL', `Network error: ${error.message}`);
    return { success: false, error: error.message };
  }
}

async function runTests() {
  console.log('='.repeat(60));
  console.log('WorkPlus Pro API Testing Suite');
  console.log('='.repeat(60));
  console.log(`Backend URL: ${API_BASE_URL}`);
  console.log(`Frontend URL: https://workplus-murex.vercel.app`);
  console.log(`Started at: ${new Date().toISOString()}`);
  console.log('='.repeat(60));

  // 1. Health Check
  console.log('\n📊 HEALTH CHECK');
  await testEndpoint('Health Check', 'GET', '/health');
  await testEndpoint('API Health', 'GET', '/api/health');
  await testEndpoint('Database Health', 'GET', '/api/health/db');

  // 2. Authentication - Try multiple credential combinations
  console.log('\n🔐 AUTHENTICATION');
  const credentials = [
    { email: 'admin@workpluspro.com', password: 'admin123', name: 'Super Admin (Default)' },
    { email: 'superadmin@company.com', password: 'admin123', name: 'Super Admin (Alt)' },
    { email: 'admin@hexerve.com', password: 'admin123', name: 'Super Admin (Hexerve)' }
  ];

  for (const cred of credentials) {
    const loginResult = await testEndpoint(`Login (${cred.name})`, 'POST', '/api/auth/login', cred);
    if (loginResult.success && loginResult.data.token) {
      authToken = loginResult.data.token;
      console.log(`   ✓ Authentication token obtained with ${cred.email}`);
      break;
    }
  }

  // 3. Dashboard APIs
  if (authToken) {
    console.log('\n📈 DASHBOARD APIS');
    await testEndpoint('Admin Dashboard Stats', 'GET', '/api/dashboard/stats');
    await testEndpoint('Employee Dashboard Stats', 'GET', '/api/dashboard/employee/stats');
    await testEndpoint('Today\'s Attendance', 'GET', '/api/dashboard/todays-attendance');
    await testEndpoint('Today\'s Activity', 'GET', '/api/attendance/activity-logs/today');
  } else {
    console.log('\n⚠️ AUTHENTICATED ENDPOINTS SKIPPED');
    console.log('   Could not obtain auth token. Please provide valid credentials.');
  }

  // 4. Employee APIs
  if (authToken) {
    console.log('\n👥 EMPLOYEE APIS');
    await testEndpoint('Get All Employees', 'GET', '/api/employees?simple=true');
    await testEndpoint('Get Employees Paginated', 'GET', '/api/employees?page=1&limit=10');
  }

  // 5. Expense APIs
  if (authToken) {
    console.log('\n💰 EXPENSE APIS');
    await testEndpoint('Get All Expenses', 'GET', '/api/expenses');
    await testEndpoint('Get Expense Statistics', 'GET', '/api/expenses/statistics');
  }

  // 6. Leave Request APIs
  if (authToken) {
    console.log('\n🏖️ LEAVE REQUEST APIS');
    await testEndpoint('Get All Leave Requests', 'GET', '/api/leave-requests');
    await testEndpoint('Get Leave Statistics', 'GET', '/api/leave-requests/statistics');
  }

  // 7. Attendance APIs
  if (authToken) {
    console.log('\n⏰ ATTENDANCE APIS');
    await testEndpoint('Get Attendance Records', 'GET', '/api/attendance');
    await testEndpoint('Get Attendance Statistics', 'GET', '/api/attendance/statistics');
  }

  // 8. Holiday APIs
  if (authToken) {
    console.log('\n📅 HOLIDAY APIS');
    await testEndpoint('Get All Holidays', 'GET', '/api/holidays');
  }

  // 9. Payroll APIs
  if (authToken) {
    console.log('\n💵 PAYROLL APIS');
    await testEndpoint('Get All Payslips', 'GET', '/api/payslips');
  }

  // 10. Document APIs
  if (authToken) {
    console.log('\n📄 DOCUMENT APIS');
    await testEndpoint('Get Documents', 'GET', '/api/documents');
  }

  // Generate Report
  console.log('\n' + '='.repeat(60));
  console.log('TEST SUMMARY');
  console.log('='.repeat(60));
  
  const passed = testResults.filter(r => r.status === 'PASS').length;
  const failed = testResults.filter(r => r.status === 'FAIL').length;
  const total = testResults.length;
  
  console.log(`Total Tests: ${total}`);
  console.log(`Passed: ${passed} ✅`);
  console.log(`Failed: ${failed} ❌`);
  console.log(`Success Rate: ${total > 0 ? ((passed / total) * 100).toFixed(2) : 0}%`);
  
  console.log('\n' + '='.repeat(60));
  console.log('DETAILED RESULTS');
  console.log('='.repeat(60));
  
  testResults.forEach(result => {
    console.log(`\n${result.status === 'PASS' ? '✅' : '❌'} ${result.test}`);
    console.log(`   Status: ${result.status}`);
    console.log(`   Message: ${result.message}`);
    if (result.status === 'FAIL') {
      console.log(`   Timestamp: ${result.timestamp}`);
    }
  });

  console.log('\n' + '='.repeat(60));
  console.log('RECOMMENDATIONS');
  console.log('='.repeat(60));
  
  if (!authToken) {
    console.log('\n⚠️  AUTHENTICATION REQUIRED');
    console.log('   - Provide valid super admin credentials to test authenticated endpoints');
    console.log('   - Check SUPER_ADMIN_EMAIL and SUPER_ADMIN_PASSWORD in Render environment');
    console.log('   - Alternatively, test the frontend at https://workplus-murex.vercel.app');
  }

  const healthPassed = testResults.filter(r => r.test.includes('Health') && r.status === 'PASS').length;
  const healthTotal = testResults.filter(r => r.test.includes('Health')).length;
  
  if (healthPassed === healthTotal) {
    console.log('\n✅ BACKEND INFRASTRUCTURE');
    console.log('   - All health checks passed');
    console.log('   - Database is connected');
    console.log('   - Server is responding correctly');
  }

  // Save results to file
  console.log('\n📄 Test results available above');
}

runTests().catch(console.error);
