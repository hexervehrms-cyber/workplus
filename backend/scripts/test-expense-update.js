/**
 * Test script to debug expense update/delete issues
 * Run: node scripts/test-expense-update.js
 */

import fetch from 'node-fetch';
import dotenv from 'dotenv';

dotenv.config();

const API_BASE = 'http://localhost:5000/api';
const SUPER_ADMIN_EMAIL = 'superadmin@company.com';
const SUPER_ADMIN_PASSWORD = 'Jadu@123';

let authToken = '';
let userId = '';
let expenseId = '';

async function login() {
  console.log('\n=== STEP 1: LOGIN ===');
  try {
    const response = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: SUPER_ADMIN_EMAIL,
        password: SUPER_ADMIN_PASSWORD
      })
    });

    const data = await response.json();
    console.log('Login response:', data);

    if (!data.success) {
      throw new Error(`Login failed: ${data.message}`);
    }

    authToken = data.data.token;
    userId = data.data.user._id;
    console.log('✅ Login successful');
    console.log('Token:', authToken.substring(0, 20) + '...');
    console.log('User ID:', userId);
  } catch (error) {
    console.error('❌ Login failed:', error.message);
    process.exit(1);
  }
}

async function createExpense() {
  console.log('\n=== STEP 2: CREATE EXPENSE ===');
  try {
    const expenseData = {
      title: 'Test Expense ' + Date.now(),
      category: 'Travel',
      amount: 500,
      date: new Date().toISOString().split('T')[0],
      description: 'Test expense for debugging'
    };

    console.log('Creating expense:', expenseData);

    const response = await fetch(`${API_BASE}/expenses`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${authToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(expenseData)
    });

    const data = await response.json();
    console.log('Create response:', data);

    if (!data.success) {
      throw new Error(`Create failed: ${data.message}`);
    }

    expenseId = data.data._id;
    console.log('✅ Expense created');
    console.log('Expense ID:', expenseId);
    console.log('Expense userId:', data.data.userId);
    console.log('Expense status:', data.data.status);
  } catch (error) {
    console.error('❌ Create failed:', error.message);
    process.exit(1);
  }
}

async function updateExpense() {
  console.log('\n=== STEP 3: UPDATE EXPENSE ===');
  try {
    const updateData = {
      title: 'Updated Test Expense ' + Date.now(),
      amount: 750,
      category: 'Food'
    };

    console.log('Updating expense:', updateData);
    console.log('Expense ID:', expenseId);
    console.log('Auth Token:', authToken.substring(0, 20) + '...');

    const response = await fetch(`${API_BASE}/expenses/${expenseId}`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${authToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(updateData)
    });

    const data = await response.json();
    console.log('Update response status:', response.status);
    console.log('Update response:', data);

    if (!data.success) {
      throw new Error(`Update failed: ${data.message}`);
    }

    console.log('✅ Expense updated');
    console.log('Updated title:', data.data.title);
    console.log('Updated amount:', data.data.amount);
  } catch (error) {
    console.error('❌ Update failed:', error.message);
  }
}

async function deleteExpense() {
  console.log('\n=== STEP 4: DELETE EXPENSE ===');
  try {
    console.log('Deleting expense:', expenseId);
    console.log('Auth Token:', authToken.substring(0, 20) + '...');

    const response = await fetch(`${API_BASE}/expenses/${expenseId}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${authToken}`,
        'Content-Type': 'application/json'
      }
    });

    const data = await response.json();
    console.log('Delete response status:', response.status);
    console.log('Delete response:', data);

    if (!data.success) {
      throw new Error(`Delete failed: ${data.message}`);
    }

    console.log('✅ Expense deleted');
  } catch (error) {
    console.error('❌ Delete failed:', error.message);
  }
}

async function runTests() {
  console.log('🚀 Starting Expense Update/Delete Tests');
  console.log('API Base:', API_BASE);
  
  await login();
  await createExpense();
  await updateExpense();
  await deleteExpense();
  
  console.log('\n✅ All tests completed');
  console.log('\nCheck the backend console for detailed debug logs');
}

runTests().catch(error => {
  console.error('Test failed:', error);
  process.exit(1);
});
