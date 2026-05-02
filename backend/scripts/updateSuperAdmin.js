/**
 * Update Super Admin Script - Direct MongoDB Update
 */

import mongoose from "mongoose";
import dotenv from "dotenv";
import connectDB from "../config/db.js";

// Load environment variables
dotenv.config();

const updateSuperAdmin = async () => {
  try {
    console.log('🔧 Updating Super Admin...');
    
    // Connect to database
    await connectDB();
    console.log('✅ Database connected');
    
    const superAdminEmail = process.env.SUPER_ADMIN_EMAIL || 'admin@workpluspro.com';
    
    // Direct MongoDB update to avoid middleware issues
    const result = await mongoose.connection.db.collection('users').updateOne(
      { email: superAdminEmail },
      { 
        $set: { 
          orgId: 'workplus_system',
          role: 'super_admin',
          isActive: true
        }
      }
    );
    
    if (result.matchedCount === 0) {
      console.log('❌ Super Admin not found');
      process.exit(1);
    }
    
    console.log('✅ Super Admin updated successfully');
    console.log(`   Matched: ${result.matchedCount}`);
    console.log(`   Modified: ${result.modifiedCount}`);
    
    // Verify the update
    const updatedUser = await mongoose.connection.db.collection('users').findOne(
      { email: superAdminEmail }
    );
    
    console.log('\n📋 Updated Super Admin Details:');
    console.log(`   Email: ${updatedUser.email}`);
    console.log(`   Role: ${updatedUser.role}`);
    console.log(`   OrgId: ${updatedUser.orgId}`);
    console.log(`   Active: ${updatedUser.isActive}`);
    
    process.exit(0);
    
  } catch (error) {
    console.error('❌ Update Super Admin Failed:', error);
    process.exit(1);
  }
};

// Run the update
updateSuperAdmin();