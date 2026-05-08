#!/usr/bin/env node

/**
 * Check Expenses in Database
 * Lists all expenses to verify data exists
 */

import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import mongoose from 'mongoose';

// Setup __dirname for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables from backend/.env
const envPath = path.join(__dirname, '..', '.env');
console.log('📝 Loading environment from:', envPath);
dotenv.config({ path: envPath });

// Import Expense model
import Expense from '../models/Expense.js';

const checkExpenses = async () => {
  try {
    console.log('\n🚀 Checking Expenses in Database...\n');

    const mongoUri = process.env.MONGODB_URI;

    if (!mongoUri) {
      console.error('❌ Missing MONGODB_URI');
      process.exit(1);
    }

    // Connect to MongoDB
    console.log('🔗 Connecting to MongoDB...');
    await mongoose.connect(mongoUri, {
      serverSelectionTimeoutMS: 10000,
      socketTimeoutMS: 45000,
    });
    console.log('✅ Connected to MongoDB\n');

    // Count total expenses
    const totalExpenses = await Expense.countDocuments({});
    console.log(`📊 Total Expenses: ${totalExpenses}\n`);

    if (totalExpenses === 0) {
      console.log('ℹ️  No expenses found in database');
      await mongoose.disconnect();
      console.log('\n✅ Check complete!\n');
      process.exit(0);
    }

    // Get all expenses without populate
    const expenses = await Expense.find({})
      .sort({ createdAt: -1 })
      .limit(20);

    console.log('📋 Recent Expenses:\n');
    console.log('ID                       | Amount | Status    | Category                    | Date');
    console.log('─'.repeat(100));

    expenses.forEach(expense => {
      const id = expense._id.toString().substring(0, 23);
      const amount = (expense.amount || 0).toString().padEnd(6);
      const status = (expense.status || 'pending').padEnd(9);
      const category = (expense.category || 'N/A').substring(0, 27).padEnd(27);
      const date = new Date(expense.date).toLocaleDateString('en-IN');
      
      console.log(`${id} | ${amount} | ${status} | ${category} | ${date}`);
    });

    // Summary by status
    console.log('\n📈 Summary by Status:');
    const statuses = ['pending', 'approved', 'rejected'];
    
    for (const status of statuses) {
      const count = await Expense.countDocuments({ status });
      const total = await Expense.aggregate([
        { $match: { status } },
        { $group: { _id: null, total: { $sum: '$amount' } } }
      ]);
      
      const totalAmount = total[0]?.total || 0;
      console.log(`   ${status}: ${count} expenses (₹${totalAmount.toLocaleString('en-IN')})`);
    }

    // Summary by user
    console.log('\n👥 Summary by User:');
    const userSummary = await Expense.aggregate([
      {
        $group: {
          _id: '$userId',
          count: { $sum: 1 },
          total: { $sum: '$amount' }
        }
      },
      { $sort: { total: -1 } },
      { $limit: 10 }
    ]);

    for (const user of userSummary) {
      console.log(`   User ${user._id}: ${user.count} expenses (₹${user.total.toLocaleString('en-IN')})`);
    }

    // Disconnect
    await mongoose.disconnect();
    console.log('\n✅ Check complete!\n');
    process.exit(0);

  } catch (error) {
    console.error('\n❌ Error:');
    console.error('   Message:', error.message);
    console.error('   Stack:', error.stack);
    
    try {
      await mongoose.disconnect();
    } catch (disconnectError) {
      console.error('   Disconnect error:', disconnectError.message);
    }
    
    process.exit(1);
  }
};

// Run check
checkExpenses();
