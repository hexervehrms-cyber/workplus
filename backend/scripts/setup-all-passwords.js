#!/usr/bin/env node

/**
 * Setup All User Passwords
 * Sets default passwords for all users for testing
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

const setupAllPasswords = async () => {
  try {
    console.log('\n🚀 Setting Up All User Passwords...\n');

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

    // Password mapping for each user
    const passwordMap = {
      'atul@hexerve.com': 'Jadu@123',                    // Already set
      'atul.kumar@hexerve.com': 'Admin@123',
      'ajay.verma@hexerve.com': 'Admin@123',
      'superadmin@company.com': 'SuperAdmin@123',
      'admin@workpluspro.com': 'SuperAdmin@123',
      'abhishek.rajput@hexerve.com': 'Employee@123',
      'rinky@hexerve.com': 'Employee@123',
      'harsh.gupta@hexerve.com': 'Employee@123'
    };

    console.log('📊 Password Setup Plan:\n');

    let updatedCount = 0;

    for (const [email, password] of Object.entries(passwordMap)) {
      try {
        const user = await User.findOne({ email: email.toLowerCase() });

        if (!user) {
          console.log(`   ⚠️  ${email} - User not found`);
          continue;
        }

        // Hash password
        const hashedPassword = await bcrypt.hash(password, 12);

        // Update password
        user.password = hashedPassword;
        await user.save();

        console.log(`   ✅ ${email} - Password set to: ${password}`);
        updatedCount++;

      } catch (error) {
        console.log(`   ❌ ${email} - Error: ${error.message}`);
      }
    }

    console.log(`\n✅ Updated ${updatedCount} user passwords\n`);

    // List all users with their passwords
    console.log('📋 Final User List with Passwords:\n');
    console.log('Email                          | Password           | Role');
    console.log('─'.repeat(70));

    for (const [email, password] of Object.entries(passwordMap)) {
      const user = await User.findOne({ email: email.toLowerCase() });
      if (user) {
        const emailPad = email.padEnd(30);
        const passwordPad = password.padEnd(18);
        const role = user.role;
        console.log(`${emailPad} | ${passwordPad} | ${role}`);
      }
    }

    // Disconnect
    await mongoose.disconnect();
    console.log('\n✅ Setup complete!\n');
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

// Run setup
setupAllPasswords();
