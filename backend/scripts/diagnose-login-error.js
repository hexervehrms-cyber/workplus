/**
 * Login Error Diagnostic Script
 * Simulates the exact production login flow to identify issues
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

console.log('\n🔍 LOGIN ERROR DIAGNOSTIC');
console.log('='.repeat(60));

/**
 * Connect to MongoDB
 */
async function connectDB() {
  try {
    console.log('\n📡 Connecting to MongoDB...');
    
    await mongoose.connect(process.env.MONGODB_URI, {
      serverSelectionTimeoutMS: 10000,
      socketTimeoutMS: 45000,
    });
    
    console.log('✅ MongoDB connected');
    return true;
  } catch (error) {
    console.error('❌ MongoDB connection failed:', error.message);
    return false;
  }
}

/**
 * Test exact production login flow
 */
async function testProductionLoginFlow() {
  console.log('\n🔐 SIMULATING PRODUCTION LOGIN FLOW');
  console.log('-'.repeat(60));
  
  try {
    const email = SUPER_ADMIN_EMAIL;
    const password = SUPER_ADMIN_PASSWORD;
    
    console.log('Step 1: Input validation...');
    if (!email || !password) {
      console.log('   ❌ Missing credentials');
      return false;
    }
    console.log('   ✅ Credentials provided');
    
    console.log('\nStep 2: Email format validation...');
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      console.log('   ❌ Invalid email format');
      return false;
    }
    console.log('   ✅ Email format valid');
    
    console.log('\nStep 3: Database connection check...');
    if (mongoose.connection.readyState !== 1) {
      console.log('   ❌ Database not connected');
      return false;
    }
    console.log('   ✅ Database connected');
    
    console.log('\nStep 4: Finding user with password field...');
    const user = await User.findOne({ email: email.toLowerCase().trim() })
      .select('+password')
      .maxTimeMS(10000);
    
    if (!user) {
      console.log('   ❌ User not found');
      return false;
    }
    console.log('   ✅ User found:', user._id);
    console.log('   - Name:', user.name);
    console.log('   - Email:', user.email);
    console.log('   - Role:', user.role);
    console.log('   - Active:', user.isActive);
    console.log('   - Has password:', !!user.password);
    
    console.log('\nStep 5: Checking if user is active...');
    if (user.isActive === false) {
      console.log('   ❌ User is inactive');
      return false;
    }
    console.log('   ✅ User is active');
    
    console.log('\nStep 6: Verifying password exists...');
    if (!user.password) {
      console.log('   ❌ No password set');
      return false;
    }
    console.log('   ✅ Password exists');
    
    console.log('\nStep 7: Comparing password...');
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      console.log('   ❌ Invalid password');
      return false;
    }
    console.log('   ✅ Password valid');
    
    console.log('\nStep 8: Checking JWT_SECRET...');
    if (!process.env.JWT_SECRET) {
      console.log('   ❌ JWT_SECRET not configured');
      return false;
    }
    console.log('   ✅ JWT_SECRET configured');
    
    console.log('\nStep 9: Generating JWT token...');
    const token = jwt.sign(
      { 
        userId: user._id,
        email: user.email,
        role: user.role,
        tenantId: user.orgId
      },
      process.env.JWT_SECRET,
      { 
        expiresIn: '24h',
        issuer: 'workplus-api',
        audience: 'workplus-client'
      }
    );
    console.log('   ✅ Token generated');
    console.log('   Token:', token.substring(0, 50) + '...');
    
    console.log('\nStep 10: Updating last login (OLD METHOD - user.save())...');
    try {
      // This is the OLD method that might cause issues
      user.lastLogin = new Date();
      user.loginAttempts = 0;
      await user.save();
      console.log('   ✅ user.save() worked');
    } catch (saveError) {
      console.log('   ❌ user.save() FAILED:', saveError.message);
      console.log('   Error name:', saveError.name);
      console.log('   Error code:', saveError.code);
      console.log('   This is likely the cause of the 500 error!');
      
      console.log('\nStep 10b: Trying NEW METHOD - findByIdAndUpdate()...');
      try {
        await User.findByIdAndUpdate(user._id, {
          lastLogin: new Date(),
          loginAttempts: 0
        });
        console.log('   ✅ findByIdAndUpdate() worked');
        console.log('   💡 SOLUTION: Use findByIdAndUpdate instead of user.save()');
      } catch (updateError) {
        console.log('   ❌ findByIdAndUpdate() also failed:', updateError.message);
      }
    }
    
    console.log('\n✅ LOGIN FLOW COMPLETED SUCCESSFULLY');
    
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
    console.error('\n❌ LOGIN FLOW ERROR:', error.message);
    console.error('   Error name:', error.name);
    console.error('   Error code:', error.code);
    console.error('   Stack:', error.stack);
    return false;
  }
}

/**
 * Test password field issues
 */
async function testPasswordFieldIssues() {
  console.log('\n🔑 TESTING PASSWORD FIELD ISSUES');
  console.log('-'.repeat(60));
  
  try {
    console.log('Test 1: Retrieve user WITHOUT password field...');
    const userWithoutPassword = await User.findOne({ 
      email: SUPER_ADMIN_EMAIL.toLowerCase() 
    });
    console.log('   ✅ Retrieved user');
    console.log('   Has password field:', !!userWithoutPassword.password);
    
    console.log('\nTest 2: Retrieve user WITH password field...');
    const userWithPassword = await User.findOne({ 
      email: SUPER_ADMIN_EMAIL.toLowerCase() 
    }).select('+password');
    console.log('   ✅ Retrieved user');
    console.log('   Has password field:', !!userWithPassword.password);
    
    console.log('\nTest 3: Try to save user WITH password field...');
    try {
      userWithPassword.lastLogin = new Date();
      await userWithPassword.save();
      console.log('   ✅ Save successful');
    } catch (saveError) {
      console.log('   ❌ Save failed:', saveError.message);
      console.log('   This confirms the issue!');
    }
    
    console.log('\nTest 4: Try findByIdAndUpdate instead...');
    try {
      await User.findByIdAndUpdate(userWithPassword._id, {
        lastLogin: new Date()
      });
      console.log('   ✅ Update successful');
      console.log('   💡 SOLUTION CONFIRMED: Use findByIdAndUpdate');
    } catch (updateError) {
      console.log('   ❌ Update failed:', updateError.message);
    }
    
    return true;
  } catch (error) {
    console.error('❌ Test error:', error.message);
    return false;
  }
}

/**
 * Main diagnostic runner
 */
async function runDiagnostics() {
  try {
    // Connect to database
    const connected = await connectDB();
    if (!connected) {
      console.log('\n❌ Cannot run diagnostics without database connection');
      process.exit(1);
    }
    
    // Test production login flow
    await testProductionLoginFlow();
    
    // Test password field issues
    await testPasswordFieldIssues();
    
    console.log('\n' + '='.repeat(60));
    console.log('✅ DIAGNOSTICS COMPLETE');
    console.log('='.repeat(60));
    console.log('\n💡 RECOMMENDED FIX:');
    console.log('   Replace user.save() with User.findByIdAndUpdate()');
    console.log('   in the login route to avoid password field issues.');
    
    process.exit(0);
  } catch (error) {
    console.error('\n❌ DIAGNOSTIC ERROR:', error.message);
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

// Run diagnostics
runDiagnostics();
