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
    
    // Connection pooling
    maxPoolSize: 10, // Maximum connections in pool
    minPoolSize: 1, // Minimum connections to maintain
    
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
    
    return true;
  } catch (err) {
    logger.error(`❌ DB Connection Error (Attempt ${retryAttempt + 1}/${MAX_RETRIES}):`, {
      message: err.message,
      name: err.name,
      code: err.code
    });
    
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
      return false;
    }
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
