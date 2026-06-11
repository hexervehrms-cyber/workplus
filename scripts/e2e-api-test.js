#!/usr/bin/env node

/**
 * Phase 3A: API-Level E2E Testing for WorkPlus HRMS
 * Tests real backend flows without browser automation
 * 
 * Usage: node scripts/e2e-api-test.js
 */

import dotenv from 'dotenv';
import fetch from 'node-fetch';
import FormData from 'form-data';
import fs from 'fs';

// Load environment variables
dotenv.config({ path: './backend/.env' });

const API_BASE = process.env.API_URL || 'https://hexerve.online';
const TIMESTAMP = Date.now();

// Test credentials
const SUPER_ADMIN_EMAIL = process.env.SUPER_ADMIN_EMAIL;
const SUPER_ADMIN_PASSWORD = process.env.SUPER_ADMIN_PASSWORD;

// Storage for tokens and data
let superAdminToken = null;
let adminToken = null;
let employeeToken = null;
let testEmployeeId = null;
let testEmployeeUserId = null;
let testLeaveId = null;
let testExpenseId = null;

// Results tracking
const results = {
  passed: [],
  failed: [],
  blocked: [],
  createdData: [],
  bugs: []
};

// Helper to mask sensitive data
function maskData(value, type = 'token') {
  if (!value) return '<not-set>';
  if (type === 'token') return value.substring(0, 10) + '...' + value.substring(-5);
  if (type === 'email') return value.substring(0, 3) + '***@' + value.split('@')[1];
  if (type === 'id') return value.substring(0, 8) + '...';
  return value;
}

// HTTP helper
async function request(method, path, body = null, token = null, headers = {}) {
  const options = {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...headers,
      ...(token && { 'Authorization': `Bearer ${token}` })
    }
  };

  if (body) options.body = JSON.stringify(body);

  try {
    const response = await fetch(`${API_BASE}${path}`, options);
    const data = response.status !== 204 ? await response.json() : null;
    return { status: response.status, data, headers: response.headers };
  } catch (error) {
    return { status: 0, error: error.message, data: null };
  }
}

// Test: Health Check
async function testHealthCheck() {
  console.log('\n=== TEST: Health Check ===');
  const result = await request('GET', '/health');
  
  if (result.status === 200 && result.data?.status === 'healthy') {
    console.log('✅ PASSED: Health check successful');
    console.log(`   Database: ${result.data.database?.status}`);
    results.passed.push('Health Check');
    return true;
  } else {
    console.log('❌ FAILED: Health check failed');
    console.log(`   Status: ${result.status}`);
    results.failed.push({ test: 'Health Check', status: result.status });
    return false;
  }
}

// Test: Super Admin Login
async function testSuperAdminLogin() {
  console.log('\n=== TEST: Super Admin Login ===');
  
  if (!SUPER_ADMIN_EMAIL || !SUPER_ADMIN_PASSWORD) {
    console.log('⚠️  BLOCKED: SUPER_ADMIN credentials not set in .env');
    results.blocked.push('Super Admin Login - Missing credentials');
    return false;
  }

  const result = await request('POST', '/api/auth/login', {
    email: SUPER_ADMIN_EMAIL,
    password: SUPER_ADMIN_PASSWORD
  });

  if (result.status === 200 && result.data?.data?.token) {
    superAdminToken = result.data.data.token;
    console.log('✅ PASSED: Super Admin login successful');
    console.log(`   Email: ${maskData(SUPER_ADMIN_EMAIL, 'email')}`);
    console.log(`   Token: ${maskData(superAdminToken)}`);
    console.log(`   Role: ${result.data.data.role}`);
    results.passed.push('Super Admin Login');
    return true;
  } else {
    console.log('❌ FAILED: Super Admin login failed');
    console.log(`   Status: ${result.status}`);
    console.log(`   Error: ${result.data?.message || result.error}`);
    results.failed.push({ test: 'Super Admin Login', status: result.status, message: result.data?.message });
    return false;
  }
}

// Test: Create Test Employee
async function testCreateEmployee() {
  console.log('\n=== TEST: Create Test Employee ===');
  
  if (!superAdminToken) {
    console.log('⚠️  BLOCKED: Super Admin not authenticated');
    results.blocked.push('Create Employee - No admin token');
    return false;
  }

  const testEmail = `test-emp-${TIMESTAMP}@test.local`;
  const testPassword = 'Test@123456';

  const result = await request('POST', '/api/employees?orgId=6a0d9564dfe49297b5c3d011', {
    name: `Test Employee${TIMESTAMP}`,
    email: testEmail,
    password: testPassword,
    phone: '1234567890',
    department: 'Testing',
    designation: 'Test User',
    joiningDate: new Date().toISOString()
  }, superAdminToken);

  if (result.status === 201 || (result.status === 200 && result.data?.data?._id)) {
    testEmployeeId = result.data.data._id || result.data.data.employee?._id;
    testEmployeeUserId = result.data.data.userId;
    
    console.log('✅ PASSED: Employee created');
    console.log(`   Employee ID: ${maskData(testEmployeeId, 'id')}`);
    console.log(`   Email: ${maskData(testEmail, 'email')}`);
    console.log(`   User ID: ${maskData(testEmployeeUserId, 'id')}`);
    
    results.passed.push('Create Employee');
    results.createdData.push({
      type: 'Employee',
      id: testEmployeeId,
      email: testEmail
    });
    return true;
  } else {
    console.log('❌ FAILED: Employee creation failed');
    console.log(`   Status: ${result.status}`);
    console.log(`   Error: ${result.data?.message || result.error}`);
    results.failed.push({ test: 'Create Employee', status: result.status });
    return false;
  }
}

// Test: Get Employee List
async function testGetEmployeeList() {
  console.log('\n=== TEST: Get Employee List ===');
  
  if (!superAdminToken) {
    console.log('⚠️  BLOCKED: Super Admin not authenticated');
    results.blocked.push('Get Employee List - No admin token');
    return false;
  }

  // Use the known org ID where admins exist
  const result = await request('GET', '/api/employees?page=1&limit=10&orgId=6a0d9564dfe49297b5c3d011', null, superAdminToken);

  if (result.status === 200) {
    const employees = result.data?.data || [];
    console.log('✅ PASSED: Employee list retrieved');
    console.log(`   Total employees: ${employees.length}`);
    
    if (testEmployeeId && employees.find(e => e._id === testEmployeeId)) {
      console.log(`   ✓ Test employee found in list`);
    }
    
    results.passed.push('Get Employee List');
    return true;
  } else {
    console.log('❌ FAILED: Employee list retrieval failed');
    console.log(`   Status: ${result.status}`);
    results.failed.push({ test: 'Get Employee List', status: result.status });
    return false;
  }
}

// Test: Employee Login
async function testEmployeeLogin() {
  console.log('\n=== TEST: Employee Login ===');
  
  if (!testEmployeeId) {
    console.log('⚠️  BLOCKED: Test employee not created');
    results.blocked.push('Employee Login - No test employee');
    return false;
  }

  const testEmail = `test-emp-${TIMESTAMP}@test.local`;
  const testPassword = 'Test@123456';

  const result = await request('POST', '/api/auth/login', {
    email: testEmail,
    password: testPassword
  });

  if (result.status === 200 && result.data?.data?.token) {
    employeeToken = result.data.data.token;
    console.log('✅ PASSED: Employee login successful');
    console.log(`   Email: ${maskData(testEmail, 'email')}`);
    console.log(`   Token: ${maskData(employeeToken)}`);
    console.log(`   Role: ${result.data.data.role}`);
    results.passed.push('Employee Login');
    return true;
  } else {
    console.log('❌ FAILED: Employee login failed');
    console.log(`   Status: ${result.status}`);
    console.log(`   Error: ${result.data?.message || result.error}`);
    results.failed.push({ test: 'Employee Login', status: result.status });
    return false;
  }
}

// Test: Employee Dashboard
async function testEmployeeDashboard() {
  console.log('\n=== TEST: Employee Dashboard ===');
  
  if (!employeeToken) {
    console.log('⚠️  BLOCKED: Employee not authenticated');
    results.blocked.push('Employee Dashboard - No employee token');
    return false;
  }

  const result = await request('GET', '/api/employee-dashboard', null, employeeToken);

  if (result.status === 200) {
    console.log('✅ PASSED: Employee dashboard loaded');
    console.log(`   Data keys: ${Object.keys(result.data?.data || {}).join(', ')}`);
    results.passed.push('Employee Dashboard');
    return true;
  } else if (result.status === 404) {
    console.log('⚠️  BLOCKED: Employee dashboard endpoint not found (optional)');
    results.blocked.push('Employee Dashboard - Endpoint not found');
    return false;
  } else {
    console.log('❌ FAILED: Employee dashboard load failed');
    console.log(`   Status: ${result.status}`);
    results.failed.push({ test: 'Employee Dashboard', status: result.status });
    return false;
  }
}

// Test: Attendance Today
async function testAttendanceToday() {
  console.log('\n=== TEST: Attendance Today ===');
  
  if (!employeeToken) {
    console.log('⚠️  BLOCKED: Employee not authenticated');
    results.blocked.push('Attendance Today - No employee token');
    return false;
  }

  const result = await request('GET', '/api/attendance/today', null, employeeToken);

  if (result.status === 200) {
    console.log('✅ PASSED: Attendance today retrieved');
    console.log(`   Status: ${result.data?.data?.status || 'unknown'}`);
    results.passed.push('Attendance Today');
    return true;
  } else {
    console.log('❌ FAILED: Attendance today retrieval failed');
    console.log(`   Status: ${result.status}`);
    results.failed.push({ test: 'Attendance Today', status: result.status });
    return false;
  }
}

// Test: Check-In
async function testCheckIn() {
  console.log('\n=== TEST: Check-In ===');
  
  if (!employeeToken) {
    console.log('⚠️  BLOCKED: Employee not authenticated');
    results.blocked.push('Check-In - No employee token');
    return false;
  }

  const result = await request('POST', '/api/attendance/check-in', {
    status: 'present',
    location: 'Office'
  }, employeeToken);

  if (result.status === 200 || result.status === 201) {
    console.log('✅ PASSED: Check-in successful');
    console.log(`   Time: ${new Date().toISOString()}`);
    results.passed.push('Check-In');
    return true;
  } else {
    console.log('❌ FAILED: Check-in failed');
    console.log(`   Status: ${result.status}`);
    console.log(`   Error: ${result.data?.message || result.error}`);
    results.failed.push({ test: 'Check-In', status: result.status });
    return false;
  }
}

// Test: Check-Out
async function testCheckOut() {
  console.log('\n=== TEST: Check-Out ===');
  
  if (!employeeToken) {
    console.log('⚠️  BLOCKED: Employee not authenticated');
    results.blocked.push('Check-Out - No employee token');
    return false;
  }

  const result = await request('POST', '/api/attendance/check-out', {}, employeeToken);

  if (result.status === 200 || result.status === 201) {
    console.log('✅ PASSED: Check-out successful');
    results.passed.push('Check-Out');
    return true;
  } else {
    console.log('❌ FAILED: Check-out failed');
    console.log(`   Status: ${result.status}`);
    results.failed.push({ test: 'Check-Out', status: result.status });
    return false;
  }
}

// Test: Submit Leave
async function testSubmitLeave() {
  console.log('\n=== TEST: Submit Leave ===');
  
  if (!employeeToken) {
    console.log('⚠️  BLOCKED: Employee not authenticated');
    results.blocked.push('Submit Leave - No employee token');
    return false;
  }

  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const dayAfter = new Date(tomorrow);
  dayAfter.setDate(dayAfter.getDate() + 1);

  const result = await request('POST', '/api/leave', {
    leaveType: 'casual',
    startDate: tomorrow.toISOString().split('T')[0],
    endDate: dayAfter.toISOString().split('T')[0],
    reason: `Test Leave ${TIMESTAMP}`,
    isHalfDay: false
  }, employeeToken);

  if (result.status === 200 || result.status === 201) {
    testLeaveId = result.data?.data?._id;
    console.log('✅ PASSED: Leave submitted');
    console.log(`   Leave ID: ${maskData(testLeaveId, 'id')}`);
    console.log(`   Dates: ${tomorrow.toISOString().split('T')[0]} to ${dayAfter.toISOString().split('T')[0]}`);
    
    results.passed.push('Submit Leave');
    results.createdData.push({
      type: 'Leave',
      id: testLeaveId
    });
    return true;
  } else {
    console.log('❌ FAILED: Leave submission failed');
    console.log(`   Status: ${result.status}`);
    console.log(`   Error: ${result.data?.message || result.error}`);
    results.failed.push({ test: 'Submit Leave', status: result.status });
    return false;
  }
}

// Test: Admin Approve Leave
async function testAdminApproveLeave() {
  console.log('\n=== TEST: Admin Approve Leave ===');
  
  if (!superAdminToken || !testLeaveId) {
    console.log('⚠️  BLOCKED: Missing admin token or leave ID');
    results.blocked.push('Approve Leave - Missing prerequisites');
    return false;
  }

  const result = await request('PATCH', `/api/leave/${testLeaveId}/approve`, {}, superAdminToken);

  if (result.status === 200) {
    console.log('✅ PASSED: Leave approved');
    results.passed.push('Approve Leave');
    return true;
  } else {
    console.log('❌ FAILED: Leave approval failed');
    console.log(`   Status: ${result.status}`);
    console.log(`   Error: ${result.data?.message || result.error}`);
    results.failed.push({ test: 'Approve Leave', status: result.status });
    return false;
  }
}

// Test: Submit Expense
async function testSubmitExpense() {
  console.log('\n=== TEST: Submit Expense ===');
  
  if (!employeeToken) {
    console.log('⚠️  BLOCKED: Employee not authenticated');
    results.blocked.push('Submit Expense - No employee token');
    return false;
  }

  const result = await request('POST', '/api/expense', {
    category: 'meals',
    amount: 50,
    currency: 'INR',
    description: `Test Expense ${TIMESTAMP}`,
    expenseDate: new Date().toISOString().split('T')[0]
  }, employeeToken);

  if (result.status === 200 || result.status === 201) {
    testExpenseId = result.data?.data?._id;
    console.log('✅ PASSED: Expense submitted');
    console.log(`   Expense ID: ${maskData(testExpenseId, 'id')}`);
    console.log(`   Amount: 50 INR`);
    
    results.passed.push('Submit Expense');
    results.createdData.push({
      type: 'Expense',
      id: testExpenseId,
      amount: 50
    });
    return true;
  } else {
    console.log('❌ FAILED: Expense submission failed');
    console.log(`   Status: ${result.status}`);
    console.log(`   Error: ${result.data?.message || result.error}`);
    results.failed.push({ test: 'Submit Expense', status: result.status });
    return false;
  }
}

// Test: Admin Approve Expense
async function testAdminApproveExpense() {
  console.log('\n=== TEST: Admin Approve Expense ===');
  
  if (!superAdminToken || !testExpenseId) {
    console.log('⚠️  BLOCKED: Missing admin token or expense ID');
    results.blocked.push('Approve Expense - Missing prerequisites');
    return false;
  }

  const result = await request('PUT', `/api/expense/${testExpenseId}/approve`, {}, superAdminToken);

  if (result.status === 200) {
    console.log('✅ PASSED: Expense approved');
    results.passed.push('Approve Expense');
    return true;
  } else {
    console.log('❌ FAILED: Expense approval failed');
    console.log(`   Status: ${result.status}`);
    console.log(`   Error: ${result.data?.message || result.error}`);
    results.failed.push({ test: 'Approve Expense', status: result.status });
    return false;
  }
}

// Test: Employee Profile
async function testEmployeeProfile() {
  console.log('\n=== TEST: Employee Profile ===');
  
  if (!employeeToken) {
    console.log('⚠️  BLOCKED: Employee not authenticated');
    results.blocked.push('Employee Profile - No employee token');
    return false;
  }

  const result = await request('GET', '/api/profile', null, employeeToken);

  if (result.status === 200) {
    console.log('✅ PASSED: Employee profile retrieved');
    console.log(`   Name: ${result.data?.data?.name || 'N/A'}`);
    results.passed.push('Employee Profile');
    return true;
  } else {
    console.log('❌ FAILED: Employee profile retrieval failed');
    console.log(`   Status: ${result.status}`);
    results.failed.push({ test: 'Employee Profile', status: result.status });
    return false;
  }
}

// Main test runner
async function runAllTests() {
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║     PHASE 3A: API-LEVEL E2E TESTING - WorkPlus HRMS        ║');
  console.log('╚════════════════════════════════════════════════════════════╝');
  console.log(`\nTest Run Timestamp: ${TIMESTAMP}`);
  console.log(`API Base URL: ${API_BASE}`);
  console.log(`Super Admin Email: ${maskData(SUPER_ADMIN_EMAIL, 'email')}`);

  // Run tests in sequence
  const healthOk = await testHealthCheck();
  if (!healthOk) {
    console.log('\n⚠️  Backend health check failed. Stopping tests.');
    return;
  }

  await testSuperAdminLogin();
  await testCreateEmployee();
  await testGetEmployeeList();
  await testEmployeeLogin();
  await testEmployeeDashboard();
  await testAttendanceToday();
  await testCheckIn();
  await testCheckOut();
  await testSubmitLeave();
  await testAdminApproveLeave();
  await testSubmitExpense();
  await testAdminApproveExpense();
  await testEmployeeProfile();

  // Print summary
  console.log('\n╔════════════════════════════════════════════════════════════╗');
  console.log('║                      TEST SUMMARY                          ║');
  console.log('╚════════════════════════════════════════════════════════════╝');
  console.log(`\n✅ Passed: ${results.passed.length}`);
  console.log(`❌ Failed: ${results.failed.length}`);
  console.log(`⚠️  Blocked: ${results.blocked.length}`);
  
  if (results.failed.length > 0) {
    console.log('\nFailed Tests:');
    results.failed.forEach(f => {
      console.log(`  - ${f.test} (HTTP ${f.status})`);
      if (f.message) console.log(`    Error: ${f.message}`);
    });
  }

  if (results.blocked.length > 0) {
    console.log('\nBlocked Tests:');
    results.blocked.forEach(b => console.log(`  - ${b}`));
  }

  console.log('\nPassed Tests:');
  results.passed.forEach(p => console.log(`  ✓ ${p}`));

  if (results.createdData.length > 0) {
    console.log('\nTest Data Created (masked):');
    results.createdData.forEach(d => {
      console.log(`  - ${d.type}: ${maskData(d.id, 'id')} ${d.email ? `(${maskData(d.email, 'email')})` : ''}`);
    });
  }
}

// Start tests
runAllTests().catch(console.error);
