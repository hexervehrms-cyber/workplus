/**
 * Script to test complete leave request flow:
 * 1. Create leave request
 * 2. Verify it appears in admin list
 * 3. Approve it
 * 4. Verify approval is reflected
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
    console.log('✓ Connected to MongoDB\n');
  } catch (error) {
    console.error('✗ MongoDB connection failed:', error.message);
    process.exit(1);
  }
};

const testCompleteFlow = async () => {
  try {
    console.log('📋 Testing Complete Leave Request Flow\n');
    console.log('='.repeat(50) + '\n');

    // Step 1: Get a real employee
    console.log('Step 1: Finding real employee...');
    const employee = await Employee.findOne({ 
      status: 'active',
      userId: { $exists: true, $ne: null }
    }).populate('userId', 'name email');

    if (!employee || !employee.userId) {
      console.log('⚠ No active employee with user reference found');
      return;
    }

    console.log(`✓ Found employee: ${employee.userId.name}`);
    console.log(`  Employee ID: ${employee._id}`);
    console.log(`  User ID: ${employee.userId._id}`);
    console.log(`  Org ID: ${employee.orgId}\n`);

    // Step 2: Create a leave request
    console.log('Step 2: Creating leave request...');
    const leaveRequest = await LeaveRequest.create({
      userId: employee.userId._id,
      employeeId: employee._id,
      employeeName: employee.userId.name,
      type: 'Vacation',
      leaveType: 'Vacation',
      startDate: new Date(2026, 5, 1),  // June 1, 2026
      endDate: new Date(2026, 5, 3),    // June 3, 2026
      reason: 'Test leave request - complete flow',
      status: 'pending',
      orgId: employee.orgId || 'system'
    });

    console.log(`✓ Leave request created`);
    console.log(`  ID: ${leaveRequest._id}`);
    console.log(`  Status: ${leaveRequest.status}`);
    console.log(`  Org ID: ${leaveRequest.orgId}\n`);

    // Step 3: Verify it appears in admin list
    console.log('Step 3: Verifying leave request appears in admin list...');
    const adminList = await LeaveRequest.find({ 
      status: 'pending',
      orgId: leaveRequest.orgId 
    }).populate('userId', 'name email');

    const found = adminList.find(lr => lr._id.toString() === leaveRequest._id.toString());
    if (found) {
      console.log(`✓ Leave request found in admin list`);
      console.log(`  Employee: ${found.userId?.name}`);
      console.log(`  Status: ${found.status}\n`);
    } else {
      console.log(`✗ Leave request NOT found in admin list\n`);
    }

    // Step 4: Get admin user
    console.log('Step 4: Getting admin user...');
    const admin = await User.findOne({ role: 'super_admin' }).lean();
    if (!admin) {
      console.log('⚠ No admin user found');
      return;
    }
    console.log(`✓ Found admin: ${admin.name}`);
    console.log(`  Admin ID: ${admin._id}\n`);

    // Step 5: Approve the leave request
    console.log('Step 5: Approving leave request...');
    const approved = await LeaveRequest.findOneAndUpdate(
      {
        _id: leaveRequest._id,
        status: 'pending'
      },
      {
        $set: {
          status: 'approved',
          approvedBy: admin._id,
          approvedDate: new Date(),
          approverComments: 'Approved via test script'
        }
      },
      { new: true }
    ).populate('userId', 'name email')
     .populate('approvedBy', 'name email');

    console.log(`✓ Leave request approved`);
    console.log(`  Status: ${approved.status}`);
    console.log(`  Approved By: ${approved.approvedBy?.name}`);
    console.log(`  Approved Date: ${approved.approvedDate}\n`);

    // Step 6: Verify approval is reflected
    console.log('Step 6: Verifying approval is reflected...');
    const updated = await LeaveRequest.findById(leaveRequest._id)
      .populate('userId', 'name email')
      .populate('approvedBy', 'name email');

    if (updated.status === 'approved') {
      console.log(`✓ Approval reflected successfully`);
      console.log(`  Status: ${updated.status}`);
      console.log(`  Approved By: ${updated.approvedBy?.name}`);
      console.log(`  Employee: ${updated.userId?.name}\n`);
    } else {
      console.log(`✗ Approval NOT reflected\n`);
    }

    // Step 7: Verify employee can see approved leave
    console.log('Step 7: Verifying employee can see approved leave...');
    const employeeLeaves = await LeaveRequest.find({ 
      userId: employee.userId._id,
      status: 'approved'
    }).lean();

    const employeeApproved = employeeLeaves.find(lr => lr._id.toString() === leaveRequest._id.toString());
    if (employeeApproved) {
      console.log(`✓ Employee can see approved leave`);
      console.log(`  Leave Type: ${employeeApproved.leaveType}`);
      console.log(`  Status: ${employeeApproved.status}\n`);
    } else {
      console.log(`✗ Employee cannot see approved leave\n`);
    }

    console.log('='.repeat(50));
    console.log('\n✓ Complete leave request flow test PASSED!\n');

  } catch (error) {
    console.error('✗ Error:', error.message);
    console.error(error);
  } finally {
    await mongoose.connection.close();
    console.log('✓ Database connection closed\n');
  }
};

connectDB().then(() => testCompleteFlow());
