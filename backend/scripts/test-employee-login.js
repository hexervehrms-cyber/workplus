#!/usr/bin/env node

/**
 * Test Employee Login
 * Debug why employee login is failing
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

console.log('\n🚀 Testing Employee Login\n');
console.log('═'.repeat(80));

// Test data
const employees = [
  { email: 'abhishek.rajput@hexerve.com', password: 'Employee@123', name: 'Abhishek Rajput' },
  { email: 'rinky@hexerve.com', password: 'Employee@123', name: 'Rinky' },
  { email: 'harsh.gupta@hexerve.com', password: 'Employee@123', name: 'Harsh Gupta' }
];

// Helper function to make API calls
async function apiCall(method, endpoint, body = null) {
  try {
    const options = {
      method,
      headers: {
        'Content-Type': 'application/json'
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

// Test each employee login
for (const employee of employees) {
  console.log(`\n📝 Testing Login: ${employee.email}`);
  console.log(`   Password: ${employee.password}`);
  console.log(`   Name: ${employee.name}`);

  const result = await apiCall('POST', '/api/auth/login', {
    email: employee.email,
    password: employee.password
  });

  if (result.ok) {
    console.log(`   ✅ Login successful`);
    console.log(`   Token: ${result.data.token?.substring(0, 30)}...`);
    console.log(`   User: ${result.data.user?.name} (${result.data.user?.role})`);
  } else {
    console.log(`   ❌ Login failed`);
    console.log(`   Status: ${result.status}`);
    console.log(`   Error: ${result.data?.message || result.error}`);
    console.log(`   Full response:`, JSON.stringify(result.data, null, 2));
  }
}

console.log('\n═'.repeat(80) + '\n');

process.exit(0);
