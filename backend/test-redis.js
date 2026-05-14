/**
 * Redis Connection Test
 * Run this script to verify Redis is working: node backend/test-redis.js
 */

import dotenv from 'dotenv';
import redis from './utils/redis.js';
import logger from './utils/logger.js';

dotenv.config({ path: './backend/.env' });

async function testRedis() {
  console.log('🔍 Testing Redis Connection...\n');
  
  // Initialize Redis
  await redis.initializeRedis();
  
  if (!redis.isRedisConnected()) {
    console.log('❌ Redis is NOT connected');
    console.log('   REDIS_URL:', process.env.REDIS_URL || 'NOT SET');
    process.exit(1);
  }
  
  console.log('✅ Redis is connected!\n');
  
  try {
    // Test 1: Set a value
    console.log('📝 Test 1: Setting a test value...');
    const testKey = 'test:redis:connection';
    const testValue = { message: 'Redis is working!', timestamp: new Date().toISOString() };
    
    const setSuccess = await redis.set(testKey, testValue, 60);
    if (setSuccess) {
      console.log('   ✅ Value set successfully\n');
    } else {
      console.log('   ❌ Failed to set value\n');
      process.exit(1);
    }
    
    // Test 2: Get the value
    console.log('📖 Test 2: Retrieving the test value...');
    const retrievedValue = await redis.get(testKey);
    if (retrievedValue && retrievedValue.message === 'Redis is working!') {
      console.log('   ✅ Value retrieved successfully');
      console.log('   Data:', JSON.stringify(retrievedValue, null, 2), '\n');
    } else {
      console.log('   ❌ Failed to retrieve value\n');
      process.exit(1);
    }
    
    // Test 3: Delete the value
    console.log('🗑️  Test 3: Deleting the test value...');
    const deleteSuccess = await redis.del(testKey);
    if (deleteSuccess) {
      console.log('   ✅ Value deleted successfully\n');
    } else {
      console.log('   ❌ Failed to delete value\n');
      process.exit(1);
    }
    
    // Test 4: Verify deletion
    console.log('🔍 Test 4: Verifying deletion...');
    const deletedValue = await redis.get(testKey);
    if (deletedValue === null) {
      console.log('   ✅ Value confirmed deleted\n');
    } else {
      console.log('   ❌ Value still exists\n');
      process.exit(1);
    }
    
    console.log('🎉 All Redis tests passed!\n');
    console.log('Redis Configuration:');
    console.log('  - URL:', process.env.REDIS_URL);
    console.log('  - Connected:', redis.isRedisConnected());
    console.log('  - Status: ✅ Ready for production\n');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    process.exit(1);
  }
}

testRedis();
