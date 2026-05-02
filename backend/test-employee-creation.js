/**
 * Test Employee Creation Flow
 * Tests the complete employee creation system end-to-end
 */

import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config({ path: './backend/.env' });

const API_BASE = 'http://localhost:5000/api';
let authToken = '';
let superAdminUser = null;

// Test data - use timestamp to ensure unique email
const timestamp = Date.now();
const testEmployee = {
  name: 'Rinky Verma',
  email: `rinky-${timestamp}@hexerve.com`,
  password: 'SecurePass@123',
  designation: 'ADMIN EXECUTIVE',
  department: 'HR',
  baseSalary: 40000,
  phone: '+918839517283'
};

const superAdminCreds = {
  email: 'superadmin@company.com',
  password: 'Jadu@123'
};

// Helper function to make API calls
async function apiCall(method, endpoint, data = null, token = null) {
  try {
    const config = {
      method,
      url: `${API_BASE}${endpoint}`,
      headers: {
        'Content-Type': 'application/json'
      }
    };

    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    if (data) {
      config.data = data;
    }

    const response = await axios(config);
    return { success: true, data: response.data, status: response.status };
  } catch (error) {
    return {
      success: false,
      error: error.response?.data || error.message,
      status: error.response?.status
    };
  }
}

// Test 1: Login as Super Admin
async function testLogin() {
  console.log('\n📝 TEST 1: Login as Super Admin');
  console.log('================================');
  
  const result = await apiCall('POST', '/auth/login', superAdminCreds);
  
  if (result.success && result.data.token) {
    authToken = result.data.token;
    superAdminUser = result.data.user;
    console.log('✅ Login successful');
    console.log(`   Token: ${authToken.substring(0, 20)}...`);
    console.log(`   User: ${result.data.user.name} (${result.data.user.role})`);
    console.log(`   Org ID: ${result.data.user.tenantId}`);
    return true;
  } else {
    console.log('❌ Login failed');
    console.log(`   Error: ${result.error?.message || result.error}`);
    return false;
  }
}

// Test 2: Create Employee
async function testCreateEmployee() {
  console.log('\n📝 TEST 2: Create Employee');
  console.log('================================');
  
  if (!authToken) {
    console.log('❌ No auth token. Please login first.');
    return false;
  }

  const result = await apiCall('POST', '/employees', testEmployee, authToken);
  
  if (result.success && result.data.data) {
    console.log('✅ Employee created successfully');
    console.log(`   Employee ID: ${result.data.data.employee._id}`);
    console.log(`   Name: ${result.data.data.employee.userId.name}`);
    console.log(`   Email: ${result.data.data.employee.userId.email}`);
    console.log(`   Department: ${result.data.data.employee.department}`);
    console.log(`   Designation: ${result.data.data.employee.designation}`);
    console.log(`   Salary: ${result.data.data.employee.baseSalary}`);
    return result.data.data.employee;
  } else {
    console.log('❌ Employee creation failed');
    console.log(`   Status: ${result.status}`);
    console.log(`   Error: ${result.error?.message || result.error}`);
    return false;
  }
}

// Test 3: Get All Employees
async function testGetEmployees() {
  console.log('\n📝 TEST 3: Get All Employees');
  console.log('================================');
  
  if (!authToken) {
    console.log('❌ No auth token. Please login first.');
    return false;
  }

  const result = await apiCall('GET', '/employees', null, authToken);
  
  if (result.success && result.data.data) {
    console.log('✅ Employees fetched successfully');
    console.log(`   Total employees: ${result.data.data.length}`);
    result.data.data.forEach((emp, idx) => {
      console.log(`   ${idx + 1}. ${emp.userId.name} (${emp.designation})`);
    });
    return true;
  } else {
    console.log('❌ Failed to fetch employees');
    console.log(`   Error: ${result.error?.message || result.error}`);
    return false;
  }
}

// Test 4: Login as Created Employee
async function testLoginAsEmployee() {
  console.log('\n📝 TEST 4: Login as Created Employee');
  console.log('================================');
  
  const result = await apiCall('POST', '/auth/login', {
    email: testEmployee.email,
    password: testEmployee.password
  });
  
  if (result.success && result.data.token) {
    console.log('✅ Employee login successful');
    console.log(`   Token: ${result.data.token.substring(0, 20)}...`);
    console.log(`   User: ${result.data.user.name} (${result.data.user.role})`);
    return result.data.token;
  } else {
    console.log('❌ Employee login failed');
    console.log(`   Error: ${result.error?.message || result.error}`);
    return false;
  }
}

// Test 5: Get Employee Dashboard
async function testEmployeeDashboard(employeeToken) {
  console.log('\n📝 TEST 5: Get Employee Dashboard');
  console.log('================================');
  
  if (!employeeToken) {
    console.log('❌ No employee token.');
    return false;
  }

  const result = await apiCall('GET', '/dashboard/employee', null, employeeToken);
  
  if (result.success && result.data.data) {
    console.log('✅ Employee dashboard fetched successfully');
    console.log(`   Data: ${JSON.stringify(result.data.data, null, 2)}`);
    return true;
  } else {
    console.log('❌ Failed to fetch employee dashboard');
    console.log(`   Error: ${result.error?.message || result.error}`);
    return false;
  }
}

// Main test runner
async function runTests() {
  console.log('🚀 Starting Employee Creation System Tests');
  console.log('==========================================');
  
  try {
    // Test 1: Login
    const loginSuccess = await testLogin();
    if (!loginSuccess) {
      console.log('\n❌ Login test failed. Stopping tests.');
      return;
    }

    // Test 2: Create Employee
    const employee = await testCreateEmployee();
    if (!employee) {
      console.log('\n❌ Employee creation test failed. Stopping tests.');
      return;
    }

    // Test 3: Get Employees
    await testGetEmployees();

    // Test 4: Login as Employee
    const employeeToken = await testLoginAsEmployee();
    if (!employeeToken) {
      console.log('\n⚠️  Employee login test failed. Continuing...');
    } else {
      // Test 5: Get Employee Dashboard
      await testEmployeeDashboard(employeeToken);
    }

    console.log('\n✅ All tests completed!');
    console.log('==========================================');
  } catch (error) {
    console.error('❌ Test runner error:', error.message);
  }
}

// Run tests
runTests();
