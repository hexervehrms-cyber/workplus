/**
 * List All Employees and Their Users
 * Shows all real employees in the system with their associated user accounts
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Employee from '../models/Employee.js';
import User from '../models/User.js';
import logger from '../utils/logger.js';

dotenv.config();

async function listAllEmployees() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/workpluspro');
    logger.info('Connected to MongoDB');

    // Get all employees with their user details
    const employees = await Employee.find({})
      .populate('userId', 'name email role isActive')
      .lean();

    console.log('\n================================================================================');
    console.log('ALL EMPLOYEES IN SYSTEM');
    console.log('================================================================================\n');

    if (employees.length === 0) {
      console.log('❌ No employees found in the system');
    } else {
      employees.forEach((emp, index) => {
        console.log(`${index + 1}. Employee: ${emp.userId?.name || 'N/A'}`);
        console.log(`   Email: ${emp.userId?.email || 'N/A'}`);
        console.log(`   Employee ID: ${emp._id}`);
        console.log(`   Designation: ${emp.designation || 'N/A'}`);
        console.log(`   Department: ${emp.department || 'N/A'}`);
        console.log(`   Status: ${emp.status || 'N/A'}`);
        console.log(`   User Active: ${emp.userId?.isActive ? '✅ Yes' : '❌ No'}`);
        console.log(`   Base Salary: ${emp.baseSalary || 'N/A'}`);
        console.log('');
      });
    }

    // Get all users
    console.log('================================================================================');
    console.log('ALL USERS IN SYSTEM');
    console.log('================================================================================\n');

    const users = await User.find({})
      .select('name email role isActive organization')
      .lean();

    if (users.length === 0) {
      console.log('❌ No users found in the system');
    } else {
      users.forEach((user, index) => {
        console.log(`${index + 1}. User: ${user.name}`);
        console.log(`   Email: ${user.email}`);
        console.log(`   Role: ${user.role}`);
        console.log(`   Active: ${user.isActive ? '✅ Yes' : '❌ No'}`);
        console.log(`   Organization: ${user.organization || 'N/A'}`);
        console.log('');
      });
    }

    console.log('================================================================================');
    console.log(`Total Employees: ${employees.length}`);
    console.log(`Total Users: ${users.length}`);
    console.log('================================================================================\n');

    process.exit(0);
  } catch (error) {
    logger.error('Error listing employees', { error: error.message });
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

listAllEmployees();
