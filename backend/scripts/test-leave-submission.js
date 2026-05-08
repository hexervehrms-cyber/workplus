/**
 * Script to test leave request submission
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import LeaveRequest from '../models/LeaveRequest.js';
import Employee from '../models/Employee.js';
import User from '../models/User.js';

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

const testLeaveSubmission = async () => {
  try {
    console.log('\n📋 Testing leave request submission...\n');

    // Get a real employee with user reference
    const employee = await Employee.findOne({ 
      status: 'active',
      userId: { $exists: true, $ne: null }
    }).populate('userId', 'name email');

    if (!employee || !employee.userId) {
      console.log('⚠ No active employee with user reference found');
      return;
    }

    console.log(`Found employee: ${employee.userId.name}`);
    console.log(`Employee ID: ${employee._id}`);
    console.log(`User ID: ${employee.userId._id}`);
    console.log(`Org ID: ${employee.orgId}\n`);

    // Create a new leave request
    const leaveRequest = await LeaveRequest.create({
      userId: employee.userId._id,
      employeeId: employee._id,
      employeeName: employee.userId.name,
      type: 'Vacation',
      leaveType: 'Vacation',
      startDate: new Date(2026, 4, 25), // May 25, 2026
      endDate: new Date(2026, 4, 27),   // May 27, 2026
      reason: 'Test leave request from script',
      status: 'pending',
      orgId: employee.orgId || 'system'
    });

    console.log('✓ Leave request created successfully');
    console.log(`  ID: ${leaveRequest._id}`);
    console.log(`  Employee: ${leaveRequest.employeeName}`);
    console.log(`  Type: ${leaveRequest.leaveType}`);
    console.log(`  Status: ${leaveRequest.status}`);
    console.log(`  Org ID: ${leaveRequest.orgId}\n`);

    // Verify it can be fetched
    const fetched = await LeaveRequest.findById(leaveRequest._id)
      .populate('userId', 'name email')
      .populate('employeeId', 'employeeCode department');

    console.log('✓ Leave request fetched successfully');
    console.log(`  User Name: ${fetched.userId?.name}`);
    console.log(`  Employee Code: ${fetched.employeeId?.employeeCode}`);
    console.log(`  Department: ${fetched.employeeId?.department}\n`);

  } catch (error) {
    console.error('✗ Error:', error.message);
  } finally {
    await mongoose.connection.close();
    console.log('✓ Database connection closed\n');
  }
};

connectDB().then(() => testLeaveSubmission());
