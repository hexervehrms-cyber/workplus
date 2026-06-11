/**
 * List all users from database (verbose output)
 * Usage: node list_users_verbose.js
 * 
 * Requires environment variables:
 * - MONGODB_URI: MongoDB connection string (from .env)
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';

// Load environment variables from .env
dotenv.config();

// Get MongoDB URI from environment
const MONGODB_URI = process.env.MONGODB_URI;

// Validate environment
if (!MONGODB_URI) {
  console.error('❌ ERROR: MONGODB_URI environment variable is not set');
  console.error('   Please set MONGODB_URI in your .env file');
  console.error('   Example: MONGODB_URI=mongodb+srv://user:pass@cluster.mongodb.net/db');
  process.exit(1);
}

async function listUsersVerbose() {
  try {
    await mongoose.connect(MONGODB_URI);
    const db = mongoose.connection.db;
    const users = await db.collection('users').find({}).toArray();
    
    console.log('\n👥 ALL USERS IN DB:');
    console.log('='.repeat(100));
    console.log(`${'Email'.padEnd(30)} | ${'Role'.padEnd(15)} | ${'Active'.padEnd(8)} | ${'OrgId'}`);
    console.log('-'.repeat(100));
    
    users.forEach(u => {
      console.log(`${(u.email || 'N/A').padEnd(30)} | ${(u.role || 'N/A').padEnd(15)} | ${(u.isActive ? 'YES' : 'NO').padEnd(8)} | ${u.orgId}`);
    });
    
    await mongoose.disconnect();
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

listUsersVerbose();
