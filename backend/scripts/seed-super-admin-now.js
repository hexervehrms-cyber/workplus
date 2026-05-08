#!/usr/bin/env node

/**
 * Super Admin Seeder Script
 * Creates super admin user in MongoDB
 * 
 * Usage: node backend/scripts/seed-super-admin-now.js
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

const seedSuperAdmin = async () => {
  try {
    console.log('\n🚀 Starting Super Admin Seeding...\n');

    // Validate environment variables
    const mongoUri = process.env.MONGODB_URI;
    const superAdminEmail = process.env.SUPER_ADMIN_EMAIL;
    const superAdminPassword = process.env.SUPER_ADMIN_PASSWORD;
    const superAdminName = process.env.SUPER_ADMIN_NAME;

    console.log('📋 Environment Variables Check:');
    console.log(`   MONGODB_URI: ${mongoUri ? '✅ Set' : '❌ Missing'}`);
    console.log(`   SUPER_ADMIN_EMAIL: ${superAdminEmail ? '✅ Set (' + superAdminEmail + ')' : '❌ Missing'}`);
    console.log(`   SUPER_ADMIN_PASSWORD: ${superAdminPassword ? '✅ Set' : '❌ Missing'}`);
    console.log(`   SUPER_ADMIN_NAME: ${superAdminName ? '✅ Set (' + superAdminName + ')' : '❌ Missing'}`);

    if (!mongoUri || !superAdminEmail || !superAdminPassword || !superAdminName) {
      console.error('\n❌ Missing required environment variables!');
      process.exit(1);
    }

    // Connect to MongoDB
    console.log('\n🔗 Connecting to MongoDB...');
    await mongoose.connect(mongoUri, {
      serverSelectionTimeoutMS: 10000,
      socketTimeoutMS: 45000,
    });
    console.log('✅ Connected to MongoDB\n');

    // Check if super admin already exists
    console.log('🔍 Checking if super admin already exists...');
    const existingSuperAdmin = await User.findOne({ 
      email: superAdminEmail.toLowerCase(),
      role: 'super_admin'
    });

    if (existingSuperAdmin) {
      console.log('ℹ️  Super Admin already exists:');
      console.log(`   ID: ${existingSuperAdmin._id}`);
      console.log(`   Email: ${existingSuperAdmin.email}`);
      console.log(`   Name: ${existingSuperAdmin.name}`);
      console.log(`   Role: ${existingSuperAdmin.role}`);
      console.log(`   Active: ${existingSuperAdmin.isActive}`);
      
      // Disconnect and exit
      await mongoose.disconnect();
      console.log('\n✅ Seeding complete!\n');
      process.exit(0);
    }

    // Hash password
    console.log('🔐 Hashing password...');
    const hashedPassword = await bcrypt.hash(superAdminPassword, 12);

    // Create super admin user
    console.log('👤 Creating super admin user...');
    const superAdmin = await User.create({
      name: superAdminName,
      email: superAdminEmail.toLowerCase(),
      password: hashedPassword,
      role: 'super_admin',
      organization: 'WorkPlus Inc.',
      orgId: 'system',
      isActive: true,
      emailVerified: true,
      createdAt: new Date(),
      updatedAt: new Date()
    });

    console.log('\n✅ Super Admin Created Successfully!\n');
    console.log('📊 Super Admin Details:');
    console.log(`   ID: ${superAdmin._id}`);
    console.log(`   Email: ${superAdmin.email}`);
    console.log(`   Name: ${superAdmin.name}`);
    console.log(`   Role: ${superAdmin.role}`);
    console.log(`   Organization: ${superAdmin.organization}`);
    console.log(`   Active: ${superAdmin.isActive}`);
    console.log(`   Email Verified: ${superAdmin.emailVerified}`);

    // Disconnect from MongoDB
    await mongoose.disconnect();
    console.log('\n✅ Seeding complete!\n');
    process.exit(0);

  } catch (error) {
    console.error('\n❌ Error during seeding:');
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

// Run seeder
seedSuperAdmin();
