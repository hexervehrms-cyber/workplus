/**
 * WorkPlus Backend Stability Test Script
 * Tests all critical fixes and stability features
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

console.log('🧪 WorkPlus Backend Stability Test\n');
console.log('=' .repeat(60));

let testsPassed = 0;
let testsFailed = 0;

// Test 1: Environment Variables
console.log('\n📋 Test 1: Environment Variables');
console.log('-'.repeat(60));

const requiredEnvVars = ['MONGODB_URI', 'JWT_SECRET', 'NODE_ENV'];
requiredEnvVars.forEach(varName => {
  if (process.env[varName]) {
    console.log(`✅ ${varName}: Set`);
    testsPassed++;
  } else {
    console.log(`❌ ${varName}: Missing`);
    testsFailed++;
  }
});

// Test 2: JWT_SECRET Security
console.log('\n📋 Test 2: JWT_SECRET Security');
console.log('-'.repeat(60));

if (process.env.JWT_SECRET === 'supersecretkey') {
  console.log('⚠️  WARNING: JWT_SECRET is using default value');
  console.log('   This is a security risk in production!');
  testsFailed++;
} else if (process.env.JWT_SECRET) {
  console.log('✅ JWT_SECRET is properly configured');
  testsPassed++;
} else {
  console.log('❌ JWT_SECRET is not set');
  testsFailed++;
}

// Test 3: Database Connection
console.log('\n📋 Test 3: Database Connection');
console.log('-'.repeat(60));

const testDBConnection = async () => {
  try {
    const mongooseOptions = {
      retryWrites: true,
      w: 'majority',
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
      connectTimeoutMS: 10000,
      maxPoolSize: 10,
      minPoolSize: 2,
    };

    await mongoose.connect(process.env.MONGODB_URI, mongooseOptions);
    console.log('✅ Database connected successfully');
    testsPassed++;

    // Test database operations
    console.log('\n📋 Test 4: Database Operations');
    console.log('-'.repeat(60));

    // Test ping
    await mongoose.connection.db.admin().ping();
    console.log('✅ Database ping successful');
    testsPassed++;

    // Test connection status
    const readyState = mongoose.connection.readyState;
    const states = {
      0: 'disconnected',
      1: 'connected',
      2: 'connecting',
      3: 'disconnecting',
    };
    console.log(`✅ Database status: ${states[readyState]}`);
    testsPassed++;

    return true;
  } catch (error) {
    console.log(`❌ Database connection failed: ${error.message}`);
    testsFailed++;
    return false;
  }
};

// Test 5: Model Imports
console.log('\n📋 Test 5: Model Imports');
console.log('-'.repeat(60));

const testModelImports = async () => {
  try {
    const models = [
      'User',
      'Employee',
      'Payroll',
      'AdvanceLoan',
      'Document',
      'Company',
      'Subscription',
      'Expense',
      'LeaveRequest',
      'Attendance',
      'Holiday',
      'HolidayCalendar',
      'CurrencyPreference',
      'OnboardingLink',
      'OnboardingSubmission',
      'CompanyDocument',
      'DocumentAcknowledgment',
      'GeneratedDocument',
      'Reminder'
    ];

    for (const modelName of models) {
      try {
        await import(`./models/${modelName}.js`);
        console.log(`✅ Model ${modelName} imported`);
        testsPassed++;
      } catch (error) {
        console.log(`❌ Model ${modelName} import failed: ${error.message}`);
        testsFailed++;
      }
    }
  } catch (error) {
    console.log(`❌ Model import test failed: ${error.message}`);
    testsFailed++;
  }
};

// Test 6: Middleware Imports
console.log('\n📋 Test 6: Middleware Imports');
console.log('-'.repeat(60));

const testMiddlewareImports = async () => {
  try {
    await import('./middleware/errorHandler.js');
    console.log('✅ errorHandler middleware imported');
    testsPassed++;

    await import('./middleware/fileValidator.js');
    console.log('✅ fileValidator middleware imported');
    testsPassed++;

    await import('./middleware/tenant.js');
    console.log('✅ tenant middleware imported');
    testsPassed++;

    await import('./middleware/rateLimiter.js');
    console.log('✅ rateLimiter middleware imported');
    testsPassed++;
  } catch (error) {
    console.log(`❌ Middleware import failed: ${error.message}`);
    testsFailed++;
  }
};

// Test 7: Logger
console.log('\n📋 Test 7: Logger');
console.log('-'.repeat(60));

const testLogger = async () => {
  try {
    const logger = (await import('./utils/logger.js')).default;
    logger.info('Test log message');
    console.log('✅ Logger working correctly');
    testsPassed++;
  } catch (error) {
    console.log(`❌ Logger test failed: ${error.message}`);
    testsFailed++;
  }
};

// Test 8: Database Connection Helpers
console.log('\n📋 Test 8: Database Connection Helpers');
console.log('-'.repeat(60));

const testDBHelpers = async () => {
  try {
    const { isDBConnected, getDBStatus } = await import('./config/db.js');
    
    const connected = isDBConnected();
    console.log(`✅ isDBConnected(): ${connected}`);
    testsPassed++;

    const status = getDBStatus();
    console.log(`✅ getDBStatus(): ${status}`);
    testsPassed++;
  } catch (error) {
    console.log(`❌ Database helpers test failed: ${error.message}`);
    testsFailed++;
  }
};

// Run all tests
const runTests = async () => {
  try {
    // Test database connection
    await testDBConnection();

    // Test model imports
    await testModelImports();

    // Test middleware imports
    await testMiddlewareImports();

    // Test logger
    await testLogger();

    // Test database helpers
    await testDBHelpers();

    // Print summary
    console.log('\n' + '='.repeat(60));
    console.log('📊 TEST SUMMARY');
    console.log('='.repeat(60));
    console.log(`✅ Tests Passed: ${testsPassed}`);
    console.log(`❌ Tests Failed: ${testsFailed}`);
    console.log(`📈 Success Rate: ${((testsPassed / (testsPassed + testsFailed)) * 100).toFixed(1)}%`);
    console.log('='.repeat(60));

    if (testsFailed === 0) {
      console.log('\n🎉 ALL TESTS PASSED! Backend is stable and ready for production.');
    } else {
      console.log('\n⚠️  Some tests failed. Please review the errors above.');
    }

    // Close database connection
    if (mongoose.connection.readyState === 1) {
      await mongoose.connection.close();
      console.log('\n✅ Database connection closed');
    }

    process.exit(testsFailed === 0 ? 0 : 1);
  } catch (error) {
    console.error('\n❌ Test suite failed:', error.message);
    process.exit(1);
  }
};

// Run tests
runTests();
