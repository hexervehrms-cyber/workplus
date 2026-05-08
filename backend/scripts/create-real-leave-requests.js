/**
 * Script to create leave requests using ONLY real employees with valid user references
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

const createRealLeaveRequests = async () => {
  try {
    console.log('\n📋 Deleting old leave requests...\n');
    
    // Delete all existing leave requests
    const deleteResult = await LeaveRequest.deleteMany({});
    console.log(`✓ Deleted ${deleteResult.deletedCount} old leave requests\n`);

    console.log('📋 Creating leave requests with REAL employees...\n');

    // Get only employees with valid user references
    const employees = await Employee.find({ 
      status: 'active',
      userId: { $exists: true, $ne: null }
    })
      .populate('userId', 'name email')
      .lean();

    if (employees.length === 0) {
      console.log('⚠ No active employees with user references found.');
      return;
    }

    console.log(`Found ${employees.length} real employees with user references\n`);

    let created = 0;
    const leaveTypes = ['Vacation', 'Sick Leave', 'Personal', 'Casual'];
    const statuses = ['pending', 'approved', 'rejected'];

    for (let i = 0; i < employees.length; i++) {
      const employee = employees[i];
      
      if (!employee.userId) {
        console.log(`⚠ Skipping ${employee.employeeCode} - no user reference`);
        continue;
      }

      // Create 2-3 leave requests per employee with different statuses
      for (let j = 0; j < 3; j++) {
        const leaveType = leaveTypes[j % leaveTypes.length];
        const status = statuses[j % statuses.length];
        
        // Vary dates for each leave request
        const startDate = new Date(2026, 4, 10 + (j * 5)); // May 10, 15, 20
        const endDate = new Date(2026, 4, 12 + (j * 5));   // May 12, 17, 22

        const leaveRequest = await LeaveRequest.create({
          userId: employee.userId._id,
          employeeId: employee._id,
          employeeName: employee.userId.name,
          type: leaveType,
          leaveType: leaveType,
          startDate: startDate,
          endDate: endDate,
          reason: `${leaveType} leave request - ${j + 1}`,
          status: status,
          approvedBy: status === 'approved' ? new mongoose.Types.ObjectId() : undefined,
          approvedDate: status === 'approved' ? new Date() : undefined,
          rejectedBy: status === 'rejected' ? new mongoose.Types.ObjectId() : undefined,
          rejectedDate: status === 'rejected' ? new Date() : undefined,
          rejectionReason: status === 'rejected' ? 'Insufficient leave balance' : undefined,
          orgId: employee.orgId || 'default'
        });

        console.log(`✓ Created ${status} ${leaveType} for ${employee.userId.name}`);
        created++;
      }
    }

    console.log(`\n✓ Successfully created ${created} leave requests with REAL employee data\n`);

  } catch (error) {
    console.error('✗ Error:', error.message);
    console.error(error);
  } finally {
    await mongoose.connection.close();
    console.log('✓ Database connection closed\n');
  }
};

connectDB().then(() => createRealLeaveRequests());
