/**
 * Clean Test Users
 * Deletes all test users created during testing (except super admin)
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config({ path: './backend/.env' });

async function cleanTestUsers() {
  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    const db = mongoose.connection.db;
    const collection = db.collection('users');

    console.log('\n🗑️  Deleting all test users (keeping super admin)...');
    const result = await collection.deleteMany({
      email: { $ne: 'superadmin@company.com' },
      role: 'employee'
    });
    console.log(`✅ Deleted ${result.deletedCount} test users`);

    console.log('\n✅ Cleanup completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

cleanTestUsers();
