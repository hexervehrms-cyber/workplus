/**
 * Script to delete broken leave requests (those with missing User references)
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import LeaveRequest from '../models/LeaveRequest.js';
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

const deleteBrokenLeaveRequests = async () => {
  try {
    console.log('\n📋 Deleting broken leave requests...\n');

    const leaveRequests = await LeaveRequest.find({}).lean();
    
    let deleted = 0;
    let kept = 0;

    for (const leave of leaveRequests) {
      if (leave.userId) {
        const user = await User.findById(leave.userId).lean();
        if (!user) {
          // User doesn't exist, delete this leave request
          await LeaveRequest.findByIdAndDelete(leave._id);
          console.log(`✓ Deleted broken leave request for ${leave.employeeName}`);
          deleted++;
        } else {
          kept++;
        }
      } else {
        // No userId, delete this leave request
        await LeaveRequest.findByIdAndDelete(leave._id);
        console.log(`✓ Deleted leave request with no userId: ${leave.employeeName}`);
        deleted++;
      }
    }

    console.log(`\n✓ Deleted ${deleted} broken leave requests`);
    console.log(`✓ Kept ${kept} valid leave requests\n`);

  } catch (error) {
    console.error('✗ Error:', error.message);
  } finally {
    await mongoose.connection.close();
    console.log('✓ Database connection closed\n');
  }
};

connectDB().then(() => deleteBrokenLeaveRequests());
