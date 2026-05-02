/**
 * MongoDB Connection Audit Script for WorkPlus Pro
 * 
 * This script verifies:
 * 1. MongoDB URI format and parsing
 * 2. Cluster connectivity
 * 3. Database user authentication
 * 4. Database and collection access
 * 5. Network configuration
 * 
 * Usage: node scripts/audit-mongodb-connection.js
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { URL } from 'url';

dotenv.config();

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

const log = {
  info: (msg) => console.log(`${colors.blue}ℹ${colors.reset} ${msg}`),
  success: (msg) => console.log(`${colors.green}✅${colors.reset} ${msg}`),
  error: (msg) => console.log(`${colors.red}❌${colors.reset} ${msg}`),
  warn: (msg) => console.log(`${colors.yellow}⚠️${colors.reset}  ${msg}`),
  section: (msg) => console.log(`\n${colors.cyan}${colors.bright}${'='.repeat(70)}${colors.reset}`),
  title: (msg) => console.log(`${colors.cyan}${colors.bright}${msg}${colors.reset}`),
};

let testsPassed = 0;
let testsFailed = 0;

/**
 * Parse MongoDB URI and extract components
 */
function parseMongoURI(uri) {
  try {
    // Remove mongodb+srv:// or mongodb:// prefix for parsing
    const cleanUri = uri.replace('mongodb+srv://', 'https://').replace('mongodb://', 'http://');
    const parsed = new URL(cleanUri);
    
    // Extract components
    const username = parsed.username;
    const password = decodeURIComponent(parsed.password);
    const host = parsed.hostname;
    const database = parsed.pathname.substring(1).split('?')[0];
    
    // Extract query parameters
    const params = {};
    parsed.searchParams.forEach((value, key) => {
      params[key] = value;
    });
    
    return {
      username,
      password,
      host,
      database,
      params,
      isSRV: uri.startsWith('mongodb+srv://'),
    };
  } catch (error) {
    return null;
  }
}

/**
 * Test 1: Verify MongoDB URI exists and is valid
 */
async function test1_VerifyURI() {
  log.section();
  log.title('TEST 1: MongoDB URI Verification');
  log.section();
  
  const uri = process.env.MONGODB_URI;
  
  if (!uri) {
    log.error('MONGODB_URI environment variable is not set');
    testsFailed++;
    return null;
  }
  
  log.success('MONGODB_URI environment variable exists');
  
  const parsed = parseMongoURI(uri);
  
  if (!parsed) {
    log.error('Failed to parse MongoDB URI');
    testsFailed++;
    return null;
  }
  
  log.success('MongoDB URI is valid and parseable');
  console.log('');
  log.info(`Protocol: ${parsed.isSRV ? 'mongodb+srv' : 'mongodb'} (${parsed.isSRV ? 'DNS SRV' : 'Direct'})`);
  log.info(`Cluster Host: ${parsed.host}`);
  log.info(`Database Name: ${parsed.database || '(default)'}`);
  log.info(`Username: ${parsed.username}`);
  log.info(`Password: ${'*'.repeat(parsed.password.length)} (${parsed.password.length} chars)`);
  
  if (Object.keys(parsed.params).length > 0) {
    log.info('Connection Parameters:');
    Object.entries(parsed.params).forEach(([key, value]) => {
      console.log(`  - ${key}: ${value}`);
    });
  }
  
  testsPassed++;
  return parsed;
}

/**
 * Test 2: Test DNS resolution for SRV record
 */
async function test2_DNSResolution(parsed) {
  log.section();
  log.title('TEST 2: DNS Resolution');
  log.section();
  
  if (!parsed) {
    log.warn('Skipping - URI parsing failed');
    return;
  }
  
  if (!parsed.isSRV) {
    log.info('Using direct connection (not SRV), skipping DNS test');
    testsPassed++;
    return;
  }
  
  log.info(`Checking DNS SRV record for: ${parsed.host}`);
  
  try {
    const dns = await import('dns');
    const { promises: dnsPromises } = dns;
    
    const records = await dnsPromises.resolveSrv(`_mongodb._tcp.${parsed.host}`);
    
    if (records && records.length > 0) {
      log.success(`DNS SRV record found with ${records.length} server(s)`);
      records.forEach((record, i) => {
        console.log(`  Server ${i + 1}: ${record.name}:${record.port} (priority: ${record.priority})`);
      });
      testsPassed++;
    } else {
      log.error('No DNS SRV records found');
      testsFailed++;
    }
  } catch (error) {
    log.error(`DNS resolution failed: ${error.message}`);
    log.warn('This could indicate:');
    console.log('  - Cluster name is incorrect');
    console.log('  - Cluster has been deleted');
    console.log('  - Network/DNS issues');
    testsFailed++;
  }
}

/**
 * Test 3: Attempt MongoDB connection
 */
async function test3_MongoDBConnection(parsed) {
  log.section();
  log.title('TEST 3: MongoDB Connection');
  log.section();
  
  if (!parsed) {
    log.warn('Skipping - URI parsing failed');
    return false;
  }
  
  log.info('Attempting to connect to MongoDB...');
  
  const connectionOptions = {
    serverSelectionTimeoutMS: 10000,
    socketTimeoutMS: 45000,
    connectTimeoutMS: 10000,
  };
  
  try {
    await mongoose.connect(process.env.MONGODB_URI, connectionOptions);
    
    log.success('Successfully connected to MongoDB!');
    console.log('');
    log.info(`Connected to: ${mongoose.connection.host}`);
    log.info(`Database: ${mongoose.connection.name}`);
    log.info(`Port: ${mongoose.connection.port || 'N/A'}`);
    log.info(`Ready State: ${mongoose.connection.readyState} (1 = connected)`);
    
    testsPassed++;
    return true;
  } catch (error) {
    log.error(`Connection failed: ${error.message}`);
    console.log('');
    
    // Provide specific guidance based on error
    if (error.message.includes('bad auth')) {
      log.warn('Authentication failed. Possible causes:');
      console.log('  - Username or password is incorrect');
      console.log('  - User does not exist in the database');
      console.log('  - User does not have permission to access this database');
      console.log('  - Password contains special characters not properly URL-encoded');
    } else if (error.message.includes('IP') || error.message.includes('whitelist')) {
      log.warn('IP whitelist issue. Possible causes:');
      console.log('  - Current IP is not whitelisted in MongoDB Atlas');
      console.log('  - Network Access settings are in wrong project');
      console.log('  - 0.0.0.0/0 is not added to IP whitelist');
    } else if (error.message.includes('ENOTFOUND') || error.message.includes('getaddrinfo')) {
      log.warn('DNS/Network issue. Possible causes:');
      console.log('  - Cluster name is incorrect');
      console.log('  - Cluster does not exist');
      console.log('  - Network connectivity issues');
    } else if (error.message.includes('SSL') || error.message.includes('TLS')) {
      log.warn('SSL/TLS issue. Possible causes:');
      console.log('  - MongoDB Atlas cluster configuration issue');
      console.log('  - Node.js version incompatibility');
      console.log('  - Certificate validation failure');
    }
    
    testsFailed++;
    return false;
  }
}

/**
 * Test 4: Verify database access
 */
async function test4_DatabaseAccess(connected) {
  log.section();
  log.title('TEST 4: Database Access');
  log.section();
  
  if (!connected) {
    log.warn('Skipping - Not connected to MongoDB');
    return;
  }
  
  try {
    // Test database ping
    await mongoose.connection.db.admin().ping();
    log.success('Database ping successful');
    
    // List databases
    const adminDb = mongoose.connection.db.admin();
    const { databases } = await adminDb.listDatabases();
    
    log.success(`Can access database list (${databases.length} databases)`);
    
    const currentDb = mongoose.connection.name;
    const dbExists = databases.some(db => db.name === currentDb);
    
    if (dbExists) {
      log.success(`Target database '${currentDb}' exists`);
    } else {
      log.warn(`Target database '${currentDb}' does not exist yet (will be created on first write)`);
    }
    
    testsPassed++;
  } catch (error) {
    log.error(`Database access failed: ${error.message}`);
    testsFailed++;
  }
}

/**
 * Test 5: Verify collections access
 */
async function test5_CollectionsAccess(connected) {
  log.section();
  log.title('TEST 5: Collections Access');
  log.section();
  
  if (!connected) {
    log.warn('Skipping - Not connected to MongoDB');
    return;
  }
  
  try {
    const collections = await mongoose.connection.db.listCollections().toArray();
    
    log.success(`Can access collections (${collections.length} collections found)`);
    
    if (collections.length > 0) {
      console.log('');
      log.info('Existing collections:');
      collections.forEach(col => {
        console.log(`  - ${col.name}`);
      });
    } else {
      log.info('No collections exist yet (database is empty)');
    }
    
    testsPassed++;
  } catch (error) {
    log.error(`Collections access failed: ${error.message}`);
    testsFailed++;
  }
}

/**
 * Test 6: Test write operation
 */
async function test6_WriteOperation(connected) {
  log.section();
  log.title('TEST 6: Write Operation Test');
  log.section();
  
  if (!connected) {
    log.warn('Skipping - Not connected to MongoDB');
    return;
  }
  
  try {
    const testCollection = mongoose.connection.db.collection('_connection_test');
    
    // Insert test document
    const testDoc = {
      test: true,
      timestamp: new Date(),
      message: 'Connection audit test',
    };
    
    const result = await testCollection.insertOne(testDoc);
    log.success('Write operation successful');
    log.info(`Inserted document with ID: ${result.insertedId}`);
    
    // Clean up test document
    await testCollection.deleteOne({ _id: result.insertedId });
    log.success('Test document cleaned up');
    
    testsPassed++;
  } catch (error) {
    log.error(`Write operation failed: ${error.message}`);
    log.warn('User may not have write permissions');
    testsFailed++;
  }
}

/**
 * Test 7: Connection pool test
 */
async function test7_ConnectionPool(connected) {
  log.section();
  log.title('TEST 7: Connection Pool');
  log.section();
  
  if (!connected) {
    log.warn('Skipping - Not connected to MongoDB');
    return;
  }
  
  try {
    const client = mongoose.connection.getClient();
    
    log.success('Connection pool is active');
    log.info('Connection pool configuration:');
    console.log(`  - Max Pool Size: ${client.options?.maxPoolSize || 'default'}`);
    console.log(`  - Min Pool Size: ${client.options?.minPoolSize || 'default'}`);
    
    testsPassed++;
  } catch (error) {
    log.error(`Connection pool check failed: ${error.message}`);
    testsFailed++;
  }
}

/**
 * Generate recommendations
 */
function generateRecommendations(parsed, connected) {
  log.section();
  log.title('RECOMMENDATIONS');
  log.section();
  
  console.log('');
  
  if (!connected) {
    log.warn('CRITICAL: Cannot connect to MongoDB. Follow these steps:');
    console.log('');
    console.log('1. VERIFY CLUSTER EXISTS:');
    console.log('   - Go to: https://cloud.mongodb.com/');
    console.log('   - Check if cluster "workplus" exists');
    console.log(`   - Verify cluster hostname: ${parsed?.host || 'N/A'}`);
    console.log('');
    console.log('2. VERIFY CORRECT PROJECT:');
    console.log('   - In MongoDB Atlas, check project dropdown (top-left)');
    console.log('   - Ensure you\'re in the correct project');
    console.log('   - Network Access settings are project-specific');
    console.log('');
    console.log('3. VERIFY DATABASE USER:');
    console.log('   - Go to: Database Access');
    console.log(`   - Check if user "${parsed?.username || 'N/A'}" exists`);
    console.log('   - Verify user has "Read and write to any database" role');
    console.log('   - Check password is correct');
    console.log('');
    console.log('4. WHITELIST IP ADDRESS:');
    console.log('   - Go to: Network Access');
    console.log('   - Click: Add IP Address');
    console.log('   - Click: ALLOW ACCESS FROM ANYWHERE');
    console.log('   - This adds: 0.0.0.0/0');
    console.log('   - Click: Confirm');
    console.log('   - Wait 1-2 minutes for changes to apply');
    console.log('');
    console.log('5. TEST CONNECTION:');
    console.log('   - Run this script again: node scripts/audit-mongodb-connection.js');
    console.log('   - Or start the server: node server.js');
  } else {
    log.success('Connection is working! No critical issues found.');
    console.log('');
    log.info('Optional improvements:');
    console.log('  - Ensure 0.0.0.0/0 is whitelisted for Render deployment');
    console.log('  - Verify database user has appropriate permissions');
    console.log('  - Consider setting up database indexes for performance');
  }
}

/**
 * Main audit function
 */
async function runAudit() {
  console.log('');
  log.section();
  log.title('🔍 MONGODB CONNECTION AUDIT - WORKPLUS PRO');
  log.section();
  console.log('');
  log.info('This audit will verify your MongoDB Atlas configuration');
  console.log('');
  
  // Run tests
  const parsed = await test1_VerifyURI();
  await test2_DNSResolution(parsed);
  const connected = await test3_MongoDBConnection(parsed);
  await test4_DatabaseAccess(connected);
  await test5_CollectionsAccess(connected);
  await test6_WriteOperation(connected);
  await test7_ConnectionPool(connected);
  
  // Generate recommendations
  generateRecommendations(parsed, connected);
  
  // Print summary
  log.section();
  log.title('AUDIT SUMMARY');
  log.section();
  console.log('');
  
  const total = testsPassed + testsFailed;
  const percentage = total > 0 ? Math.round((testsPassed / total) * 100) : 0;
  
  console.log(`Tests Passed: ${colors.green}${testsPassed}${colors.reset}`);
  console.log(`Tests Failed: ${colors.red}${testsFailed}${colors.reset}`);
  console.log(`Success Rate: ${percentage >= 80 ? colors.green : colors.red}${percentage}%${colors.reset}`);
  console.log('');
  
  if (testsFailed === 0) {
    log.success('ALL TESTS PASSED! MongoDB connection is fully functional.');
  } else if (connected) {
    log.warn('Some tests failed, but basic connection works.');
  } else {
    log.error('CRITICAL: Cannot connect to MongoDB. See recommendations above.');
  }
  
  console.log('');
  log.section();
  
  // Close connection
  if (mongoose.connection.readyState === 1) {
    await mongoose.connection.close();
    log.info('Connection closed');
  }
  
  process.exit(testsFailed === 0 ? 0 : 1);
}

// Run the audit
runAudit().catch(error => {
  console.error('');
  log.error(`Audit failed with error: ${error.message}`);
  console.error(error.stack);
  process.exit(1);
});
