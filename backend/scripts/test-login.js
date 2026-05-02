/**
 * Login Test Script for WorkPlus Pro
 * Tests super admin login functionality
 * 
 * Usage: node scripts/test-login.js
 */

import dotenv from 'dotenv';
import mongoose from 'mongoose';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';

dotenv.config();

// Import User model
import User from '../models/User.js';

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
};

const log = {
  success: (msg) => console.log(`${colors.green}✅${colors.reset} ${msg}`),
  error: (msg) => console.log(`${colors.red}❌${colors.reset} ${msg}`),
  warn: (msg) => console.log(`${colors.yellow}⚠️${colors.reset}  ${msg}`),
  info: (msg) => console.log(`${colors.cyan}ℹ${colors.reset}  ${msg}`),
};

/**
 * Test super admin login
 */
async function testLogin() {
  console.log('\n' + '='.repeat(70));
  console.log('🔐 SUPER ADMIN LOGIN TEST');
  console.log('='.repeat(70) + '\n');

  const email = process.env.SUPER_ADMIN_EMAIL || 'admin@workpluspro.com';
  const password = process.env.SUPER_ADMIN_PASSWORD || 'Jadu@123';

  log.info(`Testing login for: ${email}`);
  log.info(`Password: ${'*'.repeat(password.length)}`);
  console.log('');

  try {
    // Connect to MongoDB
    log.info('Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI, {
      serverSelectionTimeoutMS: 10000,
    });
    log.success('Connected to MongoDB');
    console.log('');

    // Test 1: Find user
    log.info('Test 1: Finding user by email...');
    const user = await User.findOne({ email: email.toLowerCase() }).select('+password');
    
    if (!user) {
      log.error('User not found in database');
      log.warn('Run server to seed super admin: node server.js');
      process.exit(1);
    }
    
    log.success('User found in database');
    console.log(`  - ID: ${user._id}`);
    console.log(`  - Name: ${user.name}`);
    console.log(`  - Email: ${user.email}`);
    console.log(`  - Role: ${user.role}`);
    console.log(`  - Active: ${user.isActive}`);
    console.log(`  - Has Password: ${!!user.password}`);
    console.log('');

    // Test 2: Check if user is active
    log.info('Test 2: Checking if user is active...');
    if (user.isActive === false) {
      log.error('User account is deactivated');
      process.exit(1);
    }
    log.success('User account is active');
    console.log('');

    // Test 3: Verify password
    log.info('Test 3: Verifying password...');
    if (!user.password) {
      log.error('User has no password set');
      log.warn('This is a critical error - user cannot login');
      process.exit(1);
    }
    
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      log.error('Password does not match');
      log.warn('Expected password: ' + password);
      log.warn('Run server to reset password: node server.js');
      process.exit(1);
    }
    log.success('Password is correct');
    console.log('');

    // Test 4: Generate JWT token
    log.info('Test 4: Generating JWT token...');
    if (!process.env.JWT_SECRET) {
      log.error('JWT_SECRET not configured');
      process.exit(1);
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
    
    log.success('JWT token generated successfully');
    console.log(`  - Token length: ${token.length} characters`);
    console.log(`  - Token preview: ${token.substring(0, 50)}...`);
    console.log('');

    // Test 5: Verify JWT token
    log.info('Test 5: Verifying JWT token...');
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    log.success('JWT token is valid');
    console.log(`  - User ID: ${decoded.userId}`);
    console.log(`  - Email: ${decoded.email}`);
    console.log(`  - Role: ${decoded.role}`);
    console.log(`  - Tenant ID: ${decoded.tenantId}`);
    console.log('');

    // Test 6: Simulate login response
    log.info('Test 6: Simulating login response...');
    const loginResponse = {
      success: true,
      message: "Login successful",
      data: {
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          role: user.role,
          avatar: user.avatar || null,
          organization: user.organization || 'WorkPlus Inc.'
        },
        token: token
      }
    };
    
    log.success('Login response generated');
    console.log(JSON.stringify(loginResponse, null, 2));
    console.log('');

    // Summary
    console.log('='.repeat(70));
    console.log('📊 TEST SUMMARY');
    console.log('='.repeat(70));
    console.log('');
    log.success('ALL TESTS PASSED!');
    console.log('');
    log.info('Super Admin Login Details:');
    console.log(`  Email:    ${email}`);
    console.log(`  Password: ${password}`);
    console.log(`  Role:     ${user.role}`);
    console.log('');
    log.info('Expected Frontend Redirect:');
    console.log(`  Route: /super-admin/dashboard`);
    console.log('');
    log.success('Super admin can login successfully! 🎉');
    console.log('');

  } catch (error) {
    console.log('');
    log.error(`Test failed: ${error.message}`);
    console.error(error.stack);
    process.exit(1);
  } finally {
    await mongoose.connection.close();
    log.info('Database connection closed');
  }
}

// Run the test
testLogin();
