/**
 * Seed Super Admin User Immediately
 * Run this script to create the super admin user in the database
 */

import mongoose from 'mongoose';
import bcrypt from 'bcrypt';
import dotenv from 'dotenv';
import User from '../models/User.js';

dotenv.config({ path: '../.env' });

async function seedAdmin() {
  try {
    console.log('🔄 Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    const email = process.env.SUPER_ADMIN_EMAIL || 'atul@hexerve.com';
    const password = process.env.SUPER_ADMIN_PASSWORD || 'Jadu@123';
    const name = process.env.SUPER_ADMIN_NAME || 'Atul';

    console.log(`\n📝 Creating super admin with:`);
    console.log(`   Email: ${email}`);
    console.log(`   Name: ${name}`);
    console.log(`   Password: ${password}`);

    // Check if already exists
    const existing = await User.findOne({ email: email.toLowerCase() });
    if (existing) {
      console.log(`\n⚠️  User already exists with email: ${email}`);
      console.log(`   ID: ${existing._id}`);
      console.log(`   Role: ${existing.role}`);
      console.log(`   Active: ${existing.isActive}`);
      
      // Update to super_admin if not already
      if (existing.role !== 'super_admin') {
        await User.findByIdAndUpdate(existing._id, { role: 'super_admin' });
        console.log(`   ✅ Updated role to super_admin`);
      }
      
      process.exit(0);
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 12);

    // Create user
    const user = await User.create({
      name,
      email: email.toLowerCase(),
      password: hashedPassword,
      role: 'super_admin',
      organization: 'WorkPlus Inc.',
      orgId: 'system',
      isActive: true,
      emailVerified: true,
      createdAt: new Date(),
      updatedAt: new Date()
    });

    console.log(`\n✅ Super Admin created successfully!`);
    console.log(`   ID: ${user._id}`);
    console.log(`   Email: ${user.email}`);
    console.log(`   Name: ${user.name}`);
    console.log(`   Role: ${user.role}`);
    console.log(`\n🎉 You can now login with:`);
    console.log(`   Email: ${email}`);
    console.log(`   Password: ${password}`);

    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

seedAdmin();
