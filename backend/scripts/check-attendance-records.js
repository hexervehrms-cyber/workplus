/**
 * Script to check attendance records in the database
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Attendance from '../models/Attendance.js';
import User from '../models/User.js';

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

const checkAttendanceRecords = async () => {
  try {
    console.log('\n📋 Checking attendance records...\n');

    // Get today's date range
    const today = new Date();
    const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const endOfDay = new Date(startOfDay.getTime() + 24 * 60 * 60 * 1000);

    // Get all attendance records for today
    const todayAttendance = await Attendance.find({
      date: { $gte: startOfDay, $lt: endOfDay }
    }).populate('userId', 'name email').sort({ createdAt: -1 });

    console.log(`Today's attendance records: ${todayAttendance.length}`);
    
    if (todayAttendance.length > 0) {
      console.log('\nToday\'s attendance:');
      todayAttendance.forEach((record, index) => {
        console.log(`${index + 1}. Employee: ${record.employeeName || 'Unknown'}`);
        console.log(`   User: ${record.userId?.name || 'Unknown'} (${record.userId?._id})`);
        console.log(`   Employee ID: ${record.employeeId}`);
        console.log(`   Check-in: ${record.checkIn || 'Not checked in'}`);
        console.log(`   Check-out: ${record.checkOut || 'Not checked out'}`);
        console.log(`   Status: ${record.status}`);
        console.log(`   Org ID: ${record.orgId}`);
        console.log(`   Created: ${record.createdAt}`);
        console.log('   ---');
      });
    }

    // Get all attendance records (recent)
    const allAttendance = await Attendance.find({}).populate('userId', 'name email').sort({ createdAt: -1 }).limit(10);
    console.log(`\nTotal recent attendance records: ${allAttendance.length}`);
    
    if (allAttendance.length > 0) {
      console.log('\nRecent attendance records:');
      allAttendance.forEach((record, index) => {
        console.log(`${index + 1}. Employee: ${record.employeeName || 'Unknown'} - Date: ${record.date} - Status: ${record.status}`);
      });
    }

  } catch (error) {
    console.error('✗ Error:', error.message);
  } finally {
    await mongoose.connection.close();
    console.log('\n✓ Database connection closed\n');
  }
};

connectDB().then(() => checkAttendanceRecords());