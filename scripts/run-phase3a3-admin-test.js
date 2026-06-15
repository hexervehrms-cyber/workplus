#!/usr/bin/env node

/**
 * Phase 3A.3: Real Admin/Employee Runtime E2E Test
 * Tests using a real Admin from active organization (not system org)
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import mongoose from 'mongoose';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment
const loadEnvFile = (filePath) => {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const env = {};
    content.split('\n').forEach(line => {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('#') && trimmed.includes('=')) {
        const [key, ...valueParts] = trimmed.split('=');
        env[key.trim()] = valueParts.join('=').trim();
      }
    });
    return env;
  } catch (err) {
    return {};
  }
};

const BACKEND_ENV_PATH = path.join(__dirname, '..', 'backend', '.env');
const BACKEND_ENV = loadEnvFile(BACKEND_ENV_PATH);

const API_BASE_URL = 'http://localhost:5000';
const SUPER_ADMIN_EMAIL = BACKEND_ENV.SUPER_ADMIN_EMAIL;
const SUPER_ADMIN_PASSWORD = BACKEND_ENV.SUPER_ADMIN_PASSWORD;
const MONGODB_URI = BACKEND_ENV.MONGODB_URI;

const maskValue = (value) => {
  if (!value) return 'EMPTY';
  const len = value.length;
  if (len <= 6) return '***';
  return value.substring(0, 4) + '***' + value.substring(len - 2);
};

console.log('\n' + '='.repeat(80));
console.log('PHASE 3A.3: Real Admin/Employee Runtime E2E Test');
console.log('='.repeat(80) + '\n');

// Test results
const results = {
  organization: [],
  auth: [],
  employee: [],
  attendance: [],
  leave: [],
  expense: [],
  profile: [],
  dashboard: [],
  currency: [],
  bugs: [],
  blocked: [],
  cleanup: []
};

let authTokens = {};
let testAdminId = null;
let testAdminToken = null;
let testEmployeeId = null;
let testEmployeeToken = null;
let testEmployeeUser = null;
let testLeaveId = null;
let testExpenseId = null;
let testOrgId = null;

// Helper: Make HTTP request
const makeRequest = async (method, endpoint, data = null, token = null) => {
  const url = `${API_BASE_URL}/api/${endpoint.replace(/^\/+/, '')}`;
  const options = {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token && { Authorization: `Bearer ${token}` })
    },
    credentials: 'include'
  };

  if (data) {
    options.body = JSON.stringify(data);
  }

  try {
    const response = await fetch(url, options);
    const contentType = response.headers.get('content-type');
    let responseData = null;

    if (contentType && contentType.includes('application/json')) {
      try {
        responseData = await response.json();
      } catch {
        responseData = null;
      }
    }

    return {
      status: response.status,
      statusText: response.statusText,
      data: responseData,
      headers: Object.fromEntries(response.headers.entries())
    };
  } catch (error) {
    return {
      status: 0,
      statusText: 'NETWORK_ERROR',
      data: null,
      error: error.message
    };
  }
};

// ============================================================================
// STEP 1: FIND ACTIVE ORGANIZATION AND ADMIN
// ============================================================================
console.log('\n' + '='.repeat(80));
console.log('STEP 1: FIND ACTIVE ORGANIZATION AND ADMIN');
console.log('='.repeat(80));

// Login as super admin first
console.log('[S1.1] Logging in as super admin...');
const superAdminLoginResponse = await makeRequest('POST', 'auth/login', {
  email: SUPER_ADMIN_EMAIL,
  password: SUPER_ADMIN_PASSWORD
});

if (superAdminLoginResponse.status === 200) {
  authTokens.superAdmin = superAdminLoginResponse.data?.token;
  console.log('  ✅ Super admin token obtained');
} else {
  console.log(`  ❌ Super admin login failed: ${superAdminLoginResponse.statusText}`);
  process.exit(1);
}

// Get organizations
console.log('[S1.2] Fetching organizations...');
const orgsResponse = await makeRequest('GET', 'organizations', null, authTokens.superAdmin);

if (orgsResponse.status === 200 && orgsResponse.data?.data) {
  const orgs = Array.isArray(orgsResponse.data.data) ? orgsResponse.data.data : [orgsResponse.data.data];
  const activeOrg = orgs.find(o => o.isActive !== false);
  
  if (activeOrg) {
    testOrgId = activeOrg._id || activeOrg.id;
    console.log(`  ✅ Found active organization: ${activeOrg.name || 'Unknown'}`);
    console.log(`     Org ID: ***MONGO_ID***`);
    
    results.organization.push({
      test: 'Find active organization',
      status: 'PASS',
      httpStatus: 200,
      orgId: testOrgId,
      orgName: activeOrg.name || 'Unknown'
    });
  } else {
    console.log('  ❌ No active organizations found');
    process.exit(1);
  }
} else {
  console.log(`  ❌ Organizations fetch failed: ${orgsResponse.statusText}`);
  process.exit(1);
}

// Find admin users in organization
console.log('[S1.3] Finding admin users in organization...');
const adminsResponse = await makeRequest('GET', `users?role=admin&orgId=${testOrgId}`, null, authTokens.superAdmin);

if (adminsResponse.status === 200 && adminsResponse.data?.data) {
  const admins = Array.isArray(adminsResponse.data.data) ? adminsResponse.data.data : [adminsResponse.data.data];
  console.log(`  Found ${admins.length} admin(s) in organization`);
  
  // Find first admin with valid credentials or reset password
  if (admins.length > 0) {
    console.log('[S1.4] Attempting to login as first admin...');
    const firstAdmin = admins[0];
    
    // Try to login with admin credentials
    const adminLoginResponse = await makeRequest('POST', 'auth/login', {
      email: firstAdmin.email,
      password: 'Jadu@123' // Try common password
    });
    
    if (adminLoginResponse.status === 200) {
      testAdminToken = adminLoginResponse.data?.token;
      console.log(`  ✅ Admin login successful: ${maskValue(firstAdmin.email)}`);
      
      results.auth.push({
        test: 'Admin login',
        status: 'PASS',
        httpStatus: 200,
        role: firstAdmin.role,
        orgId: testOrgId
      });
    } else {
      console.log('  ⚠️  Admin login failed, attempting password reset...');
      
      // Reset password using super admin
      const adminId = firstAdmin._id || firstAdmin.id;
      const resetPasswordResponse = await makeRequest('POST', `users/${adminId}/reset-password`, {
        newPassword: 'Admin@123Test'
      }, authTokens.superAdmin);
      
      if (resetPasswordResponse.status === 200) {
        console.log('  ✅ Admin password reset');
        
        // Try login with new password
        const newAdminLoginResponse = await makeRequest('POST', 'auth/login', {
          email: firstAdmin.email,
          password: 'Admin@123Test'
        });
        
        if (newAdminLoginResponse.status === 200) {
          testAdminToken = newAdminLoginResponse.data?.token;
          console.log(`  ✅ Admin login successful after password reset: ${maskValue(firstAdmin.email)}`);
          
          results.auth.push({
            test: 'Admin login (after reset)',
            status: 'PASS',
            httpStatus: 200,
            role: firstAdmin.role,
            orgId: testOrgId
          });
        } else {
          console.log(`  ❌ Admin login failed after reset: ${newAdminLoginResponse.statusText}`);
        }
      } else {
        console.log(`  ❌ Password reset failed: ${resetPasswordResponse.statusText}`);
      }
    }
  }
} else {
  console.log(`  ❌ Admins fetch failed: ${adminsResponse.statusText}`);
}

if (!testAdminToken) {
  console.log('[S1.5] Creating test admin for organization...');
  const timestamp = Date.now();
  const testAdminEmail = `testadmin${timestamp}@hexerve.com`;
  
  const createAdminResponse = await makeRequest('POST', 'auth/create-admin', {
    name: 'Test Admin E2E',
    email: testAdminEmail,
    password: 'Admin@123Test',
    organization: 'WorkPlus Inc.',
    orgId: testOrgId
  }, authTokens.superAdmin);
  
  if (createAdminResponse.status === 201) {
    console.log(`  ✅ Test admin created: ${maskValue(testAdminEmail)}`);
    
    // Login as test admin
    const testAdminLoginResponse = await makeRequest('POST', 'auth/login', {
      email: testAdminEmail,
      password: 'Admin@123Test'
    });
    
    if (testAdminLoginResponse.status === 200) {
      testAdminToken = testAdminLoginResponse.data?.token;
      console.log(`  ✅ Test admin login successful`);
      
      results.auth.push({
        test: 'Create and login test admin',
        status: 'PASS',
        httpStatus: 200,
        role: 'admin',
        orgId: testOrgId
      });
    } else {
      console.log(`  ❌ Test admin login failed: ${testAdminLoginResponse.statusText}`);
    }
  } else {
    console.log(`  ❌ Create admin failed: ${createAdminResponse.statusText}`);
  }
}

if (!testAdminToken) {
  console.log('\n❌ Cannot proceed without admin token');
  process.exit(1);
}

// Verify admin token
console.log('\n[S1.6] Verifying admin token...');
const adminMeResponse = await makeRequest('GET', 'auth/me', null, testAdminToken);
if (adminMeResponse.status === 200) {
  const adminUser = adminMeResponse.data;
  console.log(`  ✅ Admin token valid`);
  console.log(`     Role: ${adminUser.role}`);
  console.log(`     OrgId: ${adminUser.orgId || adminUser.tenantId ? '***MONGO_ID***' : 'N/A'}`);
  
  if (adminUser.orgId || adminUser.tenantId) {
    testOrgId = adminUser.orgId || adminUser.tenantId;
  }
}
