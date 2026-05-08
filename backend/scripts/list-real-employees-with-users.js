/**
 * Script to list real employees with their user references
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';
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

const listRealEmployees = async () => {
  try {
    console.log('\n📋 Real Employees with User References:\n');

    const employees = await Employee.find({ status: 'active' })
      .populate('userId', 'name email role')
      .lean();

    if (employees.length === 0) {
      console.log('⚠ No active employees found');
      return;
    }

    console.log(`Found ${employees.length} active employees:\n`);

    employees.forEach((emp, index) => {
      console.log(`${index + 1}. Employee:`);
      console.log(`   ID: ${emp._id}`);
      console.log(`   Code: ${emp.employeeCode || 'N/A'}`);
      console.log(`   Name: ${emp.firstName} ${emp.lastName}`);
      console.log(`   Designation: ${emp.designation}`);
      console.log(`   Department: ${emp.department}`);
      if (emp.userId) {
        console.log(`   User ID: ${emp.userId._id}`);
        console.log(`   User Name: ${emp.userId.name}`);
        console.log(`   User Email: ${emp.userId.email}`);
      } else {
        console.log(`   ⚠ No user reference`);
      }
      console.log('');
    });

  } catch (error) {
    console.error('✗ Error:', error.message);
  } finally {
    await mongoose.connection.close();
    console.log('✓ Database connection closed\n');
  }
};

connectDB().then(() => listRealEmployees());
