/**
 * Super Admin Seeder
 * Automatically creates super admin user on server startup if not exists
 */

import bcrypt from 'bcrypt';
import User from '../models/User.js';
import logger from '../utils/logger.js';

export const seedSuperAdmin = async () => {
  try {
    const superAdminEmail = process.env.SUPER_ADMIN_EMAIL;
    const superAdminPassword = process.env.SUPER_ADMIN_PASSWORD;
    const superAdminName = process.env.SUPER_ADMIN_NAME;

    // Validate environment variables
    if (!superAdminEmail || !superAdminPassword || !superAdminName) {
      logger.warn('⚠️  Super Admin environment variables not configured');
      return false;
    }

    // Check if a user with this email already exists (any role)
    const existingUser = await User.findOne({ 
      email: superAdminEmail.toLowerCase().trim()
    });

    if (existingUser) {
      // If the user exists but isn't a super_admin, update them to super_admin
      // This ensures we don't get duplicate key errors
      if (existingUser.role !== 'super_admin') {
        existingUser.role = 'super_admin';
        existingUser.orgId = 'system';
        existingUser.isActive = true;
        await existingUser.save();
        
        logger.info('ℹ️  Existing user promoted to Super Admin', {
          email: superAdminEmail,
          id: existingUser._id
        });
        return true;
      }
      
      logger.info('ℹ️  Super Admin already exists', {
        email: superAdminEmail,
        id: existingUser._id
      });
      return true;
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(superAdminPassword, 12);

    // Create super admin user
    const superAdmin = await User.create({
      name: superAdminName,
      email: superAdminEmail,
      password: hashedPassword,
      role: 'super_admin',
      organization: 'WorkPlus Inc.',
      orgId: 'system',
      isActive: true,
      emailVerified: true,
      createdAt: new Date(),
      updatedAt: new Date()
    });

    logger.info('✅ Super Admin seeded successfully', {
      id: superAdmin._id,
      email: superAdmin.email,
      name: superAdmin.name,
      role: superAdmin.role
    });

    console.log('✅ Super Admin seeded successfully');
    console.log(`   Email: ${superAdmin.email}`);
    console.log(`   Name: ${superAdmin.name}`);
    console.log(`   Role: ${superAdmin.role}`);

    return true;
  } catch (error) {
    logger.error('❌ Super Admin seeding failed', {
      error: error.message,
      stack: error.stack
    });
    console.error('❌ Super Admin seeding failed:', error.message);
    return false;
  }
};

export default seedSuperAdmin;
