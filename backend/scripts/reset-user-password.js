#!/usr/bin/env node

/**
 * Reset User Password
 * Resets password for a specific user
 * 
 * Usage: node backend/scripts/reset-user-password.js <email> <newPassword>
 * Example: node backend/scripts/reset-user-password.js abhishek.rajput@hexerve.com Test@123
 */

import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import mongoose from 'mongoose';
import bcrypt from 'bcrypt';

// Setup __dirname for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables from backend/.env
const envPath = path.join(__dirname, '..', '.env');
console.log('📝 Loading environment from:', envPath);
dotenv.config({ path: envPath });

// Import User model
import User from '../models/User.js';

const resetUserPassword = async () => {
  try {
    const args = process.argv.slice(2);
    
    if (args.length < 2) {
      console.log('\n❌ Missing arguments!\n');
      console.log('Usage: node backend/scripts/reset-user-password.js <email> <newPassword>\n');
      console.log('Example: node backend/scripts/reset-user-password.js abhishek.rajput@hexerve.com Test@123\n');
      process.exit(1);
    }

    const email = args[0].toLowerCase();
    const newPassword = args[1];

    console.log('\n🚀 Resetting User Password...\n');

    const mongoUri = process.env.MONGODB_URI;

    if (!mongoUri) {
      console.error('❌ Missing MONGODB_URI');
      process.exit(1);
    }

    // Connect to MongoDB
    console.log('🔗 Connecting to MongoDB...');
    await mongoose.connect(mongoUri, {
      serverSelectionTimeoutMS: 10000,
      socketTimeoutMS: 45000,
    });
    console.log('✅ Connected to MongoDB\n');

    // Find user
    console.log(`🔍 Searching for user: ${email}`);
    const user = await User.findOne({ email });

    if (!user) {
      console.log('❌ User not found\n');
      await mongoose.disconnect();
      process.exit(1);
    }

    console.log(`✅ User found: ${user.name}\n`);

    // Hash new password
    console.log('🔐 Hashing new password...');
    const hashedPassword = await bcrypt.hash(newPassword, 12);

    // Update password
    user.password = hashedPassword;
    await user.save();

    console.log('\n✅ Password Reset Successfully!\n');
    console.log('📊 User Details:');
    console.log(`   Email: ${user.email}`);
    console.log(`   Name: ${user.name}`);
    console.log(`   Role: ${user.role}`);
    console.log(`   New Password: ${newPassword}`);

    // Disconnect
    await mongoose.disconnect();
    console.log('\n✅ Reset complete!\n');
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

// Run reset
resetUserPassword();
