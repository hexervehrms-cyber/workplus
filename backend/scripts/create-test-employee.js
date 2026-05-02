/**
 * Create Test Employee for Production Testing
 * This script creates a complete test employee with all required data
 */

import mongoose from 'mongoose';
import bcrypt from 'bcrypt';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Import models
import User from '../models/User.js';
import Employee from '../models/Employee.js';
import Attendance from '../models/Attendance.js';
import LeaveRequest from '../models/LeaveRequest.js';
import Expense from '../models/Expense.js';

async function createTestEmployee() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    // Check if test employee already exists
    const existingUser = await User.findOne({ email: 'employee@workpluspro.com' });
    if (existingUser) {
      console.log('✅ Test employee already exists');
      
      // Ensure employee record exists
      let employee = await Employee.findOne({ userId: existingUser._id });
      if (!employee) {
        employee = await Employee.create({
          userId: existingUser._id,
          employeeCode: 'EMP001',
          designation: 'Software Engineer',
          department: 'Engineering',
          baseSalary: 75000,
          hra: 15000,
          allowances: 5000,
          bonus: 0,
          incentives: 0,
          providentFund: 9000,
          tax: 12000,
          insurance: 2000,
          otherDeductions: 0,
          joiningDate: new Date('2024-01-15'),
          phone: '+1234567890',
          address: '123 Test Street, Test City, TC 12345',
          status: 'active',
          orgId: 'org_001'
        });
        console.log('✅ Employee record created');
      }

      console.log('Test Employee Details:');
      console.log(`Email: employee@workpluspro.com`);
      console.log(`Password: TestPass123!`);
      console.log(`Employee ID: ${employee._id}`);
      console.log(`Employee Code: ${employee.employeeCode}`);
      
      await mongoose.disconnect();
      return;
    }

    // Create test user
    const hashedPassword = await bcrypt.hash('TestPass123!', 12);
    
    const testUser = await User.create({
      name: 'John Test Employee',
      email: 'employee@workpluspro.com',
      password: hashedPassword,
      role: 'employee',
      organization: 'WorkPlus Inc.',
      isActive: true,
      orgId: 'org_001',
      profile: {
        firstName: 'John',
        lastName: 'Employee',
        displayName: 'John Test Employee',
        timezone: 'UTC',
        language: 'en'
      },
      contact: {
        phone: '+1234567890',
        address: {
          street: '123 Test Street',
          city: 'Test City',
          state: 'TC',
          zipCode: '12345',
          country: 'US'
        },
        emergencyContact: {
          name: 'Jane Employee',
          relationship: 'Spouse',
          phone: '+1234567891'
        }
      },
      preferences: {
        notifications: {
          email: true,
          push: true,
          sms: false
        },
        theme: 'light',
        language: 'en'
      }
    });

    console.log('✅ Test user created');

    // Create employee record
    const testEmployee = await Employee.create({
      userId: testUser._id,
      employeeCode: 'EMP001',
      designation: 'Software Engineer',
      department: 'Engineering',
      baseSalary: 75000,
      hra: 15000,
      allowances: 5000,
      bonus: 0,
      incentives: 0,
      providentFund: 9000,
      tax: 12000,
      insurance: 2000,
      otherDeductions: 0,
      joiningDate: new Date('2024-01-15'),
      phone: '+1234567890',
      address: '123 Test Street, Test City, TC 12345',
      status: 'active',
      orgId: 'org_001'
    });

    console.log('✅ Test employee record created');

    // Create sample attendance records
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    
    const attendanceRecords = [
      {
        userId: testUser._id,
        employeeId: testEmployee._id,
        employeeName: testUser.name,
        date: yesterday,
        checkIn: new Date(yesterday.setHours(9, 0, 0, 0)),
        checkOut: new Date(yesterday.setHours(18, 0, 0, 0)),
        status: 'present',
        hoursWorked: 8,
        orgId: 'org_001'
      },
      {
        userId: testUser._id,
        employeeId: testEmployee._id,
        employeeName: testUser.name,
        date: today,
        checkIn: new Date(today.setHours(9, 15, 0, 0)),
        status: 'late',
        hoursWorked: 0,
        orgId: 'org_001'
      }
    ];

    await Attendance.insertMany(attendanceRecords);
    console.log('✅ Sample attendance records created');

    // Create sample leave request
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 7);
    const endDate = new Date(futureDate);
    endDate.setDate(endDate.getDate() + 2);

    await LeaveRequest.create({
      userId: testUser._id,
      employeeId: testEmployee._id,
      employeeName: testUser.name,
      type: 'Vacation',
      startDate: futureDate,
      endDate: endDate,
      reason: 'Family vacation',
      status: 'pending',
      orgId: 'org_001'
    });

    console.log('✅ Sample leave request created');

    // Create sample expense
    await Expense.create({
      userId: testUser._id,
      employeeId: testEmployee._id,
      employeeName: testUser.name,
      category: 'Travel',
      amount: 150.50,
      date: new Date(),
      description: 'Client meeting travel expenses',
      status: 'pending',
      orgId: 'org_001'
    });

    console.log('✅ Sample expense created');

    console.log('\n🎉 Test Employee Setup Complete!');
    console.log('Test Employee Credentials:');
    console.log('Email: employee@workpluspro.com');
    console.log('Password: TestPass123!');
    console.log(`User ID: ${testUser._id}`);
    console.log(`Employee ID: ${testEmployee._id}`);
    console.log(`Employee Code: ${testEmployee.employeeCode}`);

    await mongoose.disconnect();
    console.log('✅ Database connection closed');

  } catch (error) {
    console.error('❌ Error creating test employee:', error);
    process.exit(1);
  }
}

// Run the script
createTestEmployee();