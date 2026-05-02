/**
 * Assign Role IDs Script - Direct MongoDB Update
 */

import mongoose from "mongoose";
import dotenv from "dotenv";
import connectDB from "../config/db.js";

// Load environment variables
dotenv.config();

const assignRoleIds = async () => {
  try {
    console.log('🔗 Assigning Role IDs to Users...');
    
    // Connect to database
    await connectDB();
    console.log('✅ Database connected');
    
    // Get all roles
    const roles = await mongoose.connection.db.collection('roles').find({ 
      isActive: true 
    }).toArray();
    
    console.log(`📋 Found ${roles.length} roles`);
    
    // Create role mapping
    const roleMap = {};
    roles.forEach(role => {
      const key = `${role.orgId}:${role.name}`;
      roleMap[key] = role._id;
      console.log(`   ${role.name} (${role.orgId}) -> ${role._id}`);
    });
    
    // Get all users
    const users = await mongoose.connection.db.collection('users').find({ 
      isActive: true,
      deletedAt: null
    }).toArray();
    
    console.log(`\n👤 Found ${users.length} users to update`);
    
    let updatedCount = 0;
    
    for (const user of users) {
      const roleKey = `${user.orgId}:${user.role.toUpperCase()}`;
      const roleId = roleMap[roleKey];
      
      if (roleId && !user.roleId) {
        // Update user with roleId
        const result = await mongoose.connection.db.collection('users').updateOne(
          { _id: user._id },
          { $set: { roleId: roleId } }
        );
        
        if (result.modifiedCount > 0) {
          console.log(`✅ Updated ${user.email} with role ${user.role}`);
          updatedCount++;
        }
      } else if (!roleId) {
        console.log(`⚠️  No role found for ${user.email} (${roleKey})`);
      } else {
        console.log(`ℹ️  ${user.email} already has roleId`);
      }
    }
    
    console.log(`\n✅ Successfully updated ${updatedCount} users with role IDs`);
    
    // Verify the assignments
    const usersWithRoles = await mongoose.connection.db.collection('users').countDocuments({
      roleId: { $ne: null },
      isActive: true
    });
    
    console.log(`📊 Total users with role IDs: ${usersWithRoles}`);
    
    process.exit(0);
    
  } catch (error) {
    console.error('❌ Assign Role IDs Failed:', error);
    process.exit(1);
  }
};

// Run the assignment
assignRoleIds();