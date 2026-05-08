/**
 * Script to fix leave requests by populating userId and employeeId references
 * This script finds leave requests with missing references and updates them
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

const fixLeaveRequests = async () => {
  try {
    console.log('\n📋 Starting leave request fix...\n');

    // Get all leave requests
    const leaveRequests = await LeaveRequest.find({});
    console.log(`Found ${leaveRequests.length} leave requests\n`);

    let fixed = 0;
    let failed = 0;

    for (const leave of leaveRequests) {
      try {
        let needsUpdate = false;
        const updateData = {};

        // If userId is missing, try to find it from employeeId
        if (!leave.userId && leave.employeeId) {
          const employee = await Employee.findById(leave.employeeId);
          if (employee && employee.userId) {
            updateData.userId = employee.userId;
            needsUpdate = true;
            console.log(`✓ Found userId for leave ${leave._id}: ${employee.userId}`);
          }
        }

        // If employeeId is missing, try to find it from userId
        if (!leave.employeeId && leave.userId) {
          const employee = await Employee.findOne({ userId: leave.userId });
          if (employee) {
            updateData.employeeId = employee._id;
            needsUpdate = true;
            console.log(`✓ Found employeeId for leave ${leave._id}: ${employee._id}`);
          }
        }

        // If both are missing, try to find employee by employeeName
        if (!leave.userId && !leave.employeeId && leave.employeeName) {
          const user = await User.findOne({ name: leave.employeeName });
          if (user) {
            const employee = await Employee.findOne({ userId: user._id });
            if (employee) {
              updateData.userId = user._id;
              updateData.employeeId = employee._id;
              needsUpdate = true;
              console.log(`✓ Found both userId and employeeId for leave ${leave._id}`);
            }
          }
        }

        if (needsUpdate) {
          await LeaveRequest.findByIdAndUpdate(leave._id, updateData);
          fixed++;
          console.log(`  Updated leave request ${leave._id}\n`);
        } else {
          console.log(`⚠ Could not fix leave request ${leave._id} - missing references\n`);
          failed++;
        }
      } catch (error) {
        console.error(`✗ Error fixing leave ${leave._id}:`, error.message);
        failed++;
      }
    }

    console.log('\n📊 Summary:');
    console.log(`✓ Fixed: ${fixed}`);
    console.log(`✗ Failed: ${failed}`);
    console.log(`Total: ${leaveRequests.length}\n`);

  } catch (error) {
    console.error('✗ Error:', error.message);
  } finally {
    await mongoose.connection.close();
    console.log('✓ Database connection closed\n');
  }
};

connectDB().then(() => fixLeaveRequests());
