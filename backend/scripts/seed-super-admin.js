/**
 * Standalone Super Admin Seeding Script
 * Run this script to manually seed/fix Super Admin account
 * 
 * Usage: node scripts/seed-super-admin.js
 */

import dotenv from 'dotenv';
import mongoose from 'mongoose';
import bcrypt from 'bcrypt';

// Load environment variables
dotenv.config();

// Import User model
import User from '../models/User.js';

const SUPER_ADMIN_EMAIL = process.env.SUPER_ADMIN_EMAIL || 'admin@workpluspro.com';
const SUPER_ADMIN_PASSWORD = process.env.SUPER_ADMIN_PASSWORD || 'Jadu@123';
const SUPER_ADMIN_NAME = process.env.SUPER_ADMIN_NAME || 'Super Admin';

console.log('\n🔐 SUPER ADMIN SEEDING SCRIPT');
console.log('='.repeat(60));
console.log('Environment:', process.env.NODE_ENV || 'development');
console.log('Database:', process.env.MONGODB_URI.replace(/\/\/([^:]+):([^@]+)@/, '//$1:****@'));
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
    
    console.log('✅ MongoDB connected successfully');
    console.log('   Database:', mongoose.connection.db.databaseName);
    console.log('   Host:', mongoose.connection.host);
    
    return true;
  } catch (error) {
    console.error('❌ MongoDB connection failed:', error.message);
    console.error('   Full error:', error);
    return false;
  }
}

/**
 * Seed Super Admin
 */
async function seedSuperAdmin() {
  try {
    console.log('\n🔍 Checking for existing Super Admin...');
    console.log('   Email:', SUPER_ADMIN_EMAIL);
    
    // Check if super admin exists (include password field)
    let superAdmin = await User.findOne({ 
      email: SUPER_ADMIN_EMAIL.toLowerCase() 
    }).select('+password');

    if (superAdmin) {
      console.log('✅ Super Admin found in database');
      console.log('   ID:', superAdmin._id);
      console.log('   Name:', superAdmin.name);
      console.log('   Role:', superAdmin.role);
      console.log('   Active:', superAdmin.isActive);
      console.log('   Created:', superAdmin.createdAt);
      
      let needsUpdate = false;
      const updates = [];
      
      // Check role
      if (superAdmin.role !== 'super_admin') {
        superAdmin.role = 'super_admin';
        needsUpdate = true;
        updates.push('role → super_admin');
      }
      
      // Check name
      if (superAdmin.name !== SUPER_ADMIN_NAME) {
        superAdmin.name = SUPER_ADMIN_NAME;
        needsUpdate = true;
        updates.push(`name → ${SUPER_ADMIN_NAME}`);
      }
      
      // Check active status
      if (superAdmin.isActive !== true) {
        superAdmin.isActive = true;
        needsUpdate = true;
        updates.push('isActive → true');
      }
      
      // Check password
      console.log('\n🔑 Verifying password...');
      if (superAdmin.password) {
        const isPasswordCorrect = await bcrypt.compare(SUPER_ADMIN_PASSWORD, superAdmin.password);
        if (!isPasswordCorrect) {
          console.log('⚠️  Password mismatch detected - updating password');
          superAdmin.password = await bcrypt.hash(SUPER_ADMIN_PASSWORD, 12);
          needsUpdate = true;
          updates.push('password → updated');
        } else {
          console.log('✅ Password is correct');
        }
      } else {
        console.log('⚠️  No password set - setting password');
        superAdmin.password = await bcrypt.hash(SUPER_ADMIN_PASSWORD, 12);
        needsUpdate = true;
        updates.push('password → set');
      }
      
      if (needsUpdate) {
        console.log('\n📝 Updating Super Admin...');
        updates.forEach(update => console.log('   -', update));
        
        await superAdmin.save();
        
        console.log('✅ Super Admin updated successfully');
      } else {
        console.log('\n✅ Super Admin is already correctly configured');
      }
    } else {
      console.log('⚠️  Super Admin not found - creating new account');
      
      // Hash password
      console.log('\n🔑 Hashing password...');
      const hashedPassword = await bcrypt.hash(SUPER_ADMIN_PASSWORD, 12);
      console.log('✅ Password hashed');
      
      // Create super admin
      console.log('\n📝 Creating Super Admin...');
      superAdmin = await User.create({
        name: SUPER_ADMIN_NAME,
        email: SUPER_ADMIN_EMAIL.toLowerCase(),
        password: hashedPassword,
        role: 'super_admin',
        organization: 'WorkPlus Inc.',
        isActive: true,
        orgId: 'system'
      });

      console.log('✅ Super Admin created successfully');
      console.log('   ID:', superAdmin._id);
      console.log('   Name:', superAdmin.name);
      console.log('   Email:', superAdmin.email);
      console.log('   Role:', superAdmin.role);
    }

    // Verify login credentials
    console.log('\n🔐 Verifying login credentials...');
    const verifyUser = await User.findOne({ 
      email: SUPER_ADMIN_EMAIL.toLowerCase() 
    }).select('+password');
    
    if (!verifyUser) {
      console.error('❌ Verification failed: User not found after seeding');
      return false;
    }
    
    if (!verifyUser.password) {
      console.error('❌ Verification failed: No password set');
      return false;
    }
    
    const canLogin = await bcrypt.compare(SUPER_ADMIN_PASSWORD, verifyUser.password);
    if (!canLogin) {
      console.error('❌ Verification failed: Password does not match');
      return false;
    }
    
    console.log('✅ Login credentials verified successfully');
    
    // Display credentials
    console.log('\n' + '='.repeat(60));
    console.log('✅ SUPER ADMIN READY');
    console.log('='.repeat(60));
    console.log('\n📋 CREDENTIALS:');
    console.log('   Email:', SUPER_ADMIN_EMAIL);
    console.log('   Password:', SUPER_ADMIN_PASSWORD);
    console.log('   Role: super_admin');
    console.log('\n🚀 LOGIN INSTRUCTIONS:');
    console.log('   1. Go to: https://workplus-qbshegha8-hexervehrms-8667s-projects.vercel.app/login');
    console.log('   2. Enter email:', SUPER_ADMIN_EMAIL);
    console.log('   3. Enter password:', SUPER_ADMIN_PASSWORD);
    console.log('   4. Click "Sign In"');
    console.log('   5. You will be redirected to Super Admin Dashboard');
    console.log('\n💡 API ENDPOINT:');
    console.log('   POST https://workplus-backend-sg3a.onrender.com/api/auth/login');
    console.log('   Body: { "email": "' + SUPER_ADMIN_EMAIL + '", "password": "' + SUPER_ADMIN_PASSWORD + '" }');
    
    return true;
  } catch (error) {
    console.error('\n❌ Seeding failed:', error.message);
    console.error('   Stack:', error.stack);
    return false;
  }
}

/**
 * Main function
 */
async function main() {
  try {
    // Connect to database
    const connected = await connectDB();
    if (!connected) {
      console.log('\n❌ Cannot seed without database connection');
      process.exit(1);
    }
    
    // Seed super admin
    const seeded = await seedSuperAdmin();
    if (!seeded) {
      console.log('\n❌ Seeding failed');
      process.exit(1);
    }
    
    console.log('\n✅ Seeding completed successfully');
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Script error:', error.message);
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

// Run main function
main();
