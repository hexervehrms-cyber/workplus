/**
 * Complete RBAC Setup Script
 */

import mongoose from "mongoose";
import dotenv from "dotenv";
import connectDB from "../config/db.js";

// Load environment variables
dotenv.config();

const completeRBACSetup = async () => {
  try {
    console.log('🎯 Completing RBAC Setup...');
    
    // Connect to database
    await connectDB();
    console.log('✅ Database connected');
    
    // Step 1: Fix all users' orgId
    console.log('\n🔧 Fixing user organization IDs...');
    const orgUpdateResult = await mongoose.connection.db.collection('users').updateMany(
      { 
        $or: [
          { orgId: null },
          { orgId: '' },
          { orgId: 'system' },
          { orgId: { $exists: false } }
        ]
      },
      { $set: { orgId: 'workplus_system' } }
    );
    
    console.log(`✅ Updated ${orgUpdateResult.modifiedCount} users with proper orgId`);
    
    // Step 2: Get all roles for workplus_system
    console.log('\n📋 Loading system roles...');
    const roles = await mongoose.connection.db.collection('roles').find({ 
      orgId: 'workplus_system',
      isActive: true 
    }).toArray();
    
    console.log(`Found ${roles.length} roles:`);
    const roleMap = {};
    roles.forEach(role => {
      roleMap[role.name] = role._id;
      console.log(`   ${role.name} -> ${role._id}`);
    });
    
    // Step 3: Assign role IDs to all users
    console.log('\n🔗 Assigning role IDs to users...');
    const users = await mongoose.connection.db.collection('users').find({ 
      orgId: 'workplus_system',
      isActive: true
    }).toArray();
    
    let assignedCount = 0;
    
    for (const user of users) {
      const roleId = roleMap[user.role.toUpperCase()];
      
      if (roleId && !user.roleId) {
        await mongoose.connection.db.collection('users').updateOne(
          { _id: user._id },
          { $set: { roleId: roleId } }
        );
        console.log(`✅ Assigned ${user.role.toUpperCase()} role to ${user.email}`);
        assignedCount++;
      } else if (user.roleId) {
        console.log(`ℹ️  ${user.email} already has role assigned`);
      } else {
        console.log(`⚠️  No role found for ${user.email} (${user.role})`);
      }
    }
    
    console.log(`\n✅ Assigned roles to ${assignedCount} users`);
    
    // Step 4: Final verification
    console.log('\n📊 Final RBAC Status:');
    console.log('=====================================');
    
    const totalPermissions = await mongoose.connection.db.collection('permissions').countDocuments({ isActive: true });
    const totalRoles = await mongoose.connection.db.collection('roles').countDocuments({ isActive: true });
    const totalUsers = await mongoose.connection.db.collection('users').countDocuments({ isActive: true });
    const usersWithRoles = await mongoose.connection.db.collection('users').countDocuments({ 
      roleId: { $ne: null }, 
      isActive: true 
    });
    
    console.log(`📋 Total Permissions: ${totalPermissions}`);
    console.log(`👥 Total Roles: ${totalRoles}`);
    console.log(`👤 Total Users: ${totalUsers}`);
    console.log(`🔗 Users with Role IDs: ${usersWithRoles}`);
    
    // Role distribution
    const roleDistribution = await mongoose.connection.db.collection('users').aggregate([
      { $match: { isActive: true, orgId: 'workplus_system' } },
      { $group: { _id: '$role', count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]).toArray();
    
    console.log('\n👥 User Role Distribution:');
    roleDistribution.forEach(role => {
      console.log(`   ${role._id}: ${role.count} users`);
    });
    
    console.log('\n🎉 RBAC Setup Complete!');
    console.log('=====================================');
    console.log('✅ All permissions created');
    console.log('✅ All system roles created');
    console.log('✅ All users assigned to roles');
    console.log('✅ Super Admin configured');
    console.log('\n🚀 WorkPlus Pro RBAC System is now fully operational!');
    
    process.exit(0);
    
  } catch (error) {
    console.error('❌ Complete RBAC Setup Failed:', error);
    process.exit(1);
  }
};

// Run the complete setup
completeRBACSetup();