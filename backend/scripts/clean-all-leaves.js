/**
 * Script to delete ALL leave requests to start fresh
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import LeaveRequest from '../models/LeaveRequest.js';

dotenv.config({ path: './.env' });

const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/workplus');
    console.log('✓ Connected to MongoDB\n');
  } catch (error) {
    console.error('✗ MongoDB connection failed:', error.message);
    process.exit(1);
  }
};

const cleanAllLeaves = async () => {
  try {
    console.log('🗑️  Deleting ALL leave requests...\n');

    const result = await LeaveRequest.deleteMany({});
    
    console.log(`✓ Deleted ${result.deletedCount} leave requests\n`);
    console.log('✓ Database is now clean and ready for real testing!\n');

  } catch (error) {
    console.error('✗ Error:', error.message);
  } finally {
    await mongoose.connection.close();
    console.log('✓ Database connection closed\n');
  }
};

connectDB().then(() => cleanAllLeaves());
