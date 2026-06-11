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
    
    // Admin credentials from environment or defaults for demo
    const adminEmail = process.env.ADMIN_EMAIL || 'admin@company.com';
    const adminPassword = process.env.ADMIN_PASSWORD;
    const adminName = 'Admin User';
    
    if (!adminPassword) {
      console.error('❌ ERROR: ADMIN_PASSWORD not set');
      console.error('   Set ADMIN_PASSWORD in .env file for admin creation');
      throw new Error('Missing ADMIN_PASSWORD');
    }
    
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
    
    // HR credentials from environment or defaults for demo
    const hrEmail = process.env.HR_EMAIL || 'hr@company.com';
    const hrPassword = process.env.HR_PASSWORD;
    const hrName = 'HR Manager';
    
    if (!hrPassword) {
      console.error('❌ ERROR: HR_PASSWORD not set');
      console.error('   Set HR_PASSWORD in .env file for HR user creation');
      throw new Error('Missing HR_PASSWORD');
    }
    
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
    console.log('  Email: ' + adminEmail);
    console.log('  Password: <use ADMIN_PASSWORD from .env>');
    console.log('  Role: Admin');
    console.log('\nHR Dashboard:');
    console.log('  Email: ' + hrEmail);
    console.log('  Password: <use HR_PASSWORD from .env>');
    console.log('  Role: HR');
    console.log('\nEmployee Dashboard:');
    console.log('  Email: harsh.gupta@hexerve.com');
    console.log('  Password: <set in Employee credentials>');
    console.log('  Role: Employee');
    console.log('================================================================================\n');

    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

createAdminUser();
