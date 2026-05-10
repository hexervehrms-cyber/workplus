/**
 * Clear login rate limit from database
 */

import mongoose from 'mongoose';

const MONGODB_URI = 'mongodb+srv://atulcse08_db_user:Jadu%40123@workplus.tcf4qho.mongodb.net/workpluspro?retryWrites=true&w=majority';

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
