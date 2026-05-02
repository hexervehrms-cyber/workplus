/**
 * Production Login Verification Script
 * Tests Super Admin login against production API
 * 
 * Usage: node scripts/verify-production-login.js
 */

import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const SUPER_ADMIN_EMAIL = process.env.SUPER_ADMIN_EMAIL || 'admin@workpluspro.com';
const SUPER_ADMIN_PASSWORD = process.env.SUPER_ADMIN_PASSWORD || 'Jadu@123';
const API_URL = process.env.VITE_API_URL || 'https://workplus-backend-sg3a.onrender.com';

console.log('\n🌐 PRODUCTION LOGIN VERIFICATION');
console.log('='.repeat(60));
console.log('API URL:', API_URL);
console.log('Email:', SUPER_ADMIN_EMAIL);
console.log('='.repeat(60));

/**
 * Test 1: Health Check
 */
async function testHealthCheck() {
  console.log('\n💚 TEST 1: Health Check');
  console.log('-'.repeat(60));
  
  try {
    console.log('   Checking:', `${API_URL}/health`);
    
    const response = await fetch(`${API_URL}/health`, {
      method: 'GET',
      headers: {
        'Accept': 'application/json'
      }
    });
    
    if (!response.ok) {
      console.log('   ❌ Health check failed');
      console.log('   Status:', response.status);
      return false;
    }
    
    const data = await response.json();
    
    console.log('   ✅ Server is healthy');
    console.log('   Status:', data.status);
    console.log('   Database:', data.database?.status || 'unknown');
    console.log('   Uptime:', data.uptime, 'seconds');
    
    if (data.database?.status !== 'connected') {
      console.log('   ⚠️  WARNING: Database not connected');
      return false;
    }
    
    return true;
  } catch (error) {
    console.log('   ❌ Health check error:', error.message);
    return false;
  }
}

/**
 * Test 2: Login with Super Admin credentials
 */
async function testLogin() {
  console.log('\n🔐 TEST 2: Super Admin Login');
  console.log('-'.repeat(60));
  
  try {
    console.log('   Endpoint:', `${API_URL}/api/auth/login`);
    console.log('   Email:', SUPER_ADMIN_EMAIL);
    console.log('   Password:', '*'.repeat(SUPER_ADMIN_PASSWORD.length));
    
    const response = await fetch(`${API_URL}/api/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify({
        email: SUPER_ADMIN_EMAIL,
        password: SUPER_ADMIN_PASSWORD
      })
    });
    
    const data = await response.json();
    
    console.log('   Response status:', response.status);
    
    if (!response.ok) {
      console.log('   ❌ Login failed');
      console.log('   Message:', data.message);
      console.log('   Code:', data.code);
      console.log('   Full response:', JSON.stringify(data, null, 2));
      return false;
    }
    
    if (!data.success) {
      console.log('   ❌ Login unsuccessful');
      console.log('   Message:', data.message);
      return false;
    }
    
    console.log('   ✅ Login successful');
    console.log('   User ID:', data.data.user.id);
    console.log('   Name:', data.data.user.name);
    console.log('   Email:', data.data.user.email);
    console.log('   Role:', data.data.user.role);
    console.log('   Organization:', data.data.user.organization);
    console.log('   Token:', data.data.token.substring(0, 50) + '...');
    
    return data;
  } catch (error) {
    console.log('   ❌ Login error:', error.message);
    console.log('   Stack:', error.stack);
    return false;
  }
}

/**
 * Test 3: Verify token with /api/auth/me
 */
async function testTokenVerification(token) {
  console.log('\n🎫 TEST 3: Token Verification');
  console.log('-'.repeat(60));
  
  try {
    console.log('   Endpoint:', `${API_URL}/api/auth/me`);
    console.log('   Token:', token.substring(0, 50) + '...');
    
    const response = await fetch(`${API_URL}/api/auth/me`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/json'
      }
    });
    
    const data = await response.json();
    
    if (!response.ok) {
      console.log('   ❌ Token verification failed');
      console.log('   Status:', response.status);
      console.log('   Message:', data.message);
      return false;
    }
    
    if (!data.success) {
      console.log('   ❌ Token invalid');
      console.log('   Message:', data.message);
      return false;
    }
    
    console.log('   ✅ Token is valid');
    console.log('   User ID:', data.data.id);
    console.log('   Name:', data.data.name);
    console.log('   Email:', data.data.email);
    console.log('   Role:', data.data.role);
    
    return true;
  } catch (error) {
    console.log('   ❌ Token verification error:', error.message);
    return false;
  }
}

/**
 * Test 4: Test wrong credentials
 */
async function testWrongCredentials() {
  console.log('\n🚫 TEST 4: Wrong Credentials (Should Fail)');
  console.log('-'.repeat(60));
  
  try {
    console.log('   Testing with wrong password...');
    
    const response = await fetch(`${API_URL}/api/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify({
        email: SUPER_ADMIN_EMAIL,
        password: 'WrongPassword123'
      })
    });
    
    const data = await response.json();
    
    if (response.status === 401 && !data.success) {
      console.log('   ✅ Correctly rejected wrong credentials');
      console.log('   Message:', data.message);
      return true;
    }
    
    console.log('   ❌ Security issue: Wrong credentials accepted');
    return false;
  } catch (error) {
    console.log('   ❌ Test error:', error.message);
    return false;
  }
}

/**
 * Main test runner
 */
async function runTests() {
  try {
    let allPassed = true;
    
    // Test 1: Health Check
    const healthOk = await testHealthCheck();
    if (!healthOk) {
      console.log('\n❌ Health check failed - server may not be running');
      allPassed = false;
    }
    
    // Test 2: Login
    const loginResult = await testLogin();
    if (!loginResult) {
      console.log('\n❌ Login test failed');
      allPassed = false;
      
      // Show troubleshooting steps
      console.log('\n💡 TROUBLESHOOTING STEPS:');
      console.log('   1. Check if server is running:');
      console.log('      curl', `${API_URL}/health`);
      console.log('   2. Check database connection');
      console.log('   3. Run seeding script:');
      console.log('      node scripts/seed-super-admin.js');
      console.log('   4. Check server logs for errors');
      console.log('   5. Verify environment variables:');
      console.log('      SUPER_ADMIN_EMAIL=' + SUPER_ADMIN_EMAIL);
      console.log('      SUPER_ADMIN_PASSWORD=' + SUPER_ADMIN_PASSWORD);
      
      process.exit(1);
    }
    
    // Test 3: Token Verification
    const tokenOk = await testTokenVerification(loginResult.data.token);
    if (!tokenOk) {
      console.log('\n❌ Token verification failed');
      allPassed = false;
    }
    
    // Test 4: Wrong Credentials
    const securityOk = await testWrongCredentials();
    if (!securityOk) {
      console.log('\n❌ Security test failed');
      allPassed = false;
    }
    
    // Summary
    console.log('\n' + '='.repeat(60));
    if (allPassed) {
      console.log('✅ ALL TESTS PASSED');
      console.log('='.repeat(60));
      console.log('\n🎉 PRODUCTION LOGIN IS WORKING!');
      console.log('\n📋 SUPER ADMIN CREDENTIALS:');
      console.log('   Email:', SUPER_ADMIN_EMAIL);
      console.log('   Password:', SUPER_ADMIN_PASSWORD);
      console.log('   Role: super_admin');
      console.log('\n🚀 READY TO USE:');
      console.log('   1. Go to: https://workplus-murex.vercel.app/login');
      console.log('   2. Enter email:', SUPER_ADMIN_EMAIL);
      console.log('   3. Enter password:', SUPER_ADMIN_PASSWORD);
      console.log('   4. Click "Sign In"');
      console.log('   5. You will be redirected to Super Admin Dashboard');
      console.log('\n✅ System is production-ready!');
    } else {
      console.log('❌ SOME TESTS FAILED');
      console.log('='.repeat(60));
      console.log('\n⚠️  Production login has issues');
      console.log('   Review the test results above');
    }
    
    process.exit(allPassed ? 0 : 1);
  } catch (error) {
    console.error('\n❌ Test suite error:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// Run tests
runTests();
