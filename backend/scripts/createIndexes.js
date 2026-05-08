/**
 * Database Index Creation Script
 * Run this once before production deployment
 * Usage: node backend/scripts/createIndexes.js
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import logger from '../utils/logger.js';

dotenv.config({ path: '.env.production' });

// Import models
import User from '../models/User.js';
import Employee from '../models/Employee.js';
import Attendance from '../models/Attendance.js';
import Expense from '../models/Expense.js';
import LeaveRequest from '../models/LeaveRequest.js';
import Notification from '../models/Notification.js';
import ActivityLog from '../models/ActivityLog.js';

const createIndexes = async () => {
  try {
    console.log('🔄 Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    console.log('\n📊 Creating indexes...\n');

    // User indexes
    console.log('Creating User indexes...');
    await User.collection.createIndex({ email: 1 }, { unique: true });
    await User.collection.createIndex({ orgId: 1, role: 1 });
    await User.collection.createIndex({ createdAt: -1 });
    await User.collection.createIndex({ lastLogin: -1 });
    await User.collection.createIndex({ 'profile.firstName': 1, 'profile.lastName': 1 });
    console.log('✅ User indexes created');

    // Employee indexes
    console.log('Creating Employee indexes...');
    await Employee.collection.createIndex({ userId: 1 }, { unique: true });
    await Employee.collection.createIndex({ orgId: 1, status: 1 });
    await Employee.collection.createIndex({ orgId: 1, department: 1 });
    await Employee.collection.createIndex({ employeeCode: 1 }, { sparse: true });
    await Employee.collection.createIndex({ createdAt: -1 });
    console.log('✅ Employee indexes created');

    // Attendance indexes
    console.log('Creating Attendance indexes...');
    await Attendance.collection.createIndex({ userId: 1, orgId: 1, date: 1 });
    await Attendance.collection.createIndex({ employeeId: 1, date: 1 });
    await Attendance.collection.createIndex({ orgId: 1, date: -1 });
    await Attendance.collection.createIndex({ createdAt: -1 });
    console.log('✅ Attendance indexes created');

    // Expense indexes
    console.log('Creating Expense indexes...');
    await Expense.collection.createIndex({ userId: 1, status: 1, createdAt: -1 });
    await Expense.collection.createIndex({ orgId: 1, status: 1 });
    await Expense.collection.createIndex({ createdAt: -1 });
    console.log('✅ Expense indexes created');

    // LeaveRequest indexes
    console.log('Creating LeaveRequest indexes...');
    await LeaveRequest.collection.createIndex({ employeeId: 1, status: 1, startDate: 1 });
    await LeaveRequest.collection.createIndex({ orgId: 1, status: 1 });
    await LeaveRequest.collection.createIndex({ createdAt: -1 });
    console.log('✅ LeaveRequest indexes created');

    // Notification indexes
    console.log('Creating Notification indexes...');
    await Notification.collection.createIndex({ userId: 1, isRead: 1, createdAt: -1 });
    await Notification.collection.createIndex({ orgId: 1, createdAt: -1 });
    console.log('✅ Notification indexes created');

    // ActivityLog indexes
    console.log('Creating ActivityLog indexes...');
    await ActivityLog.collection.createIndex({ userId: 1, createdAt: -1 });
    await ActivityLog.collection.createIndex({ orgId: 1, createdAt: -1 });
    await ActivityLog.collection.createIndex({ action: 1, createdAt: -1 });
    console.log('✅ ActivityLog indexes created');

    console.log('\n✅ All indexes created successfully!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error creating indexes:', error.message);
    process.exit(1);
  }
};

createIndexes();
