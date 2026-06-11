/**
 * Backfill missing orgId in Employee records
 * 
 * This script finds Employee records missing orgId and populates them
 * from the related User.orgId field.
 * 
 * Usage:
 *   - Dry run (default):   node backfillEmployeeOrgId.js
 *   - Actual update:       DRY_RUN=false node backfillEmployeeOrgId.js
 */

import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import mongoose from 'mongoose';
import Employee from '../models/Employee.js';
import User from '../models/User.js';
import logger from '../utils/logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
dotenv.config({ path: path.join(__dirname, '..', '.env') });

const DRY_RUN = (process.env.DRY_RUN !== 'false');

if (!process.env.MONGODB_URI) {
  console.error('❌ MONGODB_URI not set in environment');
  process.exit(1);
}

async function backfillEmployeeOrgId() {
  try {
    console.log('🔌 Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI, {
      serverSelectionTimeoutMS: 15000
    });
    console.log('✅ Connected to MongoDB');

    // Count total employees
    const totalEmployees = await Employee.countDocuments({});
    console.log(`\n📊 Total employees in database: ${totalEmployees}`);

    // Find employees missing orgId
    const missingOrgId = await Employee.find({
      $or: [
        { orgId: null },
        { orgId: undefined },
        { orgId: '' }
      ]
    })
    .select('_id userId orgId')
    .lean();

    console.log(`⚠️  Employees missing orgId: ${missingOrgId.length}`);

    if (missingOrgId.length === 0) {
      console.log('✅ All employees have orgId set. No backfill needed.');
      await mongoose.connection.close();
      return;
    }

    // Extract user IDs
    const userIds = missingOrgId.map(emp => emp.userId);

    // Fetch related users
    const users = await User.find({ _id: { $in: userIds } })
      .select('_id orgId')
      .lean();

    console.log(`👥 Found ${users.length} related User records`);

    const userOrgMap = new Map();
    users.forEach(user => {
      userOrgMap.set(String(user._id), user.orgId);
    });

    // Prepare updates
    let matchedCount = 0;
    let skippedCount = 0;
    let updatedCount = 0;
    const updates = [];

    for (const employee of missingOrgId) {
      const userOrgId = userOrgMap.get(String(employee.userId));
      
      if (!userOrgId) {
        console.log(`  ⏭️  Skipped employee ${employee._id}: User not found`);
        skippedCount++;
        continue;
      }

      matchedCount++;
      
      if (!DRY_RUN) {
        updates.push({
          updateOne: {
            filter: { _id: employee._id },
            update: { $set: { orgId: userOrgId } }
          }
        });
      }
    }

    console.log(`\n📋 Backfill Summary:`);
    console.log(`   ✅ Matched employees: ${matchedCount}`);
    console.log(`   ⏭️  Skipped (user not found): ${skippedCount}`);

    if (DRY_RUN) {
      console.log(`\n🧪 DRY RUN MODE - No changes made`);
      console.log(`   Would update: ${matchedCount} employees`);
      console.log(`\n💡 To apply changes, run:`);
      console.log(`   DRY_RUN=false node ${path.basename(__filename)}`);
    } else {
      if (updates.length > 0) {
        const result = await Employee.bulkWrite(updates);
        updatedCount = result.modifiedCount;
        console.log(`\n✅ APPLIED - Updated ${updatedCount} employees with orgId`);
      } else {
        console.log(`\n✅ No updates to apply`);
      }
    }

    console.log(`\n📊 Final Status:`);
    console.log(`   Total employees: ${totalEmployees}`);
    console.log(`   Missing orgId (before): ${missingOrgId.length}`);
    console.log(`   Updated: ${updatedCount}`);
    console.log(`   Skipped: ${skippedCount}`);
    console.log(`   Remaining missing: ${missingOrgId.length - updatedCount}`);

  } catch (error) {
    console.error('❌ Error during backfill:', error.message);
    logger.error('Backfill error', { error: error.message });
    process.exit(1);
  } finally {
    await mongoose.connection.close();
    console.log('🔌 Disconnected from MongoDB');
  }
}

// Run the backfill
backfillEmployeeOrgId();
