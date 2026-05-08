#!/usr/bin/env node

/**
 * Comprehensive System Test
 * Tests all backend and frontend integration points
 */

import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import fetch from 'node-fetch';

// Setup __dirname for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
const envPath = path.join(__dirname, '..', '.env');
dotenv.config({ path: envPath });

const API_URL = 'http://localhost:5000';

console.log('\n🚀 COMPREHENSIVE SYSTEM TEST\n');
console.log('═'.repeat(100));

// Test counters
let totalTests = 0;
let passedTests = 0;
let failedTests = 0;

// Helper function to make API calls
async function apiCall(method, endpoint, body = null, token = '') {
  try {
    const options = {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(token && { 'Authorization': `Bearer ${token}` })
      }
    };

    if (body) {
      options.body = JSON.stringify(body);
    }

    const response = await fetch(`${API_URL}${endpoint}`, options);
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

// Test helper
function test(name, passed, details = '') {
  totalTests++;
  if (passed) {
    passedTests++;
    console.log(`✅ ${name}`);
  } else {
    failedTests++;
    console.log(`❌ ${name}`);
    if (details) console.log(`   ${details}`);
  }
}

// Test data
const testUsers = {
  admin: { email: 'atul@hexerve.com', password: 'Jadu@123', role: 'admin' },
  employee1: { email: 'abhishek.rajput@hexerve.com', password: 'Employee@123', role: 'employee' },
  employee2: { email: 'rinky@hexerve.com', password: 'Employee@123', role: 'employee' },
  superAdmin: { email: 'superadmin@company.com', password: 'Jadu@123', role: 'super_admin' }
};

let tokens = {};

// ============================================
// SECTION 1: AUTHENTICATION TESTS
// ============================================

console.log('\n📝 SECTION 1: AUTHENTICATION TESTS\n');

for (const [userType, credentials] of Object.entries(testUsers)) {
  const result = await apiCall('POST', '/api/auth/login', {
    email: credentials.email,
    password: credentials.password
  });

  // Backend can return token and user in two formats:
  // 1. Nested in data: response.data.token, response.data.user
  // 2. At top level: response.token, response.user
  const token = result.data.data?.token || result.data.token;
  const passed = result.ok && result.data.success && token;
  test(`${userType} login`, passed, passed ? '' : `Status: ${result.status}, Message: ${result.data?.message}`);
  
  if (passed) {
    tokens[userType] = token;
  }
}

// ============================================
// SECTION 2: USER PROFILE TESTS
// ============================================

console.log('\n👤 SECTION 2: USER PROFILE TESTS\n');

for (const [userType, token] of Object.entries(tokens)) {
  const result = await apiCall('GET', '/api/auth/me', null, token);
  const passed = result.ok && result.data.success && result.data.data?.email;
  test(`${userType} get profile`, passed, passed ? '' : `Status: ${result.status}`);
}

// ============================================
// SECTION 3: EMPLOYEE MANAGEMENT TESTS
// ============================================

console.log('\n👥 SECTION 3: EMPLOYEE MANAGEMENT TESTS\n');

// Admin fetches employees
let result = await apiCall('GET', '/api/employees?page=1&limit=10', null, tokens.admin);
test('Admin fetch employees', result.ok && result.data.success, `Found: ${result.data.data?.length || 0}`);

// Employee fetches their own profile
result = await apiCall('GET', '/api/employees/profile', null, tokens.employee1);
test('Employee fetch own profile', result.ok && result.data.success);

// ============================================
// SECTION 4: ATTENDANCE TESTS
// ============================================

console.log('\n⏰ SECTION 4: ATTENDANCE TESTS\n');

// Admin fetches attendance
result = await apiCall('GET', '/api/attendance?page=1&limit=10', null, tokens.admin);
test('Admin fetch attendance', result.ok && result.data.success, `Found: ${result.data.data?.length || 0}`);

// Employee check-in
result = await apiCall('POST', '/api/attendance/checkin', {
  latitude: 28.6139,
  longitude: 77.2090,
  location: 'Office'
}, tokens.employee1);
test('Employee check-in', result.ok && result.data.success);

// ============================================
// SECTION 5: LEAVE MANAGEMENT TESTS
// ============================================

console.log('\n📅 SECTION 5: LEAVE MANAGEMENT TESTS\n');

// Admin fetches leave requests
result = await apiCall('GET', '/api/leave-requests?page=1&limit=10', null, tokens.admin);
test('Admin fetch leave requests', result.ok && result.data.success, `Found: ${result.data.data?.length || 0}`);

// Employee fetches their leave requests
result = await apiCall('GET', '/api/leave-requests/user', null, tokens.employee1);
test('Employee fetch own leave requests', result.ok && result.data.success);

// Employee submits leave request
result = await apiCall('POST', '/api/leave-requests', {
  type: 'Casual Leave',
  startDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
  endDate: new Date(Date.now() + 9 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
  reason: 'Personal work',
  numberOfDays: 3
}, tokens.employee1);
test('Employee submit leave request', result.ok && result.data.success);

// ============================================
// SECTION 6: EXPENSE MANAGEMENT TESTS
// ============================================

console.log('\n💳 SECTION 6: EXPENSE MANAGEMENT TESTS\n');

// Admin fetches expenses
result = await apiCall('GET', '/api/expenses?page=1&limit=10', null, tokens.admin);
test('Admin fetch expenses', result.ok && result.data.success, `Found: ${result.data.data?.length || 0}`);

// Employee submits expense
result = await apiCall('POST', '/api/expenses', {
  title: 'Test Expense',
  category: 'Meals - Business',
  description: 'Test expense for system check',
  amount: 250,
  date: new Date().toISOString().split('T')[0]
}, tokens.employee1);
test('Employee submit expense', result.ok && result.data.success);

let expenseId = result.data.data?._id;

// Admin fetches expenses again
result = await apiCall('GET', '/api/expenses?page=1&limit=10', null, tokens.admin);
test('Admin fetch expenses (after submission)', result.ok && result.data.success);

// Admin approves expense
if (expenseId) {
  result = await apiCall('PUT', `/api/expenses/${expenseId}/approve`, {}, tokens.admin);
  test('Admin approve expense', result.ok && result.data.success);
}

// ============================================
// SECTION 7: DASHBOARD TESTS
// ============================================

console.log('\n📊 SECTION 7: DASHBOARD TESTS\n');

// Admin dashboard
result = await apiCall('GET', '/api/dashboard/stats', null, tokens.admin);
test('Admin dashboard stats', result.ok && result.data.success);

// Employee dashboard
result = await apiCall('GET', '/api/dashboard/stats', null, tokens.employee1);
test('Employee dashboard stats', result.ok && result.data.success);

// ============================================
// SECTION 8: DOCUMENTS TESTS
// ============================================

console.log('\n📄 SECTION 8: DOCUMENTS TESTS\n');

// Admin fetches documents
result = await apiCall('GET', '/api/documents?page=1&limit=10', null, tokens.admin);
test('Admin fetch documents', result.ok && result.data.success);

// Employee fetches documents
result = await apiCall('GET', '/api/documents?page=1&limit=10', null, tokens.employee1);
test('Employee fetch documents', result.ok && result.data.success);

// ============================================
// SECTION 9: HOLIDAYS TESTS
// ============================================

console.log('\n🎉 SECTION 9: HOLIDAYS TESTS\n');

// Fetch holidays
result = await apiCall('GET', '/api/holidays', null, tokens.employee1);
test('Fetch holidays', result.ok && result.data.success, `Found: ${result.data.data?.length || 0}`);

// ============================================
// SECTION 10: ANNOUNCEMENTS TESTS
// ============================================

console.log('\n📢 SECTION 10: ANNOUNCEMENTS TESTS\n');

// Fetch announcements
result = await apiCall('GET', '/api/announcements?page=1&limit=10', null, tokens.employee1);
test('Fetch announcements', result.ok && result.data.success);

// ============================================
// SECTION 11: NOTIFICATIONS TESTS
// ============================================

console.log('\n🔔 SECTION 11: NOTIFICATIONS TESTS\n');

// Fetch notifications
result = await apiCall('GET', '/api/notifications?page=1&limit=10', null, tokens.employee1);
test('Fetch notifications', result.ok && result.data.success);

// ============================================
// SECTION 12: HEALTH CHECK
// ============================================

console.log('\n🏥 SECTION 12: HEALTH CHECK\n');

result = await apiCall('GET', '/health');
test('Backend health check', result.ok && result.data.status === 'ok');

// ============================================
// SUMMARY
// ============================================

console.log('\n' + '═'.repeat(100));
console.log('\n📊 TEST SUMMARY\n');
console.log(`Total Tests: ${totalTests}`);
console.log(`✅ Passed: ${passedTests}`);
console.log(`❌ Failed: ${failedTests}`);
console.log(`Success Rate: ${((passedTests / totalTests) * 100).toFixed(1)}%`);

if (failedTests === 0) {
  console.log('\n🎉 ALL TESTS PASSED! System is ready for production.\n');
  process.exit(0);
} else {
  console.log(`\n⚠️  ${failedTests} test(s) failed. Please review the errors above.\n`);
  process.exit(1);
}
