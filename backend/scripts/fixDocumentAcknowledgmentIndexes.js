/**
 * Migration Script: Fix DocumentAcknowledgment Indexes
 * 
 * Issues Fixed:
 * 1. E11000 duplicate key error on id_1 unique index (if it exists)
 * 2. Potential cross-tenant conflicts from documentId_1_employeeId_1 unique index
 *    (if documentId is not globally unique across orgs)
 * 
 * This script:
 * 1. Connects to MongoDB using production credentials
 * 2. Inspects current indexes on documentacknowledgments collection
 * 3. Drops bad indexes:
 *    - id_1 (if exists)
 *    - documentId_1_employeeId_1 (if unique - not tenant-safe)
 * 4. Creates tenant-safe compound unique index:
 *    - { documentId, employeeId, organizationId }
 * 5. Keeps useful non-unique indexes:
 *    - organizationId_1_employeeId_1 (for org/employee queries)
 * 6. Does NOT delete any documents
 * 7. Logs all operations clearly
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
    console.log('\n📋 CURRENT INDEXES:');
    const indexes = await collection.getIndexes();
    console.log(JSON.stringify(indexes, null, 2));

    const indexNames = Object.keys(indexes);
    console.log('\n📋 Index names found:', indexNames.join(', '));

    // List of bad/problematic indexes to drop
    const indexesToDrop = [];

    // 1. Check for bad id_1 unique index
    if (indexes.id_1) {
      console.log('\n⚠️  Found bad index: id_1');
      indexesToDrop.push('id_1');
    }

    // 2. Check for old documentId_1_employeeId_1 unique index (cross-tenant risk)
    // This index is unsafe if documentId can overlap across organizations
    if (indexes.documentId_1_employeeId_1) {
      const docIdEmpIdIndex = indexes.documentId_1_employeeId_1;
      if (docIdEmpIdIndex.unique === true) {
        console.log('\n⚠️  Found potentially unsafe index: documentId_1_employeeId_1 (UNIQUE)');
        console.log('   This index can cause cross-tenant conflicts if documentId overlaps across orgs.');
        console.log('   Will be dropped and replaced with tenant-safe index.');
        indexesToDrop.push('documentId_1_employeeId_1');
      } else {
        console.log('\n✅ Found non-unique index documentId_1_employeeId_1 (safe to keep)');
      }
    }

    // Drop problematic indexes
    console.log('\n🗑️  DROPPING PROBLEMATIC INDEXES:');
    for (const indexName of indexesToDrop) {
      try {
        await collection.dropIndex(indexName);
        console.log(`   ✅ Dropped: ${indexName}`);
      } catch (err) {
        if (err.code === 27) {
          // Index not found - safe to ignore
          console.log(`   ℹ️  Index not found (already dropped): ${indexName}`);
        } else {
          console.error(`   ❌ Failed to drop ${indexName}:`, err.message);
          throw err;
        }
      }
    }

    if (indexesToDrop.length === 0) {
      console.log('   ℹ️  No problematic indexes found.');
    }

    // Create final compound unique index (tenant-safe)
    console.log('\n🔨 CREATING TENANT-SAFE COMPOUND UNIQUE INDEX:');
    console.log('   Index: { documentId: 1, employeeId: 1, organizationId: 1 }');
    try {
      await collection.createIndex(
        { documentId: 1, employeeId: 1, organizationId: 1 },
        { unique: true, name: 'documentId_employeeId_organizationId_unique' }
      );
      console.log('   ✅ Compound unique index created successfully');
    } catch (err) {
      if (err.code === 85 || err.message.includes('already exists')) {
        // Index already exists with same options - OK
        console.log('   ✅ Compound unique index already exists with correct options');
      } else if (err.code === 48 && err.message.includes('cannot create index')) {
        // Index exists with different options
        console.log('   ⚠️  Index exists with different options. Dropping and recreating...');
        try {
          // Try to drop by spec since the name might differ
          await collection.dropIndex({ documentId: 1, employeeId: 1, organizationId: 1 });
        } catch (dropErr) {
          // Try alternate index name patterns
          const altNames = [
            'documentId_1_employeeId_1_organizationId_1',
            'documentId_employeeId_organizationId_unique'
          ];
          for (const altName of altNames) {
            try {
              await collection.dropIndex(altName);
              console.log(`   ✅ Dropped alternate index: ${altName}`);
              break;
            } catch (e) {
              // Ignore, try next
            }
          }
        }
        // Recreate with unique constraint
        await collection.createIndex(
          { documentId: 1, employeeId: 1, organizationId: 1 },
          { unique: true, name: 'documentId_employeeId_organizationId_unique' }
        );
        console.log('   ✅ Compound unique index recreated with correct options');
      } else {
        throw err;
      }
    }

    // Ensure useful non-unique index exists (if not already there)
    console.log('\n🔨 ENSURING USEFUL NON-UNIQUE INDEXES:');
    try {
      await collection.createIndex(
        { organizationId: 1, employeeId: 1 },
        { unique: false, sparse: true }
      );
      console.log('   ✅ Organization + Employee index ensured');
    } catch (err) {
      if (err.code === 85 || err.message.includes('already exists')) {
        console.log('   ℹ️  Organization + Employee index already exists');
      } else {
        console.warn('   ⚠️  Failed to create org+employee index:', err.message);
      }
    }

    // Final verification
    console.log('\n📋 FINAL INDEXES:');
    const finalIndexes = await collection.getIndexes();
    console.log(JSON.stringify(finalIndexes, null, 2));

    console.log('\n✅ Index migration completed successfully!');
    console.log('\n📊 MIGRATION SUMMARY:');
    console.log(`   Indexes dropped: ${indexesToDrop.length > 0 ? indexesToDrop.join(', ') : 'none'}`);
    console.log(`   Final index count: ${Object.keys(finalIndexes).length}`);
    console.log(`   Tenant-safe unique index: documentId_employeeId_organizationId_unique ✅`);
    console.log(`   Documents deleted: 0 (preserved for audit trail) ✅`);

  } catch (error) {
    console.error('❌ Error during index migration:', error.message);
    console.error('Stack:', error.stack);
    process.exit(1);
  } finally {
    try {
      await mongoose.connection.close();
      console.log('\n🔌 MongoDB connection closed');
    } catch (err) {
      console.error('Error closing connection:', err.message);
    }
  }
}

// Run the script
fixIndexes();
