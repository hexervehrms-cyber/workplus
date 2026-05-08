/**
 * Script to get a valid admin token for testing
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import User from '../models/User.js';
import jwt from 'jsonwebtoken';

dotenv.config({ path: './backend/.env' });

const connectDB = async () => {
  try {
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/workplus';
    await mongoose.connect(mongoUri);
    console.log('✓ Connected to MongoDB');
  } catch (error) {
    console.error('✗ MongoDB connection failed:', error.message);
    process.exit(1);
  }
};

const getAdminToken = async () => {
  try {
    console.log('\n📋 Getting admin token...\n');

    // Find a super admin user
    const admin = await User.findOne({ role: 'super_admin' }).lean();

    if (!admin) {
      console.log('⚠ No super admin found');
      return;
    }

    console.log(`Found admin: ${admin.name} (${admin.email})`);
    console.log(`Admin ID: ${admin._id}`);
    console.log(`Admin Role: ${admin.role}`);
    console.log(`Org ID: ${admin.orgId}\n`);

    // Generate token
    const token = jwt.sign(
      {
        userId: admin._id.toString(),
        orgId: admin.orgId || 'default',
        role: admin.role
      },
      process.env.JWT_SECRET || 'your-secret-key',
      { expiresIn: '24h' }
    );

    console.log('Generated Token:');
    console.log(token);
    console.log('\n');

  } catch (error) {
    console.error('✗ Error:', error.message);
  } finally {
    await mongoose.connection.close();
    console.log('✓ Database connection closed\n');
  }
};

connectDB().then(() => getAdminToken());
