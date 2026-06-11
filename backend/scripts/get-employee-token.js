/**
 * Script to get a valid employee token for testing
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import User from '../models/User.js';
import jwt from 'jsonwebtoken';

dotenv.config({ path: './.env' });

const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/workplus');
    console.log('✓ Connected to MongoDB');
  } catch (error) {
    console.error('✗ MongoDB connection failed:', error.message);
    process.exit(1);
  }
};

const getEmployeeToken = async () => {
  try {
    console.log('\n📋 Getting employee token...\n');

    // Find an employee user
    const employee = await User.findOne({ role: 'employee' }).lean();

    if (!employee) {
      console.log('⚠ No employee found');
      return;
    }

    console.log(`Found employee: ${employee.name} (${employee.email})`);
    console.log(`Employee ID: ${employee._id}`);
    console.log(`Role: ${employee.role}`);
    console.log(`Org ID: ${employee.orgId}\n`);

    // Generate token
    const token = jwt.sign(
      {
        userId: employee._id.toString(),
        orgId: employee.orgId,
        role: employee.role
      },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );

    // Validate JWT_SECRET exists
    if (!process.env.JWT_SECRET) {
      console.error('❌ ERROR: JWT_SECRET not set in environment');
      console.error('   Set JWT_SECRET in .env file');
      process.exit(1);
    }

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

connectDB().then(() => getEmployeeToken());
