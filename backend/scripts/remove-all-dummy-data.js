import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '../.env') });

async function removeAllDummyData() {
  try {
    const mongoUri = process.env.MONGODB_URI;
    console.log('MongoDB URI:', mongoUri ? 'Loaded' : 'NOT LOADED');
    
    if (!mongoUri) {
      throw new Error('MONGODB_URI not found in .env');
    }

    await mongoose.connect(mongoUri);
    console.log('✅ Connected to MongoDB\n');

    const db = mongoose.connection.db;
    
    // Keep only super admin users
    const superAdminEmails = [
      'superadmin@company.com',
      'admin@workpluspro.com'
    ];

    // Get all users
    const allUsers = await db.collection('users').find({}).toArray();
    console.log(`Total users before cleanup: ${allUsers.length}\n`);

    // Delete all users except super admin
    for (const user of allUsers) {
      if (!superAdminEmails.includes(user.email)) {
        const result = await db.collection('users').deleteOne({ _id: user._id });
        if (result.deletedCount > 0) {
          console.log(`✅ Deleted: ${user.name} (${user.email}) - Role: ${user.role}`);
        }
      } else {
        console.log(`✓ Kept: ${user.name} (${user.email}) - Role: ${user.role}`);
      }
    }

    // Get remaining users
    const remainingUsers = await db.collection('users').find({}).toArray();
    console.log(`\n✅ Cleanup complete!`);
    console.log(`Total users after cleanup: ${remainingUsers.length}\n`);
    console.log('Remaining users:');
    remainingUsers.forEach(user => {
      console.log(`  - ${user.name} (${user.email}) - Role: ${user.role}`);
    });

    console.log('\n✅ Now you can create real users with unique emails');

    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

removeAllDummyData();
