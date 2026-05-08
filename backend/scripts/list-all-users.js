#!/usr/bin/env node

/**
 * List All Users
 * Shows all users in the database with their roles
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

const listAllUsers = async () => {
  try {
    console.log('\n🚀 Listing All Users...\n');

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

    // Find all users
    const users = await User.find({}).select('_id email name role isActive createdAt').sort({ createdAt: -1 });

    if (users.length === 0) {
      console.log('❌ No users found\n');
      await mongoose.disconnect();
      process.exit(0);
    }

    console.log(`✅ Found ${users.length} User(s)\n`);
    console.log('📊 Users List:');
    console.log('─'.repeat(100));
    console.log('Email                          | Name                    | Role       | Active | Created');
    console.log('─'.repeat(100));

    users.forEach((user, index) => {
      const email = (user.email || '').padEnd(30);
      const name = (user.name || '').padEnd(23);
      const role = (user.role || '').padEnd(10);
      const active = (user.isActive ? 'Yes' : 'No').padEnd(6);
      const created = user.createdAt ? new Date(user.createdAt).toLocaleDateString() : 'N/A';
      
      console.log(`${email} | ${name} | ${role} | ${active} | ${created}`);
    });

    console.log('─'.repeat(100));

    // Summary by role
    console.log('\n📈 Summary by Role:');
    const roleCount = {};
    users.forEach(user => {
      roleCount[user.role] = (roleCount[user.role] || 0) + 1;
    });

    Object.entries(roleCount).forEach(([role, count]) => {
      console.log(`   ${role}: ${count}`);
    });

    // Disconnect
    await mongoose.disconnect();
    console.log('\n✅ List complete!\n');
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

// Run list
listAllUsers();
