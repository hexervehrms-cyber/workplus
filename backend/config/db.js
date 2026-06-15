/**
 * Database Connection with Production-Grade Stability
 * Features: Auto-reconnect, connection pooling, event handling, graceful degradation
 */

import mongoose from 'mongoose';
import logger from '../utils/logger.js';

// Connection state tracking
let isConnected = false;
let retryCount = 0;

const MAX_RETRIES = 10;
const INITIAL_RETRY_DELAY = 1000; // 1 second
const MAX_RETRY_DELAY = 30000; // 30 seconds

// Production-ready mongoose configuration
mongoose.set('bufferCommands', false); // Disable buffering - fail fast when DB unavailable

/**
 * Get connection options based on environment
 */
const getConnectionOptions = () => {
  const baseOptions = {
    // Server selection
    serverSelectionTimeoutMS: 15000, // 15 seconds to find a server
    socketTimeoutMS: 45000, // 45 seconds socket timeout
    connectTimeoutMS: 10000, // 10 seconds connection timeout
    
    // Connection pooling (scale via MONGO_MAX_POOL_SIZE on Render/multi-instance)
    maxPoolSize: parseInt(process.env.MONGO_MAX_POOL_SIZE || (process.env.NODE_ENV === 'production' ? '40' : '10'), 10),
    minPoolSize: parseInt(process.env.MONGO_MIN_POOL_SIZE || '2', 10),
    maxIdleTimeMS: 30_000,
    
    // Write concerns
    retryWrites: true,
    w: 'majority',
    
    // Heartbeat
    heartbeatFrequencyMS: 10000, // Check server every 10 seconds
  };

  return baseOptions;
};

/**
 * Setup connection event handlers
 */
const setupConnectionHandlers = () => {
  // Connection established
  mongoose.connection.on('connected', () => {
    isConnected = true;
    retryCount = 0;
    logger.info('✅ MongoDB connection established');
  });

  // Connection ready
  mongoose.connection.on('open', () => {
    logger.info('📊 MongoDB connection open and ready');
  });

  // Connection disconnected
  mongoose.connection.on('disconnected', () => {
    isConnected = false;
    logger.warn('⚠️  MongoDB disconnected');
    logger.info('Mongoose will automatically attempt to reconnect...');
  });

  // Connection error
  mongoose.connection.on('error', (err) => {
    logger.error('❌ MongoDB connection error:', {
      message: err.message,
      code: err.code,
      name: err.name
    });
    
    // Handle specific error types
    if (err.name === 'MongoNetworkError') {
      logger.error('Network error detected - check MongoDB Atlas/network connectivity');
    } else if (err.name === 'MongoTimeoutError') {
      logger.error('Connection timeout - MongoDB server may be overloaded');
    } else if (err.code === 18) {
      logger.error('Authentication failed - check MongoDB credentials');
    }
  });

  // Reconnection succeeded
  mongoose.connection.on('reconnected', () => {
    isConnected = true;
    logger.info('🔄 MongoDB reconnected successfully');
  });

  // Connection closed
  mongoose.connection.on('close', () => {
    isConnected = false;
    logger.info('MongoDB connection closed');
  });
};

/**
 * Connect to MongoDB with retry logic
 */
const connectDB = async (retryAttempt = 0) => {
  try {
    // Validate MongoDB URI
    if (!process.env.MONGODB_URI) {
      throw new Error('MONGODB_URI environment variable is not set');
    }

    // Parse and log connection details (without exposing password)
    const uriInfo = parseMongoURI(process.env.MONGODB_URI);
    
    if (retryAttempt === 0) {
      logger.info('MongoDB Connection Details:', {
        cluster: uriInfo.host,
        database: uriInfo.database,
        username: uriInfo.username,
        protocol: uriInfo.isSRV ? 'mongodb+srv (DNS SRV)' : 'mongodb (Direct)'
      });
      console.log(`📊 Cluster: ${uriInfo.host}`);
      console.log(`📊 Database: ${uriInfo.database}`);
      console.log(`📊 Username: ${uriInfo.username}`);
    }

    // Setup event handlers before connecting
    if (retryAttempt === 0) {
      setupConnectionHandlers();
    }

    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI, getConnectionOptions());
    
    isConnected = true;
    retryCount = 0;
    
    logger.info('✅ MongoDB Connected Successfully', {
      host: mongoose.connection.host,
      port: mongoose.connection.port,
      database: mongoose.connection.name
    });
    
    console.log(`✅ Connected to: ${mongoose.connection.host}`);
    console.log(`✅ Database: ${mongoose.connection.name}`);
    
    return true;
  } catch (err) {
    logger.error(`❌ DB Connection Error (Attempt ${retryAttempt + 1}/${MAX_RETRIES}):`, {
      message: err.message,
      name: err.name,
      code: err.code
    });
    
    // Provide helpful error messages
    if (err.message.includes('bad auth')) {
      logger.error('Authentication failed - check username/password');
      console.error('💡 Check: Database user credentials in MongoDB Atlas');
    } else if (err.message.includes('IP') || err.message.includes('whitelist')) {
      logger.error('IP whitelist issue - add 0.0.0.0/0 in Network Access');
      console.error('💡 Fix: MongoDB Atlas → Network Access → Add IP Address → ALLOW ACCESS FROM ANYWHERE');
    } else if (err.message.includes('ENOTFOUND')) {
      logger.error('Cluster not found - verify cluster name');
      console.error('💡 Check: Cluster exists in MongoDB Atlas and name is correct');
    } else if (err.message.includes('SSL') || err.message.includes('TLS')) {
      logger.error('SSL/TLS error - possible cluster configuration issue');
      console.error('💡 Check: MongoDB Atlas cluster is properly configured');
    }
    
    if (retryAttempt < MAX_RETRIES) {
      // Calculate exponential backoff delay
      const delay = Math.min(
        INITIAL_RETRY_DELAY * Math.pow(2, retryAttempt),
        MAX_RETRY_DELAY
      );
      
      logger.info(`⏳ Retrying in ${delay}ms...`);
      
      // Wait before retrying
      await new Promise(resolve => setTimeout(resolve, delay));
      
      // Retry connection
      return connectDB(retryAttempt + 1);
    } else {
      logger.error('❌ Max retries reached. Database connection failed.');
      logger.warn('⚠️  Server will start in degraded mode. Some features may not work.');
      console.error('');
      console.error('🔍 Run audit script for detailed diagnostics:');
      console.error('   node scripts/audit-mongodb-connection.js');
      console.error('');
      return false;
    }
  }
};

/**
 * Parse MongoDB URI to extract connection details
 */
const parseMongoURI = (uri) => {
  try {
    const cleanUri = uri.replace('mongodb+srv://', 'https://').replace('mongodb://', 'http://');
    const url = new URL(cleanUri);
    
    return {
      username: url.username,
      host: url.hostname,
      database: url.pathname.substring(1).split('?')[0] || 'test',
      isSRV: uri.startsWith('mongodb+srv://')
    };
  } catch (error) {
    return {
      username: 'unknown',
      host: 'unknown',
      database: 'unknown',
      isSRV: false
    };
  }
};

/**
 * Check if database is connected
 */
export const isDBConnected = () => {
  return mongoose.connection.readyState === 1;
};

/**
 * Get database connection status with details
 */
export const getDBStatus = () => {
  const states = {
    0: 'disconnected',
    1: 'connected',
    2: 'connecting',
    3: 'disconnecting',
  };
  
  const readyState = mongoose.connection.readyState;
  
  return {
    status: states[readyState] || 'unknown',
    readyState,
    host: mongoose.connection.host || 'N/A',
    port: mongoose.connection.port || 'N/A',
    database: mongoose.connection.name || 'N/A',
    retryCount,
    isConnected: readyState === 1
  };
};

/**
 * Get database connection for health checks
 */
export const getDBConnection = () => {
  return mongoose.connection;
};

/**
 * Gracefully close database connection
 */
export const closeDB = async () => {
  try {
    await mongoose.connection.close();
    logger.info('Database connection closed gracefully');
  } catch (error) {
    logger.error('Error closing database connection:', error.message);
  }
};

export default connectDB;
