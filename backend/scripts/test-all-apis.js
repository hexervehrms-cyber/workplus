#!/usr/bin/env node

/**
 * Test All API Endpoints
 * Verifies all functions are properly connected
 */

import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Setup __dirname for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
const envPath = path.join(__dirname, '..', '.env');
dotenv.config({ path: envPath });

const BASE_URL = 'http://localhost:5000';
let adminToken = '';
let employeeToken = '';
let adminUserId = '';
let employeeUserId = '';

// Test results
const results = {
  passed: [],
  failed: []
};

// Helper function to make API calls
async function apiCall(method, endpoint, body = null, token = null) {
  try {
    const options = {
      method,
      headers: {
        'Content-Type': 'application/json'
      }
    };

    if (token) {
      options.headers['Authorization'] = `Bearer ${token}`;
    }

    if (body) {
      options.body = JSON.stringify(body);
    }

    const response = await fetch(`${BASE_URL}${endpoint}`, options);
    const data = await response.json();

    return {
      status: response.status,
      ok: response.ok,
      data
    };
  } catch (error) {
    return {
      status: 0,
      ok: false,
      error: error.message
    };
  }
}

// Test function
async function test(name, method, endpoint, body = null, token = null, expectedStatus = 200) {
  try {
    const result = await apiCall(method, endpoint, body, token);
    
    if (result.status === expectedStatus) {
      results.passed.push({ name, status: result.status });
      console.log(`✅ ${name}`);
      return result.data;
    } else {
      results.failed.push({ name, expected: expectedStatus, got: result.status, error: result.data?.message });
      console.log(`❌ ${name} - Expected ${expectedStatus}, got ${result.status}`);
      return null;
    }
  } catch (error) {
    results.failed.push({ name, error: error.message });
    console.log(`❌ ${name} - ${error.message}`);
    return null;
  }
}

// Main test function
async function runTests() {
  console.log('\n🚀 Testing All API Endpoints\n');
  console.log('═'.repeat(80));

  // 1. Health Check
  console.log('\n📋 1. HEALTH CHECK\n');
  await test('Health Check', 'GET', '/api/health', null, null, 200);

  // 2. Authentication
  console.log('\n📋 2. AUTHENTICATION\n');
  
  const adminLoginResult = await test(
    'Admin Login',
    'POST',
    '/api/auth/login',
    { email: 'atul@hexerve.com', password: 'Jadu@123' },
    null,
    200
  );
  
  if (adminLoginResult?.token) {
    adminToken = adminLoginResult.token;
    adminUserId = adminLoginResult.user?.id;
    console.log(`   Admin Token: ${adminToken.substring(0, 20)}...`);
    console.log(`   Admin User ID: ${adminUserId}`);
  } else {
    console.log('   ❌ Failed to get admin token');
  }

  const employeeLoginResult = await test(
    'Employee Login',
    'POST',
    '/api/auth/login',
    { email: 'abhishek.rajput@hexerve.com', password: 'Employee@123' },
    null,
    200
  );
  
  if (employeeLoginResult?.token) {
    employeeToken = employeeLoginResult.token;
    employeeUserId = employeeLoginResult.user?.id;
    console.log(`   Employee Token: ${employeeToken.substring(0, 20)}...`);
    console.log(`   Employee User ID: ${employeeUserId}`);
  } else {
    console.log('   ❌ Failed to get employee token');
  }

  // 3. Profile
  console.log('\n📋 3. PROFILE\n');
  await test('Get Admin Profile', 'GET', '/api/auth/me', null, adminToken, 200);
  await test('Get Employee Profile', 'GET', '/api/auth/me', null, employeeToken, 200);

  // 4. Employees
  console.log('\n📋 4. EMPLOYEES\n');
  await test('Get All Employees', 'GET', '/api/employees', null, adminToken, 200);
  await test('Get Employee by ID', 'GET', `/api/employees/${employeeUserId}`, null, adminToken, 200);

  // 5. Expenses
  console.log('\n📋 5. EXPENSES\n');
  await test('Get Admin Expenses', 'GET', `/api/expenses/user/${adminUserId}`, null, adminToken, 200);
  await test('Get Employee Expenses', 'GET', `/api/expenses/user/${employeeUserId}`, null, employeeToken, 200);
  
  const createExpenseResult = await test(
    'Create Expense',
    'POST',
    '/api/expenses',
    {
      title: 'Test Expense',
      category: 'Travel - Local Conveyance',
      amount: 500,
      date: new Date().toISOString().split('T')[0],
      description: 'Test expense for API verification'
    },
    employeeToken,
    200
  );

  if (createExpenseResult?.data?._id) {
    const expenseId = createExpenseResult.data._id;
    await test('Get Expense by ID', 'GET', `/api/expenses/${expenseId}`, null, employeeToken, 200);
    await test('Update Expense', 'PUT', `/api/expenses/${expenseId}`, 
      { amount: 600, description: 'Updated test expense' }, 
      employeeToken, 200);
  }

  // 6. Leave Requests
  console.log('\n📋 6. LEAVE REQUESTS\n');
  await test('Get Leave Requests', 'GET', '/api/leave-requests', null, employeeToken, 200);
  
  const createLeaveResult = await test(
    'Create Leave Request',
    'POST',
    '/api/leave-requests',
    {
      leaveType: 'Casual Leave',
      startDate: new Date().toISOString().split('T')[0],
      endDate: new Date(Date.now() + 86400000).toISOString().split('T')[0],
      reason: 'Test leave request'
    },
    employeeToken,
    200
  );

  if (createLeaveResult?.data?._id) {
    const leaveId = createLeaveResult.data._id;
    await test('Get Leave Request by ID', 'GET', `/api/leave-requests/${leaveId}`, null, employeeToken, 200);
  }

  // 7. Attendance
  console.log('\n📋 7. ATTENDANCE\n');
  await test('Get Attendance', 'GET', '/api/attendance', null, employeeToken, 200);
  
  const checkInResult = await test(
    'Check In',
    'POST',
    '/api/attendance/check-in',
    { latitude: 28.6139, longitude: 77.2090 },
    employeeToken,
    200
  );

  if (checkInResult?.data?._id) {
    const attendanceId = checkInResult.data._id;
    await test('Check Out', 'PUT', `/api/attendance/${attendanceId}/check-out`,
      { latitude: 28.6139, longitude: 77.2090 },
      employeeToken,
      200
    );
  }

  // 8. Holidays
  console.log('\n📋 8. HOLIDAYS\n');
  await test('Get Holidays', 'GET', '/api/holidays', null, employeeToken, 200);

  // 9. Documents
  console.log('\n📋 9. DOCUMENTS\n');
  await test('Get Documents', 'GET', '/api/documents', null, employeeToken, 200);

  // 10. Dashboard
  console.log('\n📋 10. DASHBOARD\n');
  await test('Get Admin Dashboard', 'GET', '/api/dashboard', null, adminToken, 200);
  await test('Get Employee Dashboard', 'GET', '/api/dashboard', null, employeeToken, 200);

  // 11. Users Management
  console.log('\n📋 11. USERS MANAGEMENT\n');
  await test('Get All Users', 'GET', '/api/users', null, adminToken, 200);

  // 12. Roles
  console.log('\n📋 12. ROLES\n');
  await test('Get Roles', 'GET', '/api/roles', null, adminToken, 200);

  // Summary
  console.log('\n' + '═'.repeat(80));
  console.log('\n📊 TEST SUMMARY\n');
  console.log(`✅ Passed: ${results.passed.length}`);
  console.log(`❌ Failed: ${results.failed.length}`);
  console.log(`Total: ${results.passed.length + results.failed.length}`);

  if (results.failed.length > 0) {
    console.log('\n❌ Failed Tests:\n');
    results.failed.forEach(test => {
      console.log(`   - ${test.name}`);
      if (test.error) console.log(`     Error: ${test.error}`);
      if (test.expected) console.log(`     Expected: ${test.expected}, Got: ${test.got}`);
    });
  }

  console.log('\n' + '═'.repeat(80) + '\n');

  // Exit with appropriate code
  process.exit(results.failed.length > 0 ? 1 : 0);
}

// Run tests
runTests().catch(error => {
  console.error('Test error:', error);
  process.exit(1);
});
