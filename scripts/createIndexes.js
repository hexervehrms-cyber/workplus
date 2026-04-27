/**
 * Database Index Creation Script
 * Run this to ensure all indexes are created in MongoDB
 * 
 * Usage: node scripts/createIndexes.js
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

// Import models
import User from '../models/User.js';
import Employee from '../models/Employee.js';
import Document from '../models/Document.js';
import Company from '../models/Company.js';
import Attendance from '../models/Attendance.js';
import LeaveRequest from '../models/LeaveRequest.js';
import Expense from '../models/Expense.js';
import Payroll from '../models/Payroll.js';

const createIndexes = async () => {
  try {
    console.log('🔗 Connecting to MongoDB...');
    
    await mongoose.connect(process.env.MONGODB_URI, {
      serverSelectionTimeoutMS: 30000
    });
    
    console.log('✅ Connected to MongoDB');
    console.log('');
    console.log('📊 Creating indexes...');
    console.log('');

    // User indexes
    console.log('Creating User indexes...');
    await User.ensureIndexes();
    console.log('  ✅ User indexes created');
    
    // Employee indexes
    console.log('Creating Employee indexes...');
    await Employee.ensureIndexes();
    console.log('  ✅ Employee indexes created');
    
    // Document indexes
    console.log('Creating Document indexes...');
    await Document.ensureIndexes();
    console.log('  ✅ Document indexes created');
    
    // Company indexes
    console.log('Creating Company indexes...');
    await Company.ensureIndexes();
    console.log('  ✅ Company indexes created');
    
    // Attendance indexes
    console.log('Creating Attendance indexes...');
    await Attendance.ensureIndexes();
    console.log('  ✅ Attendance indexes created');
    
    // LeaveRequest indexes
    console.log('Creating LeaveRequest indexes...');
    await LeaveRequest.ensureIndexes();
    console.log('  ✅ LeaveRequest indexes created');
    
    // Expense indexes
    console.log('Creating Expense indexes...');
    await Expense.ensureIndexes();
    console.log('  ✅ Expense indexes created');
    
    // Payroll indexes
    console.log('Creating Payroll indexes...');
    await Payroll.ensureIndexes();
    console.log('  ✅ Payroll indexes created');

    console.log('');
    console.log('✅ All indexes created successfully!');
    
    // List all indexes
    console.log('');
    console.log('📋 Index summary:');
    
    const collections = await mongoose.connection.db.listCollections().toArray();
    
    for (const collection of collections) {
      const indexes = await mongoose.connection.db.collection(collection.name).indexes();
      console.log(`\n  ${collection.name}:`);
      indexes.forEach(idx => {
        console.log(`    - ${idx.name}: ${JSON.stringify(idx.key)}`);
      });
    }
    
    await mongoose.connection.close();
    console.log('\n👋 Done!');
    process.exit(0);
    
  } catch (error) {
    console.error('❌ Error creating indexes:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
};

createIndexes();
