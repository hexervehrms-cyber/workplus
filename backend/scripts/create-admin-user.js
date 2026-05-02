/**
 * Create Admin User Account
 * Creates a real admin user for the admin dashboard
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import bcrypt from 'bcrypt';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env from backend directory
dotenv.config({ path: path.join(__dirname, '../.env') });

async function createAdminUser() {
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
    
    // Admin credentials
    const adminEmail = 'admin@company.com';
    const adminPassword = 'Jadu@123';
    const adminName = 'Admin User';
    
    // Hash password
    const hashedPassword = await bcrypt.hash(adminPassword, 10);
    
    // Check if admin already exists
    const existingAdmin = await db.collection('users').findOne({ email: adminEmail });
    
    if (existingAdmin) {
      console.log('❌ Admin user already exists');
      console.log('Admin details:', {
        email: existingAdmin.email,
        name: existingAdmin.name,
        role: existingAdmin.role,
        isActive: existingAdmin.isActive
      });
      
      // Activate if not active
      if (!existingAdmin.isActive) {
        await db.collection('users').updateOne(
          { email: adminEmail },
          { $set: { isActive: true } }
        );
        console.log('✅ Admin user activated');
      }
    } else {
      // Create new admin user
      const adminUser = {
        name: adminName,
        email: adminEmail,
        password: hashedPassword,
        role: 'admin',
        isActive: true,
        organization: 'WorkPlus Inc.',
        avatar: null,
        phone: '+91-9876543210',
        address: 'Admin Office',
        createdAt: new Date(),
        updatedAt: new Date(),
        lastLogin: null,
        deletedAt: null
      };
      
      const result = await db.collection('users').insertOne(adminUser);
      console.log('✅ Admin user created successfully');
      console.log('Admin details:', {
        id: result.insertedId,
        email: adminEmail,
        name: adminName,
        role: 'admin',
        isActive: true
      });
    }
    
    // Also create an HR user
    const hrEmail = 'hr@company.com';
    const hrPassword = 'Jadu@123';
    const hrName = 'HR Manager';
    
    const hashedHRPassword = await bcrypt.hash(hrPassword, 10);
    
    const existingHR = await db.collection('users').findOne({ email: hrEmail });
    
    if (existingHR) {
      console.log('\n❌ HR user already exists');
      console.log('HR details:', {
        email: existingHR.email,
        name: existingHR.name,
        role: existingHR.role,
        isActive: existingHR.isActive
      });
      
      // Activate if not active
      if (!existingHR.isActive) {
        await db.collection('users').updateOne(
          { email: hrEmail },
          { $set: { isActive: true } }
        );
        console.log('✅ HR user activated');
      }
    } else {
      // Create new HR user
      const hrUser = {
        name: hrName,
        email: hrEmail,
        password: hashedHRPassword,
        role: 'hr',
        isActive: true,
        organization: 'WorkPlus Inc.',
        avatar: null,
        phone: '+91-9876543211',
        address: 'HR Department',
        createdAt: new Date(),
        updatedAt: new Date(),
        lastLogin: null,
        deletedAt: null
      };
      
      const result = await db.collection('users').insertOne(hrUser);
      console.log('\n✅ HR user created successfully');
      console.log('HR details:', {
        id: result.insertedId,
        email: hrEmail,
        name: hrName,
        role: 'hr',
        isActive: true
      });
    }
    
    console.log('\n================================================================================');
    console.log('LOGIN CREDENTIALS');
    console.log('================================================================================');
    console.log('\nAdmin Dashboard:');
    console.log('  Email: admin@company.com');
    console.log('  Password: Jadu@123');
    console.log('  Role: Admin');
    console.log('\nHR Dashboard:');
    console.log('  Email: hr@company.com');
    console.log('  Password: Jadu@123');
    console.log('  Role: HR');
    console.log('\nEmployee Dashboard:');
    console.log('  Email: harsh.gupta@hexerve.com');
    console.log('  Password: Jadu@123');
    console.log('  Role: Employee');
    console.log('================================================================================\n');

    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

createAdminUser();
