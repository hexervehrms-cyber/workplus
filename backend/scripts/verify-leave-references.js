/**
 * Script to verify if User and Employee references exist
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import LeaveRequest from '../models/LeaveRequest.js';
import User from '../models/User.js';
import Employee from '../models/Employee.js';

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

const verifyReferences = async () => {
  try {
    console.log('\n📋 Verifying leave request references...\n');

    const leaveRequests = await LeaveRequest.find({}).lean();
    
    for (const leave of leaveRequests) {
      console.log(`\nLeave Request: ${leave.employeeName}`);
      console.log(`  userId: ${leave.userId}`);
      console.log(`  employeeId: ${leave.employeeId}`);

      if (leave.userId) {
        const user = await User.findById(leave.userId).lean();
        if (user) {
          console.log(`  ✓ User found: ${user.name} (${user.email})`);
        } else {
          console.log(`  ✗ User NOT found`);
        }
      }

      if (leave.employeeId) {
        const employee = await Employee.findById(leave.employeeId).lean();
        if (employee) {
          console.log(`  ✓ Employee found: ${employee.employeeCode} (${employee.designation})`);
        } else {
          console.log(`  ✗ Employee NOT found`);
        }
      }
    }

  } catch (error) {
    console.error('✗ Error:', error.message);
  } finally {
    await mongoose.connection.close();
    console.log('\n✓ Database connection closed\n');
  }
};

connectDB().then(() => verifyReferences());
