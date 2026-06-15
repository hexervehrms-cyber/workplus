/**
 * Check employee accounts in database
 * Usage: node check-employee-accounts.js
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

async function checkEmployees() {
  console.log('Checking employee accounts...\n');
  
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Database connected\n');
    
    const User = mongoose.connection.collection('users');
    const users = await User.find({}).toArray();
    
    console.log('All Users:');
    users.forEach((user, i) => {
      console.log(`  ${i+1}. ${user.name} (${user.email}) - Role: ${user.role}`);
    });
    
    console.log('\nEmployees:');
    const employees = await User.find({ role: 'employee' }).toArray();
    if (employees.length > 0) {
      employees.forEach((emp, i) => {
        console.log(`  ${i+1}. ${emp.name} (${emp.email})`);
      });
    } else {
      console.log('  No employees found');
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await mongoose.disconnect();
  }
}

checkEmployees();
