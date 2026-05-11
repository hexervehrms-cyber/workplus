#!/usr/bin/env node

/**
 * Test Attendance Endpoints
 * Tests check-in, check-out, break-start, break-end, meeting-start, meeting-end
 */

import fetch from 'node-fetch';
import dotenv from 'dotenv';

dotenv.config();

const API_URL = process.env.VITE_API_URL || 'https://workplus-backend-sg3a.onrender.com';
const API_BASE = `${API_URL}/api`;

// Test user credentials (you'll need to update these)
const TEST_TOKEN = process.env.TEST_TOKEN || 'your-test-token-here';

const endpoints = [
  {
    name: 'Check-In',
    method: 'POST',
    path: '/attendance/check-in',
    body: {
      location: 'Office',
      notes: 'Test check-in'
    }
  },
  {
    name: 'Check-Out',
    method: 'POST',
    path: '/attendance/check-out',
    body: {
      location: 'Office',
      notes: 'Test check-out'
    }
  },
  {
    name: 'Break Start',
    method: 'POST',
    path: '/attendance/break-start',
    body: {
      breakType: 'regular',
      notes: 'Test break start'
    }
  },
  {
    name: 'Break End',
    method: 'POST',
    path: '/attendance/break-end',
    body: {
      notes: 'Test break end'
    }
  },
  {
    name: 'Meeting Start',
    method: 'POST',
    path: '/attendance/meeting-start',
    body: {
      meetingTitle: 'Test Meeting',
      meetingType: 'internal',
      notes: 'Test meeting start'
    }
  },
  {
    name: 'Meeting End',
    method: 'POST',
    path: '/attendance/meeting-end',
    body: {
      notes: 'Test meeting end'
    }
  },
  {
    name: 'Get Today Attendance',
    method: 'GET',
    path: '/attendance/today',
    body: null
  }
];

async function testEndpoint(endpoint) {
  try {
    const url = `${API_BASE}${endpoint.path}`;
    const options = {
      method: endpoint.method,
      headers: {
        'Authorization': `Bearer ${TEST_TOKEN}`,
        'Content-Type': 'application/json'
      }
    };

    if (endpoint.body) {
      options.body = JSON.stringify(endpoint.body);
    }

    console.log(`\n📝 Testing: ${endpoint.name}`);
    console.log(`   URL: ${url}`);
    console.log(`   Method: ${endpoint.method}`);

    const response = await fetch(url, options);
    const data = await response.json();

    if (response.ok) {
      console.log(`   ✅ Status: ${response.status}`);
      console.log(`   Response: ${JSON.stringify(data).substring(0, 100)}...`);
    } else {
      console.log(`   ❌ Status: ${response.status}`);
      console.log(`   Error: ${data.message || JSON.stringify(data).substring(0, 100)}`);
    }
  } catch (error) {
    console.log(`   ❌ Error: ${error.message}`);
  }
}

async function runTests() {
  console.log('🧪 Testing Attendance Endpoints');
  console.log(`📍 API Base: ${API_BASE}`);
  console.log(`🔑 Token: ${TEST_TOKEN.substring(0, 20)}...`);

  for (const endpoint of endpoints) {
    await testEndpoint(endpoint);
  }

  console.log('\n✅ Tests completed!');
}

runTests().catch(console.error);
