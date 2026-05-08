/**
 * Script to check leave request data
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import LeaveRequest from '../models/LeaveRequest.js';

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

const checkLeaveRequests = async () => {
  try {
    console.log('\n📋 Checking leave requests...\n');

    const leaveRequests = await LeaveRequest.find({}).lean();
    
    leaveRequests.forEach((leave, index) => {
      console.log(`\nLeave Request ${index + 1}:`);
      console.log(`  ID: ${leave._id}`);
      console.log(`  userId: ${leave.userId || 'NULL'}`);
      console.log(`  employeeId: ${leave.employeeId || 'NULL'}`);
      console.log(`  employeeName: ${leave.employeeName || 'NULL'}`);
      console.log(`  leaveType: ${leave.leaveType || leave.type || 'NULL'}`);
      console.log(`  startDate: ${leave.startDate}`);
      console.log(`  endDate: ${leave.endDate}`);
      console.log(`  status: ${leave.status}`);
      console.log(`  reason: ${leave.reason}`);
    });

  } catch (error) {
    console.error('✗ Error:', error.message);
  } finally {
    await mongoose.connection.close();
    console.log('\n✓ Database connection closed\n');
  }
};

connectDB().then(() => checkLeaveRequests());
