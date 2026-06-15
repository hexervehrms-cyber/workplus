/**
 * Test with REAL data from MongoDB database
 * Usage: node test-real-data.js
 * 
 * Connects to database and retrieves real employee/admin records
 * 
 * Requires environment variables:
 * - MONGODB_URI: MongoDB connection string (from .env)
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';

// Load environment variables from .env
dotenv.config();

// Get MongoDB URI from environment
const MONGODB_URI = process.env.MONGODB_URI;

// Validate environment
if (!MONGODB_URI) {
  console.error('❌ ERROR: MONGODB_URI environment variable is not set');
  console.error('   Please set MONGODB_URI in your .env file');
  console.error('   Example: MONGODB_URI=mongodb+srv://user:pass@cluster.mongodb.net/db');
  process.exit(1);
}

async function checkRealData() {
  console.log('='.repeat(70));
  console.log('WORKPLUS PRO - REAL DATA VERIFICATION');
  console.log('='.repeat(70));
  console.log('Connecting to database...\n');
  
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Database connected successfully\n');
    
    // Check Users collection (Admins)
    console.log('--- ADMIN USERS ---');
    const User = mongoose.connection.collection('users');
    const adminUsers = await User.find({}).toArray();
    console.log(`Total users found: ${adminUsers.length}`);
    
    if (adminUsers.length > 0) {
      console.log('\nAdmin/Super Admin Users:');
      adminUsers.forEach((user, i) => {
        console.log(`  ${i+1}. ${user.name} (${user.email}) - Role: ${user.role}`);
      });
    } else {
      console.log('❌ No users found in database');
    }
    
    // Check Employees collection
    console.log('\n--- EMPLOYEES ---');
    const Employee = mongoose.connection.collection('employees');
    const employees = await Employee.find({}).toArray();
    console.log(`Total employees found: ${employees.length}`);
    
    if (employees.length > 0) {
      console.log('\nEmployee List:');
      employees.forEach((emp, i) => {
        console.log(`  ${i+1}. ${emp.firstName || emp.name} ${emp.lastName || ''} - ${emp.department || 'N/A'} - ${emp.position || 'N/A'}`);
      });
    } else {
      console.log('❌ No employees found in database');
    }
    
    // Check Attendance
    console.log('\n--- ATTENDANCE RECORDS ---');
    const Attendance = mongoose.connection.collection('attendances');
    const attendanceCount = await Attendance.countDocuments();
    console.log(`Total attendance records: ${attendanceCount}`);
    
    // Check Leave Requests
    console.log('\n--- LEAVE REQUESTS ---');
    const Leave = mongoose.connection.collection('leaverequests');
    const leaveCount = await Leave.countDocuments();
    console.log(`Total leave requests: ${leaveCount}`);
    
    // Check Expenses
    console.log('\n--- EXPENSES ---');
    const Expense = mongoose.connection.collection('expenses');
    const expenseCount = await Expense.countDocuments();
    console.log(`Total expenses: ${expenseCount}`);
    
    // Check Documents
    console.log('\n--- DOCUMENTS ---');
    const Document = mongoose.connection.collection('documents');
    const docCount = await Document.countDocuments();
    console.log(`Total documents: ${docCount}`);
    
    // Check Payslips
    console.log('\n--- PAYSLIPS ---');
    const Payslip = mongoose.connection.collection('payslips');
    const payslipCount = await Payslip.countDocuments();
    console.log(`Total payslips: ${payslipCount}`);
    
    // Summary
    console.log('\n' + '='.repeat(70));
    console.log('DATA SUMMARY');
    console.log('='.repeat(70));
    console.log(`Users/Admins:     ${adminUsers.length}`);
    console.log(`Employees:        ${employees.length}`);
    console.log(`Attendance:        ${attendanceCount}`);
    console.log(`Leave Requests:    ${leaveCount}`);
    console.log(`Expenses:          ${expenseCount}`);
    console.log(`Documents:         ${docCount}`);
    console.log(`Payslips:          ${payslipCount}`);
    
    if (adminUsers.length === 0 && employees.length === 0) {
      console.log('\n⚠️  DATABASE IS EMPTY - No real data found');
      console.log('   The system needs to be seeded with initial data');
    } else {
      console.log('\n✅ REAL DATA EXISTS - Ready for testing');
    }
    
  } catch (error) {
    console.error('❌ Database connection failed:', error.message);
  } finally {
    await mongoose.disconnect();
    console.log('\n✅ Database connection closed');
  }
}

checkRealData();
