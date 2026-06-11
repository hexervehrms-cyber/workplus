#!/usr/bin/env node

/**
 * Debug Authentication Response
 * Logs full response to understand token handling
 */

import fetch from 'node-fetch';
import dotenv from 'dotenv';

dotenv.config();

const API_URL = process.env.VITE_API_URL || 'https://workplus-backend-sg3a.onrender.com';
const API_BASE = `${API_URL}/api`;

const TEST_EMAIL = process.env.TEST_EMAIL || 'atul@hexerve.com';
const TEST_PASSWORD = process.env.TEST_PASSWORD;

if (!TEST_PASSWORD) {
  console.error('❌ ERROR: TEST_PASSWORD environment variable is required');
  console.error('   Set TEST_PASSWORD in .env file');
  process.exit(1);
}

async function debugLogin() {
  console.log('\n🔍 DEBUG: LOGIN RESPONSE\n');
  
  try {
    const url = `${API_BASE}/auth/login`;
    console.log(`📍 URL: ${url}\n`);
    
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

    console.log('📊 RESPONSE HEADERS:');
    console.log('─'.repeat(60));
    for (const [key, value] of response.headers.entries()) {
      if (key.toLowerCase() === 'set-cookie') {
        console.log(`${key}: ${value}`);
      }
    }
    console.log('');

    console.log('📊 RESPONSE STATUS:', response.status);
    console.log('');

    const data = await response.json();
    
    console.log('📊 RESPONSE BODY:');
    console.log('─'.repeat(60));
    console.log(JSON.stringify(data, null, 2));
    console.log('');

    console.log('🔍 KEY FIELDS:');
    console.log('─'.repeat(60));
    console.log(`success: ${data.success}`);
    console.log(`message: ${data.message}`);
    console.log(`user._id: ${data.user?._id}`);
    console.log(`user.email: ${data.user?.email}`);
    console.log(`user.role: ${data.user?.role}`);
    console.log(`user.employee._id: ${data.user?.employee?._id}`);
    console.log(`accessToken: ${data.accessToken ? data.accessToken.substring(0, 30) + '...' : 'NOT PROVIDED'}`);
    console.log(`refreshToken: ${data.refreshToken ? data.refreshToken.substring(0, 30) + '...' : 'NOT PROVIDED'}`);
    console.log('');

  } catch (error) {
    console.log(`❌ ERROR: ${error.message}`);
    console.log(error.stack);
  }
}

debugLogin();
