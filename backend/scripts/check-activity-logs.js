/**
 * Script to check activity logs in the database
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import ActivityLog from '../models/ActivityLog.js';

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

const checkActivityLogs = async () => {
  try {
    console.log('\n📋 Checking activity logs...\n');

    // Get all activity logs
    const allLogs = await ActivityLog.find({}).sort({ createdAt: -1 }).limit(10);
    console.log(`Total activity logs found: ${allLogs.length}`);
    
    if (allLogs.length > 0) {
      console.log('\nRecent activity logs:');
      allLogs.forEach((log, index) => {
        console.log(`${index + 1}. Action: ${log.action}, OrgId: ${log.orgId}, UserId: ${log.userId}, Created: ${log.createdAt}`);
      });
    }

    // Get today's attendance logs specifically
    const today = new Date();
    const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const endOfDay = new Date(startOfDay.getTime() + 24 * 60 * 60 * 1000);
    
    const todayAttendanceLogs = await ActivityLog.find({
      action: {
        $in: [
          'attendance_checkin',
          'attendance_checkout', 
          'attendance_break_start',
          'attendance_break_end',
          'attendance_meeting_start',
          'attendance_meeting_end'
        ]
      },
      createdAt: { $gte: startOfDay, $lt: endOfDay }
    }).sort({ createdAt: -1 });

    console.log(`\nToday's attendance logs: ${todayAttendanceLogs.length}`);
    
    if (todayAttendanceLogs.length > 0) {
      console.log('\nToday\'s attendance activity:');
      todayAttendanceLogs.forEach((log, index) => {
        console.log(`${index + 1}. Action: ${log.action}, OrgId: ${log.orgId}, UserId: ${log.userId}, Created: ${log.createdAt}`);
      });
    }

    // Check for any logs with workplus_system orgId
    const systemLogs = await ActivityLog.find({ orgId: 'workplus_system' }).sort({ createdAt: -1 }).limit(5);
    console.log(`\nLogs with orgId 'workplus_system': ${systemLogs.length}`);
    
    if (systemLogs.length > 0) {
      console.log('\nSystem org logs:');
      systemLogs.forEach((log, index) => {
        console.log(`${index + 1}. Action: ${log.action}, Created: ${log.createdAt}`);
      });
    }

  } catch (error) {
    console.error('✗ Error:', error.message);
  } finally {
    await mongoose.connection.close();
    console.log('\n✓ Database connection closed\n');
  }
};

connectDB().then(() => checkActivityLogs());