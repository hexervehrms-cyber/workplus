import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Expense from '../models/Expense.js';

dotenv.config({ path: '.env' });

async function fixExpenseAmounts() {
  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');

    // Find all expenses
    const expenses = await Expense.find({});
    console.log(`Found ${expenses.length} expenses`);

    let updated = 0;
    for (const expense of expenses) {
      const originalAmount = expense.amount;
      const numAmount = Number(expense.amount);
      
      if (originalAmount !== numAmount || typeof expense.amount !== 'number') {
        expense.amount = numAmount;
        await expense.save();
        console.log(`Fixed expense ${expense._id}: ${originalAmount} -> ${numAmount}`);
        updated++;
      }
    }

    console.log(`\nFixed ${updated} expenses`);
    console.log('All expenses now have correct amount types');

    await mongoose.connection.close();
    console.log('Database connection closed');
  } catch (error) {
    console.error('Error fixing expenses:', error);
    process.exit(1);
  }
}

fixExpenseAmounts();
