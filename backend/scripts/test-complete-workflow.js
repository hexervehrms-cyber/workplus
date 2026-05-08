#!/usr/bin/env node

/**
 * Complete Employee-Admin Workflow Test
 * Tests the full cycle: Employee submits -> Admin approves/rejects
 */

import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import fetch from 'node-fetch';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const envPath = path.join(__dirname, '..', '.env');
dotenv.config({ path: envPath });

const API_URL = 'http://localhost:5000';

console.log('\n🚀 COMPLETE EMPLOYEE-ADMIN WORKFLOW TEST\n');
console.log('═'.repeat(100));

let testsPassed = 0;
let testsFailed = 0;

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

    return { status: response.status, ok: response.ok, data };
  } catch (error) {
    return { status: 0, ok: false, error: error.message };
  }
}

function test(name, passed, details = '') {
  if (passed) {
    testsPassed++;
    console.log(`✅ ${name}`);
  } else {
    testsFailed++;
    console.log(`❌ ${name}`);
    if (details) console.log(`   ${details}`);
  }
}

// Test data
const employeeEmail = 'abhishek.rajput@hexerve.com';
const employeePassword = 'Employee@123';
const adminEmail = 'atul@hexerve.com';
const adminPassword = 'Jadu@123';

let employeeToken = '';
let adminToken = '';
let employeeUserId = '';
let leaveRequestId = '';
let expenseId = '';

// ============================================
// STEP 1: Employee Login
// ============================================

console.log('\n📝 STEP 1: EMPLOYEE LOGIN\n');

let result = await apiCall('POST', '/api/auth/login', {
  email: employeeEmail,
  password: employeePassword
});

test('Employee login', result.ok && result.data.success, result.data?.message);

if (result.ok && result.data.success) {
  employeeToken = result.data.data?.token || result.data.token;
  // Extract userId from the user object
  employeeUserId = result.data.data?.user?.userId || result.data.data?.user?.id || result.data.user?.userId || result.data.user?.id;
  console.log(`   Token: ${employeeToken?.substring(0, 30)}...`);
  console.log(`   User ID: ${employeeUserId}`);
}

// ============================================
// STEP 2: Employee Submits Leave Request
// ============================================

console.log('\n📅 STEP 2: EMPLOYEE SUBMITS LEAVE REQUEST\n');

const startDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
const endDate = new Date(Date.now() + 9 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

result = await apiCall('POST', '/api/leave-requests', {
  userId: employeeUserId,
  employeeId: employeeUserId,
  type: 'Casual Leave',
  startDate,
  endDate,
  reason: 'Personal work',
  orgId: 'system'
}, employeeToken);

test('Employee submit leave request', result.ok && result.data.success, result.data?.message);

if (result.ok && result.data.success) {
  leaveRequestId = result.data.data?._id;
  console.log(`   Leave Request ID: ${leaveRequestId}`);
}

// ============================================
// STEP 3: Employee Submits Expense
// ============================================

console.log('\n💳 STEP 3: EMPLOYEE SUBMITS EXPENSE\n');

result = await apiCall('POST', '/api/expenses', {
  title: 'Client Meeting Lunch',
  category: 'Meals - Business',
  description: 'Lunch with client ABC',
  amount: 500,
  date: new Date().toISOString().split('T')[0]
}, employeeToken);

test('Employee submit expense', result.ok && result.data.success, result.data?.message);

if (result.ok && result.data.success) {
  expenseId = result.data.data?._id;
  console.log(`   Expense ID: ${expenseId}`);
}

// ============================================
// STEP 4: Employee Checks Their Profile
// ============================================

console.log('\n👤 STEP 4: EMPLOYEE CHECKS PROFILE\n');

result = await apiCall('GET', '/api/auth/me', null, employeeToken);

test('Employee fetch profile', result.ok && result.data.success, result.data?.message);

if (result.ok && result.data.success) {
  console.log(`   Name: ${result.data.data?.firstName} ${result.data.data?.lastName}`);
  console.log(`   Email: ${result.data.data?.email}`);
  console.log(`   Role: ${result.data.data?.role}`);
}

// ============================================
// STEP 5: Employee Views Their Leave Requests
// ============================================

console.log('\n📋 STEP 5: EMPLOYEE VIEWS THEIR LEAVE REQUESTS\n');

result = await apiCall('GET', `/api/leave-requests/user/${employeeUserId}`, null, employeeToken);

test('Employee fetch own leave requests', result.ok && result.data.success, result.data?.message);

if (result.ok && result.data.success) {
  console.log(`   Total leave requests: ${result.data.pagination?.total || 0}`);
}

// ============================================
// STEP 6: Employee Views Their Expenses
// ============================================

console.log('\n💰 STEP 6: EMPLOYEE VIEWS THEIR EXPENSES\n');

result = await apiCall('GET', `/api/expenses/user/${employeeUserId}`, null, employeeToken);

test('Employee fetch own expenses', result.ok && result.data.success, result.data?.message);

if (result.ok && result.data.success) {
  console.log(`   Total expenses: ${result.data.pagination?.total || 0}`);
}

// ============================================
// STEP 7: Admin Login
// ============================================

console.log('\n👨‍💼 STEP 7: ADMIN LOGIN\n');

result = await apiCall('POST', '/api/auth/login', {
  email: adminEmail,
  password: adminPassword
});

test('Admin login', result.ok && result.data.success, result.data?.message);

if (result.ok && result.data.success) {
  adminToken = result.data.data?.token || result.data.token;
  console.log(`   Token: ${adminToken?.substring(0, 30)}...`);
}

// ============================================
// STEP 8: Admin Views All Leave Requests
// ============================================

console.log('\n📊 STEP 8: ADMIN VIEWS ALL LEAVE REQUESTS\n');

result = await apiCall('GET', '/api/leave-requests?page=1&limit=10', null, adminToken);

test('Admin fetch all leave requests', result.ok && result.data.success, result.data?.message);

if (result.ok && result.data.success) {
  console.log(`   Total leave requests: ${result.data.pagination?.total || 0}`);
  const pendingCount = result.data.data?.filter(r => r.status === 'pending').length || 0;
  console.log(`   Pending requests: ${pendingCount}`);
}

// ============================================
// STEP 9: Admin Approves Leave Request
// ============================================

console.log('\n✅ STEP 9: ADMIN APPROVES LEAVE REQUEST\n');

if (leaveRequestId) {
  result = await apiCall('PATCH', `/api/leave-requests/${leaveRequestId}/approve`, {
    approvedBy: employeeUserId,
    comments: 'Approved'
  }, adminToken);

  test('Admin approve leave request', result.ok && result.data.success, result.data?.message);
}

// ============================================
// STEP 10: Admin Views All Expenses
// ============================================

console.log('\n💳 STEP 10: ADMIN VIEWS ALL EXPENSES\n');

result = await apiCall('GET', '/api/expenses?page=1&limit=10', null, adminToken);

test('Admin fetch all expenses', result.ok && result.data.success, result.data?.message);

if (result.ok && result.data.success) {
  console.log(`   Total expenses: ${result.data.pagination?.total || 0}`);
  const pendingCount = result.data.data?.filter(e => e.status === 'pending').length || 0;
  console.log(`   Pending expenses: ${pendingCount}`);
}

// ============================================
// STEP 11: Admin Approves Expense
// ============================================

console.log('\n✅ STEP 11: ADMIN APPROVES EXPENSE\n');

if (expenseId) {
  result = await apiCall('PUT', `/api/expenses/${expenseId}/approve`, {}, adminToken);

  test('Admin approve expense', result.ok && result.data.success, result.data?.message);
}

// ============================================
// STEP 12: Employee Checks Updated Leave Status
// ============================================

console.log('\n📋 STEP 12: EMPLOYEE CHECKS UPDATED LEAVE STATUS\n');

result = await apiCall('GET', `/api/leave-requests/user/${employeeUserId}`, null, employeeToken);

test('Employee fetch updated leave requests', result.ok && result.data.success, result.data?.message);

if (result.ok && result.data.success) {
  const approved = result.data.data?.filter(r => r.status === 'approved').length || 0;
  console.log(`   Approved leave requests: ${approved}`);
}

// ============================================
// STEP 13: Employee Checks Updated Expense Status
// ============================================

console.log('\n💰 STEP 13: EMPLOYEE CHECKS UPDATED EXPENSE STATUS\n');

result = await apiCall('GET', `/api/expenses/user/${employeeUserId}`, null, employeeToken);

test('Employee fetch updated expenses', result.ok && result.data.success, result.data?.message);

if (result.ok && result.data.success) {
  const approved = result.data.data?.filter(e => e.status === 'approved').length || 0;
  console.log(`   Approved expenses: ${approved}`);
}

// ============================================
// SUMMARY
// ============================================

console.log('\n' + '═'.repeat(100));
console.log('\n📊 WORKFLOW TEST SUMMARY\n');
console.log(`✅ Passed: ${testsPassed}`);
console.log(`❌ Failed: ${testsFailed}`);
console.log(`Success Rate: ${((testsPassed / (testsPassed + testsFailed)) * 100).toFixed(1)}%`);

if (testsFailed === 0) {
  console.log('\n🎉 COMPLETE WORKFLOW WORKING! System is ready for production.\n');
  process.exit(0);
} else {
  console.log(`\n⚠️  ${testsFailed} test(s) failed. Please review the errors above.\n`);
  process.exit(1);
}
