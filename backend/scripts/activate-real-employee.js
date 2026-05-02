/**
 * Activate Real Employee User Account
 * Activates harsh.gupta@hexerve.com user account
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env from backend directory
dotenv.config({ path: path.join(__dirname, '../.env') });

async function activateEmployee() {
  try {
    const mongoUri = process.env.MONGODB_URI;
    console.log('MongoDB URI:', mongoUri ? 'Loaded' : 'NOT LOADED');
    
    if (!mongoUri) {
      throw new Error('MONGODB_URI not found in .env');
    }

    // Connect to MongoDB
    await mongoose.connect(mongoUri);
    console.log('✅ Connected to MongoDB');

    const db = mongoose.connection.db;
    
    // Update the user to be active
    const result = await db.collection('users').updateOne(
      { email: 'harsh.gupta@hexerve.com' },
      { $set: { isActive: true } }
    );

    console.log('Update result:', result);

    if (result.modifiedCount > 0) {
      console.log('✅ User activated successfully');
      
      // Verify the update
      const user = await db.collection('users').findOne({ email: 'harsh.gupta@hexerve.com' });
      console.log('User status:', {
        email: user.email,
        name: user.name,
        isActive: user.isActive
      });
    } else {
      console.log('❌ User not found or already active');
      
      // Check if user exists
      const user = await db.collection('users').findOne({ email: 'harsh.gupta@hexerve.com' });
      if (user) {
        console.log('User found:', {
          email: user.email,
          name: user.name,
          isActive: user.isActive
        });
      } else {
        console.log('User not found in database');
      }
    }

    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

activateEmployee();
