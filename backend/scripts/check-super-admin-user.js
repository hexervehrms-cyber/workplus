#!/usr/bin/env node

/**
 * Check Super Admin User
 * Verifies if super admin user exists and shows details
 */

import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import mongoose from 'mongoose';

// Setup __dirname for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables from backend/.env
const envPath = path.join(__dirname, '..', '.env');
console.log('📝 Loading environment from:', envPath);
dotenv.config({ path: envPath });

// Import User model
import User from '../models/User.js';

const checkSuperAdmin = async () => {
  try {
    console.log('\n🚀 Checking Super Admin User...\n');

    const mongoUri = process.env.MONGODB_URI;
    const superAdminEmail = process.env.SUPER_ADMIN_EMAIL;

    if (!mongoUri || !superAdminEmail) {
      console.error('❌ Missing MONGODB_URI or SUPER_ADMIN_EMAIL');
      process.exit(1);
    }

    // Connect to MongoDB
    console.log('🔗 Connecting to MongoDB...');
    await mongoose.connect(mongoUri, {
      serverSelectionTimeoutMS: 10000,
      socketTimeoutMS: 45000,
    });
    console.log('✅ Connected to MongoDB\n');

    // Find user by email
    console.log(`🔍 Searching for user with email: ${superAdminEmail}`);
    const user = await User.findOne({ email: superAdminEmail.toLowerCase() });

    if (!user) {
      console.log('❌ User not found\n');
      await mongoose.disconnect();
      process.exit(1);
    }

    console.log('\n✅ User Found!\n');
    console.log('📊 User Details:');
    console.log(`   ID: ${user._id}`);
    console.log(`   Email: ${user.email}`);
    console.log(`   Name: ${user.name}`);
    console.log(`   Role: ${user.role}`);
    console.log(`   Organization: ${user.organization}`);
    console.log(`   Active: ${user.isActive}`);
    console.log(`   Email Verified: ${user.emailVerified}`);
    console.log(`   Created: ${user.createdAt}`);
    console.log(`   Updated: ${user.updatedAt}`);

    // Check if password is set
    const userWithPassword = await User.findOne({ email: superAdminEmail.toLowerCase() }).select('+password');
    console.log(`   Password Set: ${userWithPassword.password ? '✅ Yes' : '❌ No'}`);

    // Disconnect
    await mongoose.disconnect();
    console.log('\n✅ Check complete!\n');
    process.exit(0);

  } catch (error) {
    console.error('\n❌ Error:');
    console.error('   Message:', error.message);
    console.error('   Stack:', error.stack);
    
    try {
      await mongoose.disconnect();
    } catch (disconnectError) {
      console.error('   Disconnect error:', disconnectError.message);
    }
    
    process.exit(1);
  }
};

// Run check
checkSuperAdmin();
