/**
 * Script to create sample activity logs for testing
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import ActivityLog from '../models/ActivityLog.js';
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

const createSampleActivityLogs = async () => {
  try {
    console.log('\n📋 Creating sample activity logs...\n');

    // Find Harsh Gupta's user record
    const harshUser = await User.findOne({ name: 'Harsh Gupta' });
    if (!harshUser) {
      console.log('❌ Harsh Gupta user not found');
      return;
    }

    console.log(`Found user: ${harshUser.name} (${harshUser._id})`);

    // Get today's date
    const today = new Date();
    const checkInTime = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 9, 15, 0); // 9:15 AM
    const breakStartTime = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 11, 30, 0); // 11:30 AM
    const breakEndTime = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 12, 0, 0); // 12:00 PM
    const checkOutTime = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 17, 30, 0); // 5:30 PM

    // Create sample activity logs
    const sampleLogs = [
      {
        userId: harshUser._id,
        orgId: 'system',
        action: 'attendance_checkin',
        entity: {
          entityType: 'attendance',
          entityId: new mongoose.Types.ObjectId(),
          entityName: 'Harsh Gupta - Check In'
        },
        details: {
          employeeName: 'Harsh Gupta',
          location: 'Office',
          notes: 'Check-in from employee dashboard',
          isLate: false
        },
        ipAddress: '192.168.1.100',
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        severity: 'low',
        category: 'user',
        createdAt: checkInTime
      },
      {
        userId: harshUser._id,
        orgId: 'system',
        action: 'attendance_break_start',
        entity: {
          entityType: 'attendance',
          entityId: new mongoose.Types.ObjectId(),
          entityName: 'Harsh Gupta - Break Start'
        },
        details: {
          employeeName: 'Harsh Gupta',
          breakType: 'lunch',
          location: 'Office',
          notes: 'Lunch break'
        },
        ipAddress: '192.168.1.100',
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        severity: 'low',
        category: 'user',
        createdAt: breakStartTime
      },
      {
        userId: harshUser._id,
        orgId: 'system',
        action: 'attendance_break_end',
        entity: {
          entityType: 'attendance',
          entityId: new mongoose.Types.ObjectId(),
          entityName: 'Harsh Gupta - Break End'
        },
        details: {
          employeeName: 'Harsh Gupta',
          breakType: 'lunch',
          duration: 30,
          location: 'Office',
          notes: 'Lunch break ended'
        },
        ipAddress: '192.168.1.100',
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        severity: 'low',
        category: 'user',
        createdAt: breakEndTime
      },
      {
        userId: harshUser._id,
        orgId: 'system',
        action: 'attendance_checkout',
        entity: {
          entityType: 'attendance',
          entityId: new mongoose.Types.ObjectId(),
          entityName: 'Harsh Gupta - Check Out'
        },
        details: {
          employeeName: 'Harsh Gupta',
          hoursWorked: 8.25,
          location: 'Office',
          notes: 'Check-out from employee dashboard',
          isOvertime: false
        },
        ipAddress: '192.168.1.100',
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        severity: 'low',
        category: 'user',
        createdAt: checkOutTime
      }
    ];

    // Insert the sample logs
    const createdLogs = await ActivityLog.insertMany(sampleLogs);
    console.log(`✅ Created ${createdLogs.length} sample activity logs`);

    // Display created logs
    createdLogs.forEach((log, index) => {
      console.log(`${index + 1}. ${log.action} - ${log.createdAt}`);
    });

  } catch (error) {
    console.error('✗ Error:', error.message);
  } finally {
    await mongoose.connection.close();
    console.log('\n✓ Database connection closed\n');
  }
};

connectDB().then(() => createSampleActivityLogs());