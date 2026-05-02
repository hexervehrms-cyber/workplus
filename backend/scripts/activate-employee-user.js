/**
 * Activate Employee User Account
 * This script activates the employee user account so they can login and use the system
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import User from '../models/User.js';
import logger from '../utils/logger.js';

dotenv.config();

async function activateEmployeeUser() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/workpluspro');
    logger.info('Connected to MongoDB');

    // Find and activate the employee user
    const result = await User.findOneAndUpdate(
      { email: 'employee@company.com' },
      { isActive: true },
      { new: true }
    );

    if (result) {
      logger.info('✅ Employee user activated successfully', {
        email: result.email,
        name: result.name,
        isActive: result.isActive
      });
      console.log('✅ Employee user activated:', result.email);
    } else {
      logger.warn('Employee user not found');
      console.log('❌ Employee user not found');
    }

    // Also activate harsh.gupta user if it exists
    const result2 = await User.findOneAndUpdate(
      { email: 'harsh.gupta@hexerve.com' },
      { isActive: true },
      { new: true }
    );

    if (result2) {
      logger.info('✅ Harsh Gupta user activated successfully', {
        email: result2.email,
        name: result2.name,
        isActive: result2.isActive
      });
      console.log('✅ Harsh Gupta user activated:', result2.email);
    }

    process.exit(0);
  } catch (error) {
    logger.error('Error activating employee user', { error: error.message });
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

activateEmployeeUser();
