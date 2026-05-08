#!/usr/bin/env node

/**
 * Clean Dummy Employees
 * Removes dummy/test employees and keeps only real employee data
 * 
 * Real employees to keep:
 * - abhishek.rajput@hexerve.com (Abhishek Rajput)
 * - rinky@hexerve.com (Rinky)
 * - harsh.gupta@hexerve.com (Harsh Gupta)
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

// Import models
import User from '../models/User.js';
import Employee from '../models/Employee.js';

const cleanDummyEmployees = async () => {
  try {
    console.log('\n🚀 Cleaning Dummy Employees...\n');

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

    // Real employee emails to keep
    const realEmployeeEmails = [
      'abhishek.rajput@hexerve.com',
      'rinky@hexerve.com',
      'harsh.gupta@hexerve.com'
    ];

    // Dummy employee emails to remove
    const dummyEmployeeEmails = [
      'rajaram@hexerve.com',
      'ajay@hexerve.com',
      'sdf@sdfg.vok',
      'sdfgsd@dfh.dhj',
      'raja@hexerve.com',
      'endpoint-test@example.com',
      'testuser@example.com'
    ];

    console.log('📊 Real Employees to Keep:');
    realEmployeeEmails.forEach(email => {
      console.log(`   ✅ ${email}`);
    });

    console.log('\n📊 Dummy Employees to Remove:');
    dummyEmployeeEmails.forEach(email => {
      console.log(`   ❌ ${email}`);
    });

    console.log('\n🔍 Processing...\n');

    // Find dummy users
    const dummyUsers = await User.find({ email: { $in: dummyEmployeeEmails } });
    console.log(`Found ${dummyUsers.length} dummy users to remove`);

    // Get user IDs
    const dummyUserIds = dummyUsers.map(u => u._id);

    // Remove dummy employees
    if (dummyUserIds.length > 0) {
      const employeeDeleteResult = await Employee.deleteMany({ userId: { $in: dummyUserIds } });
      console.log(`   Deleted ${employeeDeleteResult.deletedCount} employee records`);

      // Remove dummy users
      const userDeleteResult = await User.deleteMany({ _id: { $in: dummyUserIds } });
      console.log(`   Deleted ${userDeleteResult.deletedCount} user records`);
    }

    // Verify real employees still exist
    console.log('\n✅ Verifying Real Employees:\n');
    const realUsers = await User.find({ email: { $in: realEmployeeEmails } });
    
    realUsers.forEach(user => {
      console.log(`   ✅ ${user.email} (${user.name}) - ${user.role}`);
    });

    // Get final count
    const totalEmployees = await User.countDocuments({ role: 'employee' });
    const totalAdmins = await User.countDocuments({ role: 'admin' });
    const totalSuperAdmins = await User.countDocuments({ role: 'super_admin' });

    console.log('\n📈 Final User Count:');
    console.log(`   Employees: ${totalEmployees}`);
    console.log(`   Admins: ${totalAdmins}`);
    console.log(`   Super Admins: ${totalSuperAdmins}`);

    // Disconnect
    await mongoose.disconnect();
    console.log('\n✅ Cleanup complete!\n');
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

// Run cleanup
cleanDummyEmployees();
