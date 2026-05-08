#!/usr/bin/env node

/**
 * Fix Super Admin Role
 * Updates the admin user to super_admin role
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

const fixSuperAdminRole = async () => {
  try {
    console.log('\n🚀 Fixing Super Admin Role...\n');

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

    // Find and update user
    console.log(`🔍 Searching for user with email: ${superAdminEmail}`);
    const user = await User.findOne({ email: superAdminEmail.toLowerCase() });

    if (!user) {
      console.log('❌ User not found\n');
      await mongoose.disconnect();
      process.exit(1);
    }

    console.log(`\n📝 Current Role: ${user.role}`);
    console.log(`📝 Updating to: super_admin\n`);

    // Revert role back to admin
    user.role = 'admin';
    await user.save();

    console.log('✅ Role Reverted to Admin!\n');
    console.log('📊 Updated User Details:');
    console.log(`   ID: ${user._id}`);
    console.log(`   Email: ${user.email}`);
    console.log(`   Name: ${user.name}`);
    console.log(`   Role: ${user.role}`);
    console.log(`   Active: ${user.isActive}`);

    // Disconnect
    await mongoose.disconnect();
    console.log('\n✅ Fix complete!\n');
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

// Run fix
fixSuperAdminRole();
