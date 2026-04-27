import mongoose from "mongoose";

/**
 * Database Connection with Retry Logic
 * Implements exponential backoff for resilience
 */

const MAX_RETRIES = 5;
const INITIAL_RETRY_DELAY = 1000; // 1 second
const MAX_RETRY_DELAY = 30000; // 30 seconds

let retryCount = 0;

const connectDB = async (retryAttempt = 0) => {
  try {
    // Validate MongoDB URI
    if (!process.env.MONGODB_URI) {
      throw new Error('MONGODB_URI environment variable is not set');
    }

    // Configure mongoose connection options
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
    
    console.log("✅ MongoDB Connected Successfully");
    retryCount = 0; // Reset retry count on successful connection
    
    // Set up connection event handlers
    mongoose.connection.on('disconnected', () => {
      console.warn('⚠️  MongoDB disconnected');
    });

    mongoose.connection.on('error', (err) => {
      console.error('❌ MongoDB connection error:', err.message);
    });

    return true;
  } catch (err) {
    console.error(`❌ DB Connection Error (Attempt ${retryAttempt + 1}/${MAX_RETRIES}):`, err.message);
    
    if (retryAttempt < MAX_RETRIES) {
      // Calculate exponential backoff delay
      const delay = Math.min(
        INITIAL_RETRY_DELAY * Math.pow(2, retryAttempt),
        MAX_RETRY_DELAY
      );
      
      console.log(`⏳ Retrying in ${delay}ms...`);
      
      // Wait before retrying
      await new Promise(resolve => setTimeout(resolve, delay));
      
      // Retry connection
      return connectDB(retryAttempt + 1);
    } else {
      console.error('❌ Max retries reached. Database connection failed.');
      console.error('⚠️  Server will start in degraded mode. Some features may not work.');
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
 * Get database connection status
 */
export const getDBStatus = () => {
  const states = {
    0: 'disconnected',
    1: 'connected',
    2: 'connecting',
    3: 'disconnecting',
  };
  return states[mongoose.connection.readyState] || 'unknown';
};

export default connectDB;

