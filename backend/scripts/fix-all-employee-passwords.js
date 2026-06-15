import mongoose from 'mongoose';
import bcrypt from 'bcrypt';
import dotenv from 'dotenv';
import User from '../models/User.js';

dotenv.config({ path: './backend/.env' });

async function fixEmployeePasswords() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    // Find all employee users
    const employees = await User.find({ role: 'employee' });
    console.log(`Found ${employees.length} employee users`);

    // Update all employee passwords to value from environment
    const password = process.env.EMPLOYEE_PASSWORD;
    
    if (!password) {
      console.error('❌ ERROR: EMPLOYEE_PASSWORD not set');
      console.error('   Set EMPLOYEE_PASSWORD in .env file');
      throw new Error('Missing EMPLOYEE_PASSWORD');
    }

    const hashedPassword = await bcrypt.hash(password, 12);

    for (const employee of employees) {
      employee.password = hashedPassword;
      await employee.save();
      console.log(`✅ Updated password for ${employee.email}`);
    }

    console.log('\n✅ All employee passwords updated!');
    console.log('New password from EMPLOYEE_PASSWORD env var');

    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

fixEmployeePasswords();
