/**
 * Clear login rate limit from database
 * Usage: node clear-rate-limit.js
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

async function clearRateLimit() {
  console.log('Clearing login rate limit...\n');
  
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Database connected\n');
    
    // Check if there's a rate limit collection
    const collections = await mongoose.connection.db.listCollections().toArray();
    console.log('Collections:', collections.map(c => c.name).join(', '));
    
    // Try to find and clear rate limit data
    const rateLimitCollection = mongoose.connection.collection('ratelimits');
    const count = await rateLimitCollection.countDocuments();
    console.log(`\nRate limit documents found: ${count}`);
    
    if (count > 0) {
      await rateLimitCollection.deleteMany({});
      console.log('✅ Cleared all rate limit documents');
    } else {
      console.log('No rate limit documents found');
    }
    
    // Also check for any IP-based rate limiting
    const ipRateLimit = mongoose.connection.collection('ipratelimits');
    const ipCount = await ipRateLimit.countDocuments();
    console.log(`\nIP rate limit documents found: ${ipCount}`);
    
    if (ipCount > 0) {
      await ipRateLimit.deleteMany({});
      console.log('✅ Cleared all IP rate limit documents');
    }
    
    console.log('\n✅ Rate limit cleared successfully!');
    console.log('You can now try logging in again.');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await mongoose.disconnect();
  }
}

clearRateLimit();
