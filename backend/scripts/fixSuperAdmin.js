/**
 * Fix Super Admin Setup Script
 */

import mongoose from "mongoose";
import dotenv from "dotenv";
import User from "../models/User.js";
import connectDB from "../config/db.js";

// Load environment variables
dotenv.config();

const fixSuperAdmin = async () => {
  try {
    console.log('🔧 Fixing Super Admin Setup...');
    
    // Connect to database
    await connectDB();
    console.log('✅ Database connected');
    
    const superAdminEmail = process.env.SUPER_ADMIN_EMAIL || 'admin@workpluspro.com';
    
    // Find Super Admin
    const superAdmin = await User.findOne({ email: superAdminEmail });
    
    if (!superAdmin) {
      console.log('❌ Super Admin not found');
      process.exit(1);
    }
    
    console.log('📋 Current Super Admin Details:');
    console.log(`   Email: ${superAdmin.email}`);
    console.log(`   Role: ${superAdmin.role}`);
    console.log(`   OrgId: ${superAdmin.orgId || 'null'}`);
    console.log(`   Active: ${superAdmin.isActive}`);
    
    // Fix orgId if null or empty
    if (!superAdmin.orgId || superAdmin.orgId === '' || superAdmin.orgId === 'null') {
      superAdmin.orgId = 'workplus_system';
      console.log('🔧 Setting orgId to: workplus_system');
    }
    
    // Ensure role is correct
    if (superAdmin.role !== 'super_admin') {
      superAdmin.role = 'super_admin';
      console.log('🔧 Setting role to: super_admin');
    }
    
    // Ensure account is active
    if (!superAdmin.isActive) {
      superAdmin.isActive = true;
      console.log('🔧 Activating account');
    }
    
    await superAdmin.save();
    
    console.log('\n✅ Super Admin Updated Successfully:');
    console.log(`   Email: ${superAdmin.email}`);
    console.log(`   Role: ${superAdmin.role}`);
    console.log(`   OrgId: ${superAdmin.orgId}`);
    console.log(`   Active: ${superAdmin.isActive}`);
    
    process.exit(0);
    
  } catch (error) {
    console.error('❌ Fix Super Admin Failed:', error);
    process.exit(1);
  }
};

// Run the fix
fixSuperAdmin();