import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '../.env') });

async function removeDummyUsers() {
  try {
    const mongoUri = process.env.MONGODB_URI;
    console.log('MongoDB URI:', mongoUri ? 'Loaded' : 'NOT LOADED');
    
    if (!mongoUri) {
      throw new Error('MONGODB_URI not found in .env');
    }

    await mongoose.connect(mongoUri);
    console.log('✅ Connected to MongoDB');

    const db = mongoose.connection.db;
    
    // Remove dummy admin users
    const dummyEmails = [
      'admin@company.com',
      'hr@company.com',
      'atul@hexerve.com'
    ];

    for (const email of dummyEmails) {
      const result = await db.collection('users').deleteOne({ email: email.toLowerCase() });
      if (result.deletedCount > 0) {
        console.log(`✅ Deleted user: ${email}`);
      } else {
        console.log(`ℹ️  User not found: ${email}`);
      }
    }

    console.log('\n✅ Dummy users removed successfully');
    console.log('\nNow you can create real users with unique emails');

    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

removeDummyUsers();
