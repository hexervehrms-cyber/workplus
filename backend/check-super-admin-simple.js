import dotenv from 'dotenv';
import mongoose from 'mongoose';
import User from './models/User.js';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '.env') });

async function check() {
  try {
    console.log('Connecting to MongoDB...');
    console.log('MONGODB_URI:', process.env.MONGODB_URI ? 'SET' : 'NOT SET');
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected');
    
    const superAdmin = await User.findOne({ 
      email: 'superadmin@company.com',
      role: 'super_admin'
    });
    
    if (superAdmin) {
      console.log('\n✅ Super Admin EXISTS:');
      console.log('   Email:', superAdmin.email);
      console.log('   Name:', superAdmin.name);
      console.log('   Role:', superAdmin.role);
      console.log('   Active:', superAdmin.isActive);
      console.log('\n📝 You can login with:');
      console.log('   Email: superadmin@company.com');
      console.log('   Password: Jadu@123');
    } else {
      console.log('\n❌ Super Admin DOES NOT EXIST');
      console.log('   Expected email: superadmin@company.com');
      console.log('   Expected password: Jadu@123');
      console.log('\n💡 Solution: Start the backend server to auto-seed');
      console.log('   Command: npm start');
    }
    
    process.exit(0);
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

check();
