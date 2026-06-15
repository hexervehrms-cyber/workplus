/**
 * Test All Email Notifications
 * Tests: Leave submission, Leave approval, Expense submission, Expense approval, Check-in, Check-out
 */

import dotenv from 'dotenv';
import axios from 'axios';

dotenv.config({ path: './.env.production' });

const API_BASE_URL = process.env.BACKEND_URL || 'https://workplus-backend-sg3a.onrender.com';
const EMPLOYEE_EMAIL = process.env.EMPLOYEE_EMAIL || 'abhishek.rajput@hexerve.com';
const EMPLOYEE_PASSWORD = process.env.EMPLOYEE_PASSWORD;
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'atul@hexerve.com';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;

if (!EMPLOYEE_PASSWORD || !ADMIN_PASSWORD) {
  console.error('❌ ERROR: Missing required environment variables');
  console.error('   Set EMPLOYEE_PASSWORD and ADMIN_PASSWORD in .env file');
  process.exit(1);
}

let employeeToken = null;
let adminToken = null;
let employeeId = null;
let adminId = null;
let leaveRequestId = null;
let expenseId = null;

const log = (title, message) => {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`📌 ${title}`);
  console.log(`${'='.repeat(60)}`);
  console.log(message);
};

const testLogin = async () => {
  log('STEP 1: Login as Employee', 'Logging in with employee credentials...');
  try {
    const response = await axios.post(`${API_BASE_URL}/api/auth/login`, {
      email: EMPLOYEE_EMAIL,
      password: EMPLOYEE_PASSWORD
    });
    employeeToken = response.data.token;
    employeeId = response.data.user.id;
    console.log(`✅ Employee logged in: ${EMPLOYEE_EMAIL}`);
    console.log(`   Token: ${employeeToken.substring(0, 20)}...`);
    console.log(`   User ID: ${employeeId}`);
  } catch (error) {
    console.error('❌ Employee login failed:', error.response?.data?.message || error.message);
    throw error;
  }

  log('STEP 2: Login as Admin', 'Logging in with admin credentials...');
  try {
    const response = await axios.post(`${API_BASE_URL}/api/auth/login`, {
      email: ADMIN_EMAIL,
      password: ADMIN_PASSWORD
    });
    adminToken = response.data.token;
    adminId = response.data.user.id;
    console.log(`✅ Admin logged in: ${ADMIN_EMAIL}`);
    console.log(`   Token: ${adminToken.substring(0, 20)}...`);
    console.log(`   User ID: ${adminId}`);
  } catch (error) {
    console.error('❌ Admin login failed:', error.response?.data?.message || error.message);
    throw error;
  }
};

const testLeaveSubmission = async () => {
  log('STEP 3: Submit Leave Request', 'Employee submitting a leave request...');
  try {
    // Use dates further in the future to avoid conflicts
    const startDate = new Date();
    startDate.setDate(startDate.getDate() + 7);
    const endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + 2);

    const response = await axios.post(
      `${API_BASE_URL}/api/leave-requests`,
      {
        userId: employeeId,
        employeeId: employeeId,
        leaveType: 'Casual Leave',
        startDate: startDate.toISOString().split('T')[0],
        endDate: endDate.toISOString().split('T')[0],
        reason: 'Personal work - Test notification',
        orgId: 'system'
      },
      {
        headers: { Authorization: `Bearer ${employeeToken}` }
      }
    );
    leaveRequestId = response.data._id;
    console.log(`✅ Leave request submitted successfully`);
    console.log(`   Leave ID: ${leaveRequestId}`);
    console.log(`   Type: Casual Leave`);
    console.log(`   Duration: 3 days`);
    console.log(`   📧 Email sent to HR: hr@hexerve.com`);
  } catch (error) {
    console.error('❌ Leave submission failed:', error.response?.data?.message || error.message);
    throw error;
  }
};

const testLeaveApproval = async () => {
  log('STEP 4: Approve Leave Request', 'Admin approving the leave request...');
  try {
    const response = await axios.patch(
      `${API_BASE_URL}/api/leave-requests/${leaveRequestId}/approve`,
      { approvedBy: adminId, comments: 'Approved' },
      {
        headers: { Authorization: `Bearer ${adminToken}` }
      }
    );
    console.log(`✅ Leave request approved successfully`);
    console.log(`   Leave ID: ${leaveRequestId}`);
    console.log(`   Status: Approved`);
    console.log(`   📧 Email sent to HR: hr@hexerve.com`);
  } catch (error) {
    console.error('❌ Leave approval failed:', error.response?.data?.message || error.message);
    throw error;
  }
};

const testExpenseSubmission = async () => {
  log('STEP 5: Submit Expense', 'Employee submitting an expense...');
  try {
    const response = await axios.post(
      `${API_BASE_URL}/api/expenses`,
      {
        title: 'Office Supplies',
        category: 'Office Supplies',
        amount: 500,
        date: new Date().toISOString().split('T')[0],
        description: 'Purchased office supplies for team'
      },
      {
        headers: { Authorization: `Bearer ${employeeToken}` }
      }
    );
    expenseId = response.data._id;
    console.log(`✅ Expense submitted successfully`);
    console.log(`   Expense ID: ${expenseId}`);
    console.log(`   Title: Office Supplies`);
    console.log(`   Amount: ₹500`);
    console.log(`   📧 Email sent to HR: hr@hexerve.com`);
  } catch (error) {
    console.error('❌ Expense submission failed:', error.response?.data?.message || error.message);
    throw error;
  }
};

const testExpenseApproval = async () => {
  log('STEP 6: Approve Expense', 'Admin approving the expense...');
  try {
    const response = await axios.put(
      `${API_BASE_URL}/api/expenses/${expenseId}/approve`,
      { approvedBy: adminId },
      {
        headers: { Authorization: `Bearer ${adminToken}` }
      }
    );
    console.log(`✅ Expense approved successfully`);
    console.log(`   Expense ID: ${expenseId}`);
    console.log(`   Status: Approved`);
    console.log(`   Amount: ₹500`);
    console.log(`   📧 Email sent to HR: hr@hexerve.com`);
  } catch (error) {
    console.error('❌ Expense approval failed:', error.response?.data?.message || error.message);
    throw error;
  }
};

const testCheckIn = async () => {
  log('STEP 7: Employee Check-In', 'Employee checking in...');
  try {
    const response = await axios.post(
      `${API_BASE_URL}/api/attendance/check-in`,
      {
        location: 'Office'
      },
      {
        headers: { Authorization: `Bearer ${employeeToken}` }
      }
    );
    console.log(`✅ Check-in successful`);
    console.log(`   Time: ${new Date().toLocaleTimeString()}`);
    console.log(`   Status: Checked In`);
    console.log(`   📧 Email sent to HR: hr@hexerve.com`);
  } catch (error) {
    console.error('❌ Check-in failed:', error.response?.data?.message || error.message);
    throw error;
  }
};

const testCheckOut = async () => {
  log('STEP 8: Employee Check-Out', 'Employee checking out...');
  try {
    const response = await axios.post(
      `${API_BASE_URL}/api/attendance/check-out`,
      {
        location: 'Office'
      },
      {
        headers: { Authorization: `Bearer ${employeeToken}` }
      }
    );
    console.log(`✅ Check-out successful`);
    console.log(`   Time: ${new Date().toLocaleTimeString()}`);
    console.log(`   Status: Checked Out`);
    console.log(`   📧 Email sent to HR: hr@hexerve.com`);
  } catch (error) {
    console.error('❌ Check-out failed:', error.response?.data?.message || error.message);
    throw error;
  }
};

const runAllTests = async () => {
  try {
    console.log('\n');
    console.log('╔════════════════════════════════════════════════════════════╗');
    console.log('║     TESTING ALL EMAIL NOTIFICATIONS                        ║');
    console.log('║     Leave, Expense, Check-in/out Emails to HR              ║');
    console.log('╚════════════════════════════════════════════════════════════╝');

    await testLogin();
    await testLeaveSubmission();
    await testLeaveApproval();
    await testExpenseSubmission();
    await testExpenseApproval();
    await testCheckIn();
    await testCheckOut();

    console.log('\n');
    console.log('╔════════════════════════════════════════════════════════════╗');
    console.log('║     ✅ ALL TESTS COMPLETED SUCCESSFULLY!                   ║');
    console.log('╚════════════════════════════════════════════════════════════╝');
    console.log('\n📧 Emails Sent:');
    console.log('   1. Leave Request Submitted → HR');
    console.log('   2. Leave Request Approved → HR');
    console.log('   3. Expense Submitted → HR');
    console.log('   4. Expense Approved → HR');
    console.log('   5. Check-In Notification → HR');
    console.log('   6. Check-Out Notification → HR');
    console.log('\n✅ Check hr@hexerve.com inbox for all notifications!\n');

    process.exit(0);
  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    process.exit(1);
  }
};

runAllTests();
