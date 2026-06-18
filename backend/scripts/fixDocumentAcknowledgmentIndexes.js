/**
 * Migration Script: Fix DocumentAcknowledgment Indexes
 * 
 * Issue: E11000 duplicate key error on id_1 unique index
 * 
 * This script:
 * 1. Connects to MongoDB
 * 2. Inspects current indexes on documentacknowledgments collection
 * 3. Drops the bad id_1 unique index if it exists
 * 4. Ensures compound unique index exists: { documentId, employeeId, organizationId }
 * 5. Logs all operations
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../.env') });

async function fixIndexes() {
  try {
    console.log('🔧 Connecting to MongoDB...');
    
    const mongoUri = process.env.MONGO_URL || process.env.MONGODB_URI;
    if (!mongoUri) {
      throw new Error('MONGO_URL or MONGODB_URI not set in .env');
    }

    await mongoose.connect(mongoUri);
    console.log('✅ Connected to MongoDB');

    const db = mongoose.connection.db;
    const collection = db.collection('documentacknowledgments');

    // Get current indexes
    console.log('\n📋 Current indexes:');
    const indexes = await collection.getIndexes();
    console.log(JSON.stringify(indexes, null, 2));

    // Drop bad id_1 index if it exists
    if (indexes.id_1) {
      console.log('\n⚠️  Found bad index: id_1. Dropping it...');
      try {
        await collection.dropIndex('id_1');
        console.log('✅ Dropped id_1 index');
      } catch (err) {
        console.error('❌ Failed to drop id_1 index:', err.message);
      }
    }

    // Ensure compound unique index exists
    console.log('\n🔨 Creating compound unique index: { documentId, employeeId, organizationId }');
    try {
      await collection.createIndex(
        { documentId: 1, employeeId: 1, organizationId: 1 },
        { unique: true, name: 'documentId_employeeId_organizationId_unique' }
      );
      console.log('✅ Compound unique index created');
    } catch (err) {
      if (err.code === 85) {
        // Index already exists with different options
        console.log('⚠️  Index exists with different options. Dropping and recreating...');
        try {
          await collection.dropIndex('documentId_1_employeeId_1_organizationId_1');
        } catch (e) {
          // Ignore if doesn't exist
        }
        await collection.createIndex(
          { documentId: 1, employeeId: 1, organizationId: 1 },
          { unique: true, name: 'documentId_employeeId_organizationId_unique' }
        );
        console.log('✅ Compound unique index recreated');
      } else {
        throw err;
      }
    }

    // Verify indexes
    console.log('\n📋 Final indexes:');
    const finalIndexes = await collection.getIndexes();
    console.log(JSON.stringify(finalIndexes, null, 2));

    console.log('\n✅ Index migration completed successfully!');

  } catch (error) {
    console.error('❌ Error during index migration:', error.message);
    process.exit(1);
  } finally {
    await mongoose.connection.close();
    console.log('🔌 MongoDB connection closed');
  }
}

// Run the script
fixIndexes();
