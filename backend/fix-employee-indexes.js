/**
 * Fix Employee Collection Indexes
 * Drops the problematic unique index on employeeCode and recreates it as non-unique
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config({ path: './backend/.env' });

async function fixIndexes() {
  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    const db = mongoose.connection.db;
    const collection = db.collection('employees');

    console.log('\n📋 Current indexes:');
    const indexes = await collection.listIndexes().toArray();
    console.log(JSON.stringify(indexes, null, 2));

    // Drop the problematic index
    console.log('\n🔧 Dropping employeeCode_1 index...');
    try {
      await collection.dropIndex('employeeCode_1');
      console.log('✅ Dropped employeeCode_1 index');
    } catch (err) {
      console.log('⚠️  Index not found or already dropped:', err.message);
    }

    // Create a non-unique index for employeeCode
    console.log('\n🔧 Creating new employeeCode index (non-unique)...');
    await collection.createIndex(
      { employeeCode: 1 },
      { unique: false }
    );
    console.log('✅ Created new employeeCode index');

    console.log('\n📋 Updated indexes:');
    const newIndexes = await collection.listIndexes().toArray();
    console.log(JSON.stringify(newIndexes, null, 2));

    console.log('\n✅ Index fix completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

fixIndexes();
