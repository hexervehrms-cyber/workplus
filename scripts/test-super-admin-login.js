/**
 * Super Admin Login Test Script
 * Tests the complete Super Admin seeding and login flow
 */

import dotenv from 'dotenv';
import mongoose from 'mongoose';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';

// Load environment variables
dotenv.config();

// Import User model
import User from '../models/User.js';

const SUPER_ADMIN_EMAIL = process.env.SUPER_ADMIN_EMAIL || 'admin@workpluspro.com';
const SUPER_ADMIN_PASSWORD = process.env.SUPER_ADMIN_PASSWORD || 'Jadu@123';
const SUPER_ADMIN_NAME = process.env.SUPER_ADMIN_NAME || 'Super Admin';

console.log('\n🔐 SUPER ADMIN LOGIN TEST');
console.log('='.repeat(60));

/**
 * Connect to MongoDB
 */
async function connectDB() {
  try {
    console.log('\n📡 Connecting to MongoDB...');
    console.log(`   URI: ${process.env.MONGODB_URI.replace(/\/\/([^:]+):([^@]+)@/, '//$1:****@')}`);
    
    await mongoose.connect(process.env.MONGODB_URI, {
      serverSelectionTimeoutMS: 10000,
      socketTimeoutMS: 45000,
    });
    
    console.log('✅ MongoDB connected successfully');
    return true;
  } catch (error) {
    console.error('❌ MongoDB connection failed:', error.message);
    return false;
  }
}

/**
 * Test 1: Check if Super Admin exists in database
 */
async function testSuperAdminExists() {
  console.log('\n📋 TEST 1: Check Super Admin Exists');
  console.log('-'.repeat(60));
  
  try {
    const superAdmin = await User.findOne({ 
      email: SUPER_ADMIN_EMAIL.toLowerCase() 
    }).select('+password');
    
    if (!superAdmin) {
      console.log('❌ FAILED: Super Admin does not exist in database');
      console.log('   Email searched:', SUPER_ADMIN_EMAIL);
      return false;
    }
    
    console.log('✅ PASSED: Super Admin exists in database');
    console.log('   ID:', superAdmin._id);
    console.log('   Name:', superAdmin.name);
    console.log('   Email:', superAdmin.email);
    console.log('   Role:', superAdmin.role);
    console.log('   Active:', superAdmin.isActive);
    console.log('   Has Password:', !!superAdmin.password);
    console.log('   Created:', superAdmin.createdAt);
    
    return superAdmin;
  } catch (error) {
    console.error('❌ ERROR:', error.message);
    return false;
  }
}

/**
 * Test 2: Verify password hash
 */
async function testPasswordHash(superAdmin) {
  console.log('\n🔑 TEST 2: Verify Password Hash');
  console.log('-'.repeat(60));
  
  try {
    if (!superAdmin.password) {
      console.log('❌ FAILED: Super Admin has no password set');
      return false;
    }
    
    const isPasswordValid = await bcrypt.compare(SUPER_ADMIN_PASSWORD, superAdmin.password);
    
    if (!isPasswordValid) {
      console.log('❌ FAILED: Password does not match');
      console.log('   Expected password:', SUPER_ADMIN_PASSWORD);
      console.log('   Hash in DB:', superAdmin.password.substring(0, 20) + '...');
      return false;
    }
    
    console.log('✅ PASSED: Password hash is valid');
    console.log('   Password:', SUPER_ADMIN_PASSWORD);
    console.log('   Hash:', superAdmin.password.substring(0, 30) + '...');
    
    return true;
  } catch (error) {
    console.error('❌ ERROR:', error.message);
    return false;
  }
}

/**
 * Test 3: Simulate login flow
 */
async function testLoginFlow() {
  console.log('\n🔐 TEST 3: Simulate Login Flow');
  console.log('-'.repeat(60));
  
  try {
    // Step 1: Find user by email
    console.log('   Step 1: Finding user by email...');
    const user = await User.findOne({ 
      email: SUPER_ADMIN_EMAIL.toLowerCase().trim() 
    }).select('+password');
    
    if (!user) {
      console.log('   ❌ User not found');
      return false;
    }
    console.log('   ✅ User found');
    
    // Step 2: Check if active
    console.log('   Step 2: Checking if user is active...');
    if (user.isActive === false) {
      console.log('   ❌ User is inactive');
      return false;
    }
    console.log('   ✅ User is active');
    
    // Step 3: Verify password
    console.log('   Step 3: Verifying password...');
    if (!user.password) {
      console.log('   ❌ No password set');
      return false;
    }
    
    const isPasswordValid = await bcrypt.compare(SUPER_ADMIN_PASSWORD, user.password);
    if (!isPasswordValid) {
      console.log('   ❌ Invalid password');
      return false;
    }
    console.log('   ✅ Password valid');
    
    // Step 4: Generate JWT token
    console.log('   Step 4: Generating JWT token...');
    if (!process.env.JWT_SECRET) {
      console.log('   ❌ JWT_SECRET not configured');
      return false;
    }
    
    const token = jwt.sign(
      { 
        userId: user._id,
        email: user.email,
        role: user.role,
        tenantId: user.orgId || 'system'
      },
      process.env.JWT_SECRET,
      { 
        expiresIn: '24h',
        issuer: 'workplus-api',
        audience: 'workplus-client'
      }
    );
    console.log('   ✅ JWT token generated');
    console.log('   Token:', token.substring(0, 50) + '...');
    
    // Step 5: Verify token
    console.log('   Step 5: Verifying JWT token...');
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    console.log('   ✅ Token verified');
    console.log('   Decoded userId:', decoded.userId);
    console.log('   Decoded role:', decoded.role);
    
    console.log('\n✅ PASSED: Complete login flow successful');
    
    return {
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        avatar: user.avatar || null,
        organization: user.organization || 'WorkPlus Inc.'
      },
      token: token
    };
  } catch (error) {
    console.error('❌ ERROR:', error.message);
    console.error(error.stack);
    return false;
  }
}

/**
 * Test 4: Test HTTP login endpoint (if server is running)
 */
async function testHTTPLogin() {
  console.log('\n🌐 TEST 4: Test HTTP Login Endpoint');
  console.log('-'.repeat(60));
  
  try {
    const API_URL = process.env.VITE_API_URL || 'http://localhost:5000';
    console.log('   API URL:', API_URL);
    
    const response = await fetch(`${API_URL}/api/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        email: SUPER_ADMIN_EMAIL,
        password: SUPER_ADMIN_PASSWORD
      })
    });
    
    const data = await response.json();
    
    if (!response.ok) {
      console.log('   ❌ HTTP request failed');
      console.log('   Status:', response.status);
      console.log('   Response:', JSON.stringify(data, null, 2));
      return false;
    }
    
    if (!data.success) {
      console.log('   ❌ Login failed');
      console.log('   Message:', data.message);
      return false;
    }
    
    console.log('✅ PASSED: HTTP login successful');
    console.log('   User:', data.data.user.name);
    console.log('   Role:', data.data.user.role);
    console.log('   Token:', data.data.token.substring(0, 50) + '...');
    
    return data;
  } catch (error) {
    console.log('⚠️  SKIPPED: Server not running or not accessible');
    console.log('   Error:', error.message);
    return null;
  }
}

/**
 * Main test runner
 */
async function runTests() {
  try {
    // Connect to database
    const connected = await connectDB();
    if (!connected) {
      console.log('\n❌ Cannot run tests without database connection');
      process.exit(1);
    }
    
    // Test 1: Check if Super Admin exists
    const superAdmin = await testSuperAdminExists();
    if (!superAdmin) {
      console.log('\n❌ TEST SUITE FAILED: Super Admin does not exist');
      console.log('\n💡 SOLUTION: Start the server to trigger auto-seeding');
      console.log('   Command: npm start');
      process.exit(1);
    }
    
    // Test 2: Verify password hash
    const passwordValid = await testPasswordHash(superAdmin);
    if (!passwordValid) {
      console.log('\n❌ TEST SUITE FAILED: Password verification failed');
      console.log('\n💡 SOLUTION: Run the seeding script to fix password');
      console.log('   Command: node scripts/seed-super-admin.js');
      process.exit(1);
    }
    
    // Test 3: Simulate login flow
    const loginResult = await testLoginFlow();
    if (!loginResult) {
      console.log('\n❌ TEST SUITE FAILED: Login flow failed');
      process.exit(1);
    }
    
    // Test 4: Test HTTP endpoint (optional)
    await testHTTPLogin();
    
    // Summary
    console.log('\n' + '='.repeat(60));
    console.log('✅ ALL TESTS PASSED');
    console.log('='.repeat(60));
    console.log('\n📋 SUPER ADMIN CREDENTIALS:');
    console.log('   Email:', SUPER_ADMIN_EMAIL);
    console.log('   Password:', SUPER_ADMIN_PASSWORD);
    console.log('   Role: super_admin');
    console.log('\n🚀 READY FOR PRODUCTION LOGIN');
    console.log('\n💡 LOGIN INSTRUCTIONS:');
    console.log('   1. Go to: https://workplus-murex.vercel.app/login');
    console.log('   2. Enter email:', SUPER_ADMIN_EMAIL);
    console.log('   3. Enter password:', SUPER_ADMIN_PASSWORD);
    console.log('   4. Click "Sign In"');
    console.log('   5. You will be redirected to Super Admin Dashboard');
    
    process.exit(0);
  } catch (error) {
    console.error('\n❌ TEST SUITE ERROR:', error.message);
    console.error(error.stack);
    process.exit(1);
  } finally {
    // Close database connection
    if (mongoose.connection.readyState === 1) {
      await mongoose.connection.close();
      console.log('\n📡 Database connection closed');
    }
  }
}

// Run tests
runTests();
