/**
 * Clean Employees Collection
 * Deletes all employees to start fresh
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config({ path: './backend/.env' });

async function cleanEmployees() {
  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    const db = mongoose.connection.db;
    const collection = db.collection('employees');

    console.log('\n🗑️  Deleting all employees...');
    const result = await collection.deleteMany({});
    console.log(`✅ Deleted ${result.deletedCount} employees`);

    console.log('\n✅ Cleanup completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

cleanEmployees();
