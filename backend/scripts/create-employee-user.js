import mongoose from 'mongoose';
import bcrypt from 'bcrypt';
import dotenv from 'dotenv';
import User from '../models/User.js';
import Employee from '../models/Employee.js';

dotenv.config({ path: './backend/.env' });

async function createEmployeeUser() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    // Create employee user with password from environment
    const email = process.env.EMPLOYEE_EMAIL || 'employee@company.com';
    const password = process.env.EMPLOYEE_PASSWORD;
    
    if (!password) {
      console.error('❌ ERROR: EMPLOYEE_PASSWORD not set');
      console.error('   Set EMPLOYEE_PASSWORD in .env file');
      throw new Error('Missing EMPLOYEE_PASSWORD');
    }

    const hashedPassword = await bcrypt.hash(password, 12);

    // Check if user already exists
    let user = await User.findOne({ email });
    
    if (user) {
      console.log('User already exists, updating password...');
      user.password = hashedPassword;
      await user.save();
      console.log('✅ Password updated');
    } else {
      // Create new user
      user = await User.create({
        name: 'Test Employee',
        email,
        password: hashedPassword,
        role: 'employee',
        orgId: 'system',
        isActive: true,
        emailVerified: true
      });
      console.log('✅ Employee user created:', user._id);
    }

    // Check if employee record exists
    let employee = await Employee.findOne({ userId: user._id });
    
    if (!employee) {
      // Create employee record
      employee = await Employee.create({
        userId: user._id,
        name: 'Test Employee',
        email,
        designation: 'Software Engineer',
        department: 'Engineering',
        employeeCode: 'EMP001',
        orgId: 'system',
        status: 'active'
      });
      console.log('✅ Employee record created:', employee._id);
    } else {
      console.log('✅ Employee record already exists');
    }

    console.log('\n✅ Employee user setup complete!');
    console.log('Email:', email);
    console.log('Password:', password);
    console.log('Role: employee');

    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

createEmployeeUser();
