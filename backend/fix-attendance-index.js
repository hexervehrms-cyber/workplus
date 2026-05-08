/**
 * Fix Attendance Index Issue
 * 
 * This script fixes the duplicate key error by:
 * 1. Dropping the old problematic userId_1_date_1 index
 * 2. Ensuring the correct indexes are in place
 * 
 * Usage: node fix-attendance-index.js
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const fixAttendanceIndexes = async () => {
  try {
    console.log('🔗 Connecting to MongoDB...');
    
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI);
    
    console.log('✅ Connected to MongoDB');
    
    const db = mongoose.connection.db;
    const collection = db.collection('attendances');
    
    // Get current indexes
    console.log('\n📋 Current indexes:');
    const indexes = await collection.indexes();
    indexes.forEach(index => {
      console.log(`  - ${index.name}: ${JSON.stringify(index.key)}`);
      if (index.unique) {
        console.log(`    (unique: true)`);
      }
      if (index.partialFilterExpression) {
        console.log(`    (partial: ${JSON.stringify(index.partialFilterExpression)})`);
      }
    });
    
    // Check if the problematic index exists
    const problematicIndex = indexes.find(idx => idx.name === 'userId_1_date_1');
    
    if (problematicIndex) {
      console.log('\n🚨 Found problematic index: userId_1_date_1');
      console.log('   This index is causing duplicate key errors for re-check-ins');
      
      // Drop the problematic index
      console.log('\n🗑️  Dropping problematic index...');
      await collection.dropIndex('userId_1_date_1');
      console.log('✅ Dropped userId_1_date_1 index');
    } else {
      console.log('\n✅ No problematic userId_1_date_1 index found');
    }
    
    // Ensure correct indexes are in place
    console.log('\n🔧 Ensuring correct indexes...');
    
    // Basic indexes
    await collection.createIndex({ userId: 1 });
    await collection.createIndex({ employeeId: 1 });
    await collection.createIndex({ date: 1 });
    await collection.createIndex({ status: 1 });
    await collection.createIndex({ orgId: 1 });
    
    // Compound indexes for common queries
    await collection.createIndex({ orgId: 1, date: -1 });
    await collection.createIndex({ userId: 1, date: -1 });
    await collection.createIndex({ employeeId: 1, date: -1 });
    await collection.createIndex({ orgId: 1, status: 1, date: -1 });
    await collection.createIndex({ date: -1, status: 1 });
    
    console.log('✅ All indexes created successfully');
    
    // Show final indexes
    console.log('\n📋 Final indexes:');
    const finalIndexes = await collection.indexes();
    finalIndexes.forEach(index => {
      console.log(`  - ${index.name}: ${JSON.stringify(index.key)}`);
      if (index.unique) {
        console.log(`    (unique: true)`);
      }
      if (index.partialFilterExpression) {
        console.log(`    (partial: ${JSON.stringify(index.partialFilterExpression)})`);
      }
    });
    
    console.log('\n🎉 Attendance indexes fixed successfully!');
    console.log('   The problematic unique constraint has been removed.');
    console.log('   Employees can now check in/out multiple times per day without errors.');
    console.log('   The application logic will handle duplicate prevention at the code level.');
    
  } catch (error) {
    console.error('❌ Error fixing attendance indexes:', error);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log('\n🔌 Disconnected from MongoDB');
    process.exit(0);
  }
};

fixAttendanceIndexes();