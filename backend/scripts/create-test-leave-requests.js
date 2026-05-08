/**
 * Script to create test leave requests with valid references
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

const createTestLeaveRequests = async () => {
  try {
    console.log('\n📋 Creating test leave requests with valid references...\n');

    // Get all active employees with their users
    const employees = await Employee.find({ status: 'active' })
      .populate('userId', 'name email')
      .limit(5);

    if (employees.length === 0) {
      console.log('⚠ No active employees found. Please create employees first.');
      return;
    }

    console.log(`Found ${employees.length} active employees\n`);

    let created = 0;

    for (const employee of employees) {
      if (!employee.userId) {
        console.log(`⚠ Employee ${employee.employeeCode} has no user reference, skipping...`);
        continue;
      }

      // Create a pending leave request
      const pendingLeave = await LeaveRequest.create({
        userId: employee.userId._id,
        employeeId: employee._id,
        employeeName: employee.userId.name,
        type: 'Vacation',
        leaveType: 'Vacation',
        startDate: new Date(2026, 4, 15), // May 15, 2026
        endDate: new Date(2026, 4, 17),   // May 17, 2026
        reason: 'Summer vacation planned',
        status: 'pending',
        orgId: employee.orgId || 'default'
      });

      console.log(`✓ Created pending leave for ${employee.userId.name}`);
      created++;

      // Create an approved leave request
      const approvedLeave = await LeaveRequest.create({
        userId: employee.userId._id,
        employeeId: employee._id,
        employeeName: employee.userId.name,
        type: 'Sick Leave',
        leaveType: 'Sick Leave',
        startDate: new Date(2026, 4, 5),  // May 5, 2026
        endDate: new Date(2026, 4, 6),    // May 6, 2026
        reason: 'Medical appointment',
        status: 'approved',
        approvedBy: new mongoose.Types.ObjectId(), // Mock admin ID
        approvedDate: new Date(),
        orgId: employee.orgId || 'default'
      });

      console.log(`✓ Created approved leave for ${employee.userId.name}`);
      created++;
    }

    console.log(`\n✓ Successfully created ${created} test leave requests\n`);

  } catch (error) {
    console.error('✗ Error:', error.message);
  } finally {
    await mongoose.connection.close();
    console.log('✓ Database connection closed\n');
  }
};

connectDB().then(() => createTestLeaveRequests());
