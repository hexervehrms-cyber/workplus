#!/usr/bin/env node

/**
 * Test All Sections
 * Tests all major sections of the application
 */

import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import mongoose from 'mongoose';

// Setup __dirname for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
const envPath = path.join(__dirname, '..', '.env');
dotenv.config({ path: envPath });

// Import models
import User from '../models/User.js';
import Employee from '../models/Employee.js';
import Expense from '../models/Expense.js';
import LeaveRequest from '../models/LeaveRequest.js';
import Attendance from '../models/Attendance.js';
import Holiday from '../models/Holiday.js';
import Document from '../models/Document.js';
import Announcement from '../models/Announcement.js';

const testAllSections = async () => {
  try {
    console.log('\n🚀 Testing All Application Sections...\n');

    const mongoUri = process.env.MONGODB_URI;
    if (!mongoUri) {
      console.error('❌ Missing MONGODB_URI');
      process.exit(1);
    }

    // Connect to MongoDB
    console.log('🔗 Connecting to MongoDB...');
    await mongoose.connect(mongoUri, {
      serverSelectionTimeoutMS: 10000,
      socketTimeoutMS: 45000,
    });
    console.log('✅ Connected to MongoDB\n');

    // Test each section
    const sections = [
      { name: 'Users', model: User },
      { name: 'Employees', model: Employee },
      { name: 'Expenses', model: Expense },
      { name: 'Leave Requests', model: LeaveRequest },
      { name: 'Attendance', model: Attendance },
      { name: 'Holidays', model: Holiday },
      { name: 'Documents', model: Document },
      { name: 'Announcements', model: Announcement }
    ];

    console.log('📊 Section Status:\n');
    console.log('Section              | Count | Status');
    console.log('─'.repeat(50));

    const results = {};

    for (const section of sections) {
      try {
        const count = await section.model.countDocuments({});
        const status = count > 0 ? '✅ Has Data' : '⚠️  Empty';
        const sectionName = section.name.padEnd(20);
        const countStr = count.toString().padEnd(5);
        console.log(`${sectionName} | ${countStr} | ${status}`);
        results[section.name] = { count, status: count > 0 ? 'ok' : 'empty' };
      } catch (error) {
        console.log(`${section.name.padEnd(20)} | ERROR | ❌ ${error.message}`);
        results[section.name] = { count: 0, status: 'error', error: error.message };
      }
    }

    // Summary
    console.log('\n📈 Summary:\n');
    const withData = Object.values(results).filter(r => r.count > 0).length;
    const empty = Object.values(results).filter(r => r.count === 0 && r.status === 'empty').length;
    const errors = Object.values(results).filter(r => r.status === 'error').length;

    console.log(`Sections with data: ${withData}`);
    console.log(`Empty sections: ${empty}`);
    console.log(`Errors: ${errors}`);

    // Detailed breakdown
    console.log('\n📋 Detailed Breakdown:\n');

    // Users
    const totalUsers = await User.countDocuments({});
    const adminUsers = await User.countDocuments({ role: 'admin' });
    const employeeUsers = await User.countDocuments({ role: 'employee' });
    const superAdminUsers = await User.countDocuments({ role: 'super_admin' });
    console.log('👥 Users:');
    console.log(`   Total: ${totalUsers}`);
    console.log(`   - Admins: ${adminUsers}`);
    console.log(`   - Employees: ${employeeUsers}`);
    console.log(`   - Super Admins: ${superAdminUsers}`);

    // Employees
    const totalEmployees = await Employee.countDocuments({});
    const activeEmployees = await Employee.countDocuments({ status: 'active' });
    console.log('\n👔 Employees:');
    console.log(`   Total: ${totalEmployees}`);
    console.log(`   - Active: ${activeEmployees}`);

    // Expenses
    const totalExpenses = await Expense.countDocuments({});
    const pendingExpenses = await Expense.countDocuments({ status: 'pending' });
    const approvedExpenses = await Expense.countDocuments({ status: 'approved' });
    const rejectedExpenses = await Expense.countDocuments({ status: 'rejected' });
    console.log('\n💰 Expenses:');
    console.log(`   Total: ${totalExpenses}`);
    console.log(`   - Pending: ${pendingExpenses}`);
    console.log(`   - Approved: ${approvedExpenses}`);
    console.log(`   - Rejected: ${rejectedExpenses}`);

    // Leave Requests
    const totalLeaves = await LeaveRequest.countDocuments({});
    const pendingLeaves = await LeaveRequest.countDocuments({ status: 'pending' });
    const approvedLeaves = await LeaveRequest.countDocuments({ status: 'approved' });
    const rejectedLeaves = await LeaveRequest.countDocuments({ status: 'rejected' });
    console.log('\n📅 Leave Requests:');
    console.log(`   Total: ${totalLeaves}`);
    console.log(`   - Pending: ${pendingLeaves}`);
    console.log(`   - Approved: ${approvedLeaves}`);
    console.log(`   - Rejected: ${rejectedLeaves}`);

    // Attendance
    const totalAttendance = await Attendance.countDocuments({});
    const presentAttendance = await Attendance.countDocuments({ status: 'present' });
    const absentAttendance = await Attendance.countDocuments({ status: 'absent' });
    console.log('\n📍 Attendance:');
    console.log(`   Total: ${totalAttendance}`);
    console.log(`   - Present: ${presentAttendance}`);
    console.log(`   - Absent: ${absentAttendance}`);

    // Holidays
    const totalHolidays = await Holiday.countDocuments({});
    console.log('\n🎉 Holidays:');
    console.log(`   Total: ${totalHolidays}`);

    // Documents
    const totalDocuments = await Document.countDocuments({});
    console.log('\n📄 Documents:');
    console.log(`   Total: ${totalDocuments}`);

    // Announcements
    const totalAnnouncements = await Announcement.countDocuments({});
    console.log('\n📢 Announcements:');
    console.log(`   Total: ${totalAnnouncements}`);

    // Disconnect
    await mongoose.disconnect();
    console.log('\n✅ Test complete!\n');
    process.exit(0);

  } catch (error) {
    console.error('\n❌ Error:');
    console.error('   Message:', error.message);
    console.error('   Stack:', error.stack);
    
    try {
      await mongoose.disconnect();
    } catch (disconnectError) {
      console.error('   Disconnect error:', disconnectError.message);
    }
    
    process.exit(1);
  }
};

// Run test
testAllSections();
