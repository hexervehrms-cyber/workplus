/**
 * RBAC Initialization Script
 * Initializes roles, permissions, and system data for WorkPlus Pro
 */

import mongoose from "mongoose";
import dotenv from "dotenv";
import Role from "../models/Role.js";
import Permission from "../models/Permission.js";
import User from "../models/User.js";
import connectDB from "../config/db.js";

// Load environment variables
dotenv.config();

const initializeRBAC = async () => {
  try {
    console.log('🚀 Starting RBAC Initialization...');
    
    // Connect to database
    await connectDB();
    console.log('✅ Database connected');
    
    // Step 1: Initialize System Permissions
    console.log('\n📋 Initializing System Permissions...');
    const permissions = await Permission.createSystemPermissions();
    console.log(`✅ Created/Updated ${permissions.length} system permissions`);
    
    // Step 2: Initialize System Roles for each organization
    console.log('\n👥 Initializing System Roles...');
    
    // Get all organizations (unique orgIds from users)
    const organizations = await User.distinct('orgId');
    console.log(`Found ${organizations.length} organizations: ${organizations.join(', ')}`);
    
    let totalRolesCreated = 0;
    
    for (const orgId of organizations) {
      console.log(`\n🏢 Processing organization: ${orgId}`);
      
      // Find a super admin or admin user to use as creator
      const adminUser = await User.findOne({ 
        orgId, 
        role: { $in: ['super_admin', 'admin'] },
        isActive: true
      });
      
      if (!adminUser) {
        console.log(`⚠️  No admin user found for organization ${orgId}, skipping...`);
        continue;
      }
      
      const roles = await Role.createSystemRoles(orgId, adminUser._id);
      console.log(`✅ Created/Updated ${roles.length} system roles for ${orgId}`);
      totalRolesCreated += roles.length;
      
      // Step 3: Assign roleId to existing users
      console.log(`🔗 Assigning role IDs to users in ${orgId}...`);
      
      const users = await User.find({ orgId, isActive: true });
      let usersUpdated = 0;
      
      for (const user of users) {
        const roleName = user.role.toUpperCase();
        const role = roles.find(r => r.name === roleName);
        
        if (role && !user.roleId) {
          user.roleId = role._id;
          await user.save();
          usersUpdated++;
        }
      }
      
      console.log(`✅ Updated ${usersUpdated} users with role IDs in ${orgId}`);
    }
    
    console.log(`\n✅ Total system roles created/updated: ${totalRolesCreated}`);
    
    // Step 4: Verify Super Admin Setup
    console.log('\n🔐 Verifying Super Admin Setup...');
    
    const superAdminEmail = process.env.SUPER_ADMIN_EMAIL || 'admin@workpluspro.com';
    const superAdmin = await User.findOne({ email: superAdminEmail });
    
    if (superAdmin) {
      const superAdminRole = await Role.findOne({ 
        name: 'SUPER_ADMIN', 
        orgId: superAdmin.orgId 
      });
      
      if (superAdminRole && !superAdmin.roleId) {
        superAdmin.roleId = superAdminRole._id;
        await superAdmin.save();
        console.log('✅ Super Admin role ID assigned');
      }
      
      console.log(`✅ Super Admin verified: ${superAdmin.email}`);
    } else {
      console.log('⚠️  Super Admin not found - please ensure super admin is created first');
    }
    
    // Step 5: Generate Summary Report
    console.log('\n📊 RBAC Initialization Summary:');
    console.log('=====================================');
    
    const totalPermissions = await Permission.countDocuments({ isActive: true });
    const totalRoles = await Role.countDocuments({ isActive: true });
    const totalUsers = await User.countDocuments({ isActive: true });
    const usersWithRoles = await User.countDocuments({ roleId: { $ne: null }, isActive: true });
    
    console.log(`📋 Total Permissions: ${totalPermissions}`);
    console.log(`👥 Total Roles: ${totalRoles}`);
    console.log(`👤 Total Users: ${totalUsers}`);
    console.log(`🔗 Users with Role IDs: ${usersWithRoles}`);
    
    // Permission breakdown by category
    const permissionsByCategory = await Permission.aggregate([
      { $match: { isActive: true } },
      { $group: { _id: '$category', count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]);
    
    console.log('\n📋 Permissions by Category:');
    permissionsByCategory.forEach(cat => {
      console.log(`   ${cat._id}: ${cat.count}`);
    });
    
    // Role breakdown by organization
    const rolesByOrg = await Role.aggregate([
      { $match: { isActive: true } },
      { $group: { _id: '$orgId', count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]);
    
    console.log('\n👥 Roles by Organization:');
    rolesByOrg.forEach(org => {
      console.log(`   ${org._id}: ${org.count}`);
    });
    
    console.log('\n🎉 RBAC Initialization Complete!');
    console.log('=====================================');
    
    process.exit(0);
    
  } catch (error) {
    console.error('❌ RBAC Initialization Failed:', error);
    console.error(error.stack);
    process.exit(1);
  }
};

// Run the initialization
initializeRBAC();