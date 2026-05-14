#!/usr/bin/env node

/**
 * Comprehensive Authentication & Attendance System Test
 * Tests:
 * 1. Login with test credentials
 * 2. JWT token in cookies
 * 3. Break-start endpoint
 * 4. Break-end endpoint
 * 5. Logout and session clearing
 */

import fetch from 'node-fetch';
import dotenv from 'dotenv';

dotenv.config();

const API_URL = process.env.VITE_API_URL || 'https://workplus-backend-sg3a.onrender.com';
const API_BASE = `${API_URL}/api`;

// Test credentials from .env
const TEST_EMAIL = 'atul@hexerve.com';
const TEST_PASSWORD = 'Jadu@123';

let accessToken = null;
let refreshToken = null;
let cookies = {};
let employeeId = null;

// Helper to extract cookies from response
function extractCookies(setCookieHeader) {
  const cookies = {};
  if (!setCookieHeader) return cookies;
  
  const cookieArray = Array.isArray(setCookieHeader) ? setCookieHeader : [setCookieHeader];
  cookieArray.forEach(cookie => {
    const parts = cookie.split(';')[0].split('=');
    if (parts.length === 2) {
      cookies[parts[0].trim()] = parts[1].trim();
    }
  });
  return cookies;
}

// Helper to build cookie header
function buildCookieHeader() {
  return Object.entries(cookies)
    .map(([key, value]) => `${key}=${value}`)
    .join('; ');
}

async function test1_Login() {
  console.log('\n' + '='.repeat(60));
  console.log('TEST 1: LOGIN WITH TEST CREDENTIALS');
  console.log('='.repeat(60));
  
  try {
    const url = `${API_BASE}/auth/login`;
    console.log(`📍 URL: ${url}`);
    console.log(`📧 Email: ${TEST_EMAIL}`);
    console.log(`🔐 Password: ${TEST_PASSWORD}`);
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        email: TEST_EMAIL,
        password: TEST_PASSWORD
      })
    });

    console.log(`\n📊 Response Status: ${response.status}`);
    
    // Extract cookies from response
    const setCookieHeader = response.headers.get('set-cookie');
    if (setCookieHeader) {
      const newCookies = extractCookies(setCookieHeader);
      cookies = { ...cookies, ...newCookies };
      console.log(`🍪 Cookies received: ${Object.keys(newCookies).join(', ')}`);
    }

    const data = await response.json();
    
    if (response.ok && data.success) {
      console.log(`✅ LOGIN SUCCESSFUL`);
      console.log(`   User: ${data.user?.email}`);
      console.log(`   Role: ${data.user?.role}`);
      console.log(`   User ID: ${data.user?.id}`);
      
      if (data.user?.employeeId) {
        employeeId = data.user.employeeId;
        console.log(`   Employee ID: ${employeeId}`);
      }
      
      // Store tokens if provided in response
      if (data.token) {
        accessToken = data.token;
        console.log(`   Access Token: ${accessToken.substring(0, 20)}...`);
      }
      if (data.refreshToken) {
        refreshToken = data.refreshToken;
        console.log(`   Refresh Token: ${refreshToken.substring(0, 20)}...`);
      }
      
      return true;
    } else {
      console.log(`❌ LOGIN FAILED`);
      console.log(`   Error: ${data.message}`);
      console.log(`   Full response:`, JSON.stringify(data, null, 2));
      return false;
    }
  } catch (error) {
    console.log(`❌ ERROR: ${error.message}`);
    return false;
  }
}

async function test2_CheckJWTInCookies() {
  console.log('\n' + '='.repeat(60));
  console.log('TEST 2: VERIFY JWT TOKEN IN COOKIES');
  console.log('='.repeat(60));
  
  try {
    console.log(`🍪 Current cookies:`, Object.keys(cookies));
    
    if (cookies.wp_at) {
      console.log(`✅ ACCESS TOKEN COOKIE FOUND (wp_at)`);
      console.log(`   Value: ${cookies.wp_at.substring(0, 30)}...`);
      return true;
    } else if (cookies.accessToken) {
      console.log(`✅ ACCESS TOKEN COOKIE FOUND (accessToken)`);
      console.log(`   Value: ${cookies.accessToken.substring(0, 30)}...`);
      return true;
    } else if (accessToken) {
      console.log(`✅ ACCESS TOKEN IN RESPONSE`);
      console.log(`   Token: ${accessToken.substring(0, 30)}...`);
      return true;
    } else {
      console.log(`❌ NO ACCESS TOKEN FOUND`);
      return false;
    }
  } catch (error) {
    console.log(`❌ ERROR: ${error.message}`);
    return false;
  }
}

async function test3_BreakStart() {
  console.log('\n' + '='.repeat(60));
  console.log('TEST 3: CALL BREAK-START ENDPOINT');
  console.log('='.repeat(60));
  
  try {
    if (!employeeId && !accessToken && !cookies.accessToken) {
      console.log(`❌ SKIPPED: No authentication token or employee ID`);
      return false;
    }

    const url = `${API_BASE}/attendance/break-start`;
    console.log(`📍 URL: ${url}`);
    
    const headers = {
      'Content-Type': 'application/json'
    };

    // Add authorization
    if (accessToken) {
      headers['Authorization'] = `Bearer ${accessToken}`;
      console.log(`🔐 Using Bearer token`);
    }
    
    if (Object.keys(cookies).length > 0) {
      headers['Cookie'] = buildCookieHeader();
      console.log(`🍪 Using cookies: ${Object.keys(cookies).join(', ')}`);
    }

    const body = {
      breakType: 'regular',
      notes: 'Test break start'
    };

    if (employeeId) {
      body.employeeId = employeeId;
      console.log(`👤 Employee ID: ${employeeId}`);
    }

    console.log(`📤 Request body:`, JSON.stringify(body, null, 2));

    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(body)
    });

    console.log(`\n📊 Response Status: ${response.status}`);
    
    const data = await response.json();
    
    if (response.ok && data.success) {
      console.log(`✅ BREAK-START SUCCESSFUL`);
      console.log(`   Message: ${data.message}`);
      if (data.attendance) {
        console.log(`   Attendance ID: ${data.attendance._id}`);
        console.log(`   Break started at: ${data.attendance.breaks?.[0]?.startTime}`);
      }
      return true;
    } else {
      console.log(`❌ BREAK-START FAILED`);
      console.log(`   Status: ${response.status}`);
      console.log(`   Error: ${data.message}`);
      console.log(`   Full response:`, JSON.stringify(data, null, 2));
      return false;
    }
  } catch (error) {
    console.log(`❌ ERROR: ${error.message}`);
    console.log(`   Stack:`, error.stack);
    return false;
  }
}

async function test4_BreakEnd() {
  console.log('\n' + '='.repeat(60));
  console.log('TEST 4: CALL BREAK-END ENDPOINT');
  console.log('='.repeat(60));
  
  try {
    if (!employeeId && !accessToken && !cookies.accessToken) {
      console.log(`❌ SKIPPED: No authentication token or employee ID`);
      return false;
    }

    // Wait a bit before ending break
    console.log(`⏳ Waiting 2 seconds before ending break...`);
    await new Promise(resolve => setTimeout(resolve, 2000));

    const url = `${API_BASE}/attendance/break-end`;
    console.log(`📍 URL: ${url}`);
    
    const headers = {
      'Content-Type': 'application/json'
    };

    // Add authorization
    if (accessToken) {
      headers['Authorization'] = `Bearer ${accessToken}`;
      console.log(`🔐 Using Bearer token`);
    }
    
    if (Object.keys(cookies).length > 0) {
      headers['Cookie'] = buildCookieHeader();
      console.log(`🍪 Using cookies: ${Object.keys(cookies).join(', ')}`);
    }

    const body = {
      notes: 'Test break end'
    };

    if (employeeId) {
      body.employeeId = employeeId;
      console.log(`👤 Employee ID: ${employeeId}`);
    }

    console.log(`📤 Request body:`, JSON.stringify(body, null, 2));

    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(body)
    });

    console.log(`\n📊 Response Status: ${response.status}`);
    
    const data = await response.json();
    
    if (response.ok && data.success) {
      console.log(`✅ BREAK-END SUCCESSFUL`);
      console.log(`   Message: ${data.message}`);
      if (data.attendance) {
        console.log(`   Attendance ID: ${data.attendance._id}`);
        const lastBreak = data.attendance.breaks?.[data.attendance.breaks.length - 1];
        if (lastBreak) {
          console.log(`   Break ended at: ${lastBreak.endTime}`);
          console.log(`   Break duration: ${lastBreak.duration} minutes`);
        }
      }
      return true;
    } else {
      console.log(`❌ BREAK-END FAILED`);
      console.log(`   Status: ${response.status}`);
      console.log(`   Error: ${data.message}`);
      console.log(`   Full response:`, JSON.stringify(data, null, 2));
      return false;
    }
  } catch (error) {
    console.log(`❌ ERROR: ${error.message}`);
    console.log(`   Stack:`, error.stack);
    return false;
  }
}

async function test5_Logout() {
  console.log('\n' + '='.repeat(60));
  console.log('TEST 5: LOGOUT AND SESSION CLEARING');
  console.log('='.repeat(60));
  
  try {
    if (!accessToken && !cookies.accessToken) {
      console.log(`❌ SKIPPED: No authentication token`);
      return false;
    }

    const url = `${API_BASE}/auth/logout`;
    console.log(`📍 URL: ${url}`);
    
    const headers = {
      'Content-Type': 'application/json'
    };

    // Add authorization
    if (accessToken) {
      headers['Authorization'] = `Bearer ${accessToken}`;
      console.log(`🔐 Using Bearer token`);
    }
    
    if (Object.keys(cookies).length > 0) {
      headers['Cookie'] = buildCookieHeader();
      console.log(`🍪 Using cookies: ${Object.keys(cookies).join(', ')}`);
    }

    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify({})
    });

    console.log(`\n📊 Response Status: ${response.status}`);
    
    const data = await response.json();
    
    if (response.ok && data.success) {
      console.log(`✅ LOGOUT SUCCESSFUL`);
      console.log(`   Message: ${data.message}`);
      
      // Check if cookies are cleared
      const setCookieHeader = response.headers.get('set-cookie');
      if (setCookieHeader) {
        console.log(`🍪 Cookies cleared in response`);
      }
      
      return true;
    } else {
      console.log(`❌ LOGOUT FAILED`);
      console.log(`   Status: ${response.status}`);
      console.log(`   Error: ${data.message}`);
      console.log(`   Full response:`, JSON.stringify(data, null, 2));
      return false;
    }
  } catch (error) {
    console.log(`❌ ERROR: ${error.message}`);
    return false;
  }
}

async function runAllTests() {
  console.log('\n');
  console.log('╔' + '═'.repeat(58) + '╗');
  console.log('║' + ' '.repeat(10) + 'AUTHENTICATION & ATTENDANCE SYSTEM TEST' + ' '.repeat(10) + '║');
  console.log('╚' + '═'.repeat(58) + '╝');
  console.log(`\n🌐 API Base: ${API_BASE}`);
  console.log(`⏰ Started at: ${new Date().toISOString()}`);

  const results = {
    test1_login: false,
    test2_jwt_cookies: false,
    test3_break_start: false,
    test4_break_end: false,
    test5_logout: false
  };

  // Run tests in sequence
  results.test1_login = await test1_Login();
  
  if (results.test1_login) {
    results.test2_jwt_cookies = await test2_CheckJWTInCookies();
    results.test3_break_start = await test3_BreakStart();
    results.test4_break_end = await test4_BreakEnd();
    results.test5_logout = await test5_Logout();
  }

  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('TEST SUMMARY');
  console.log('='.repeat(60));
  
  const testNames = {
    test1_login: '1. Login with test credentials',
    test2_jwt_cookies: '2. JWT token in cookies',
    test3_break_start: '3. Break-start endpoint',
    test4_break_end: '4. Break-end endpoint',
    test5_logout: '5. Logout and session clearing'
  };

  let passCount = 0;
  for (const [key, name] of Object.entries(testNames)) {
    const status = results[key] ? '✅ PASS' : '❌ FAIL';
    console.log(`${status} - ${name}`);
    if (results[key]) passCount++;
  }

  console.log('\n' + '='.repeat(60));
  console.log(`📊 Results: ${passCount}/${Object.keys(results).length} tests passed`);
  console.log(`⏰ Completed at: ${new Date().toISOString()}`);
  console.log('='.repeat(60) + '\n');

  process.exit(passCount === Object.keys(results).length ? 0 : 1);
}

runAllTests().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
