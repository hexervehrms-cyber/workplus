import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Employee from '../models/Employee.js';
import User from '../models/User.js';

dotenv.config({ path: './backend/.env' });

async function listRealEmployees() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');

    // Get all employees
    const employees = await Employee.find({}).populate('userId', 'email name role').limit(20);
    
    console.log(`Found ${employees.length} real employees:\n`);
    
    employees.forEach((emp, index) => {
      console.log(`${index + 1}. ${emp.name}`);
      console.log(`   Email: ${emp.email}`);
      console.log(`   Employee Code: ${emp.employeeCode}`);
      console.log(`   Designation: ${emp.designation}`);
      console.log(`   Department: ${emp.department}`);
      console.log(`   User ID: ${emp.userId?._id}`);
      console.log(`   User Email: ${emp.userId?.email}`);
      console.log(`   User Role: ${emp.userId?.role}`);
      console.log('');
    });

    // Get all users with employee role
    console.log('\n--- All Employee Users ---\n');
    const employeeUsers = await User.find({ role: 'employee' }).select('email name _id');
    
    employeeUsers.forEach((user, index) => {
      console.log(`${index + 1}. ${user.name} (${user.email})`);
    });

    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

listRealEmployees();
