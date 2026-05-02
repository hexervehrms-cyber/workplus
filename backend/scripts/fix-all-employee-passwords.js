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

    // Update all employee passwords to 'Jadu@123'
    const password = 'Jadu@123';
    const hashedPassword = await bcrypt.hash(password, 12);

    for (const employee of employees) {
      employee.password = hashedPassword;
      await employee.save();
      console.log(`✅ Updated password for ${employee.email}`);
    }

    console.log('\n✅ All employee passwords updated!');
    console.log('New password for all employees: Jadu@123');

    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

fixEmployeePasswords();
