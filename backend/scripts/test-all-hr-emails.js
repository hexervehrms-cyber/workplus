#!/usr/bin/env node

/**
 * Test All HR Email Notifications
 * Tests check-in, check-out, leave submission/approval, expense submission/approval
 */

import dotenv from 'dotenv';
import EmailNotificationService from '../utils/emailNotificationService.js';
import logger from '../utils/logger.js';

dotenv.config();

const HR_EMAIL = process.env.HR_EMAIL || 'hr@hexerve.com';

// Test data
const testEmployee = {
  _id: '507f1f77bcf86cd799439011',
  name: 'Abhishek Rajput',
  email: 'abhishek.rajput@hexerve.com',
  employeeCode: 'EMP001',
  department: 'Engineering'
};

const testLeaveRequest = {
  _id: '507f1f77bcf86cd799439012',
  type: 'Sick Leave',
  startDate: new Date('2025-05-15'),
  endDate: new Date('2025-05-16'),
  reason: 'Medical appointment'
};

const testExpense = {
  _id: '507f1f77bcf86cd799439013',
  title: 'Office Supplies',
  amount: 5000,
  category: 'Supplies',
  description: 'Purchased office stationery'
};

const testApprover = {
  _id: '507f1f77bcf86cd799439014',
  name: 'Admin User'
};

async function testCheckInEmail() {
  console.log('\n📧 Testing Check-In Email to HR...');
  try {
    await EmailNotificationService.sendCheckInNotificationToHR(
      testEmployee,
      new Date(),
      HR_EMAIL
    );
    console.log('✅ Check-In email sent successfully');
  } catch (error) {
    console.error('❌ Check-In email failed:', error.message);
  }
}

async function testCheckOutEmail() {
  console.log('\n📧 Testing Check-Out Email to HR...');
  try {
    await EmailNotificationService.sendCheckOutNotificationToHR(
      testEmployee,
      new Date(),
      8.5, // hours worked
      HR_EMAIL
    );
    console.log('✅ Check-Out email sent successfully');
  } catch (error) {
    console.error('❌ Check-Out email failed:', error.message);
  }
}

async function testLeaveSubmittedEmail() {
  console.log('\n📧 Testing Leave Submitted Email to HR...');
  try {
    await EmailNotificationService.sendLeaveRequestSubmittedToHR(
      testEmployee,
      testLeaveRequest,
      HR_EMAIL
    );
    console.log('✅ Leave Submitted email sent successfully');
  } catch (error) {
    console.error('❌ Leave Submitted email failed:', error.message);
  }
}

async function testLeaveApprovedEmail() {
  console.log('\n📧 Testing Leave Approved Email to HR...');
  try {
    await EmailNotificationService.sendLeaveApprovedToHR(
      testEmployee,
      testLeaveRequest,
      testApprover,
      HR_EMAIL
    );
    console.log('✅ Leave Approved email sent successfully');
  } catch (error) {
    console.error('❌ Leave Approved email failed:', error.message);
  }
}

async function testExpenseSubmittedEmail() {
  console.log('\n📧 Testing Expense Submitted Email to HR...');
  try {
    await EmailNotificationService.sendExpenseSubmittedToHR(
      testEmployee,
      testExpense,
      HR_EMAIL
    );
    console.log('✅ Expense Submitted email sent successfully');
  } catch (error) {
    console.error('❌ Expense Submitted email failed:', error.message);
  }
}

async function testExpenseApprovedEmail() {
  console.log('\n📧 Testing Expense Approved Email to HR...');
  try {
    await EmailNotificationService.sendExpenseApprovedToHR(
      testEmployee,
      testExpense,
      testApprover,
      HR_EMAIL
    );
    console.log('✅ Expense Approved email sent successfully');
  } catch (error) {
    console.error('❌ Expense Approved email failed:', error.message);
  }
}

async function runAllTests() {
  console.log('🧪 Testing All HR Email Notifications');
  console.log(`📍 HR Email: ${HR_EMAIL}`);
  console.log(`📧 SMTP Host: ${process.env.SMTP_HOST}`);
  console.log(`👤 Test Employee: ${testEmployee.name} (${testEmployee.email})`);

  await testCheckInEmail();
  await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second between emails

  await testCheckOutEmail();
  await new Promise(resolve => setTimeout(resolve, 1000));

  await testLeaveSubmittedEmail();
  await new Promise(resolve => setTimeout(resolve, 1000));

  await testLeaveApprovedEmail();
  await new Promise(resolve => setTimeout(resolve, 1000));

  await testExpenseSubmittedEmail();
  await new Promise(resolve => setTimeout(resolve, 1000));

  await testExpenseApprovedEmail();

  console.log('\n✅ All email tests completed!');
  console.log('📧 Check your HR email inbox for test messages');
}

runAllTests().catch(error => {
  console.error('❌ Test suite failed:', error);
  process.exit(1);
});
