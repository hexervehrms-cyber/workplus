/**
 * Diagnose User.orgId and Employee.orgId consistency
 * SAFE: Read-only diagnostic - no database modifications
 * Usage: node backend/scripts/diagnoseOrgIdConsistency.js
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

if (!process.env.MONGODB_URI) {
  console.error('❌ MONGODB_URI not set in environment');
  process.exit(1);
}

async function diagnoseOrgIdConsistency() {
  try {
    console.log('🔍 [ORG ID CONSISTENCY CHECK]');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
    // Connect to MongoDB
    console.log('🔌 Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI, {
      serverSelectionTimeoutMS: 5000,
    });
    console.log('✅ Connected to MongoDB');
    
    // Fetch all employees
    console.log('\n📊 Fetching all employees...');
    const employees = await Employee.find({}).select('_id userId orgId status').lean();
    console.log(`✅ Found ${employees.length} employees`);
    
    if (employees.length === 0) {
      console.log('\n⚠️  No employees found in database');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('\nRESULTS:');
      console.log(`TOTAL EMPLOYEES: 0`);
      console.log(`MATCHED: 0`);
      console.log(`MISMATCHED: 0`);
      console.log(`MISSING USERS: 0`);
      console.log(`SAFE TO PROCEED: YES`);
      await mongoose.connection.close();
      return;
    }
    
    // Check consistency
    console.log('\n🔍 Checking orgId consistency...');
    let matched = 0;
    let mismatched = 0;
    let missingUsers = 0;
    const mismatchedRecords = [];
    const missingUserRecords = [];
    
    for (const employee of employees) {
      if (!employee.userId) {
        console.log(`⚠️  Employee ${employee._id} has no userId`);
        missingUsers++;
        missingUserRecords.push({
          employeeId: String(employee._id),
          issue: 'No userId'
        });
        continue;
      }
      
      const user = await User.findById(employee.userId).select('_id orgId').lean();
      
      if (!user) {
        console.log(`⚠️  Employee ${employee._id} has userId but user not found`);
        missingUsers++;
        missingUserRecords.push({
          employeeId: String(employee._id),
          userId: String(employee.userId),
          issue: 'User not found'
        });
        continue;
      }
      
      const employeeOrgId = String(employee.orgId || '');
      const userOrgId = String(user.orgId || '');
      
      if (employeeOrgId === userOrgId) {
        matched++;
      } else {
        mismatched++;
        mismatchedRecords.push({
          employeeId: String(employee._id),
          userId: String(user._id),
          employeeOrgId,
          userOrgId,
          employeeStatus: employee.status
        });
        console.log(`❌ MISMATCH - Employee ${employee._id}:`);
        console.log(`   Employee.orgId: ${employeeOrgId}`);
        console.log(`   User.orgId: ${userOrgId}`);
      }
    }
    
    // Print summary
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('\nRESULTS:');
    console.log(`TOTAL EMPLOYEES: ${employees.length}`);
    console.log(`MATCHED: ${matched}`);
    console.log(`MISMATCHED: ${mismatched}`);
    console.log(`MISSING USERS: ${missingUsers}`);
    
    if (mismatched > 0) {
      console.log('\n⚠️  MISMATCHED RECORDS (Employee ID → User ID):');
      for (const record of mismatchedRecords) {
        console.log(`  ${record.employeeId} → ${record.userId}`);
        console.log(`    Employee.orgId: ${record.employeeOrgId}, User.orgId: ${record.userOrgId}`);
      }
      console.log('\n🔴 SAFE TO PROCEED: NO - Data cleanup required');
    } else if (missingUsers > 0) {
      console.log('\n⚠️  MISSING USER RECORDS (Employee ID):');
      for (const record of missingUserRecords) {
        console.log(`  ${record.employeeId} (userId: ${record.userId || 'N/A'}, ${record.issue})`);
      }
      console.log('\n🟡 SAFE TO PROCEED: CAUTION - Missing users but no org mismatch');
    } else {
      console.log('\n✅ SAFE TO PROCEED: YES - All orgIds consistent');
    }
    
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    
    await mongoose.connection.close();
    process.exit(0);
  } catch (error) {
    console.error('❌ Error during consistency check:', error.message);
    logger.error('Consistency check failed', { error: error.message });
    await mongoose.connection.close();
    process.exit(1);
  }
}

diagnoseOrgIdConsistency();
