/**
 * Test Check-in Fix
 * 
 * This script tests the check-in functionality after fixing the duplicate key error
 */

import fetch from 'node-fetch';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const API_BASE = 'http://localhost:5000/api';

const testCheckInFix = async () => {
  try {
    console.log('🧪 Testing Check-in Fix...\n');
    
    // Test data - using a known employee
    const testEmployeeId = '675b8b8e2b5c123456789012'; // Replace with actual employee ID
    const testUserId = '675b8b8e2b5c123456789013'; // Replace with actual user ID
    const orgId = 'system';
    
    // Get auth token (you'll need to replace this with actual token)
    const authToken = 'your-auth-token-here';
    
    console.log('1️⃣ Testing first check-in...');
    
    // First check-in
    const checkIn1Response = await fetch(`${API_BASE}/attendance/check-in`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${authToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        userId: testUserId,
        employeeId: testEmployeeId,
        employeeName: 'Test Employee',
        orgId: orgId,
        location: 'Office',
        notes: 'First check-in test'
      })
    });
    
    const checkIn1Result = await checkIn1Response.json();
    console.log('First check-in result:', checkIn1Result.success ? '✅ Success' : '❌ Failed');
    if (!checkIn1Result.success) {
      console.log('Error:', checkIn1Result.message);
    }
    
    console.log('\n2️⃣ Testing check-out...');
    
    // Check-out
    const checkOutResponse = await fetch(`${API_BASE}/attendance/check-out`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${authToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        userId: testUserId,
        employeeId: testEmployeeId,
        employeeName: 'Test Employee',
        orgId: orgId,
        location: 'Office',
        notes: 'Check-out test'
      })
    });
    
    const checkOutResult = await checkOutResponse.json();
    console.log('Check-out result:', checkOutResult.success ? '✅ Success' : '❌ Failed');
    if (!checkOutResult.success) {
      console.log('Error:', checkOutResult.message);
    }
    
    console.log('\n3️⃣ Testing re-check-in (this should work now)...');
    
    // Re-check-in (this was failing before)
    const checkIn2Response = await fetch(`${API_BASE}/attendance/check-in`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${authToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        userId: testUserId,
        employeeId: testEmployeeId,
        employeeName: 'Test Employee',
        orgId: orgId,
        location: 'Office',
        notes: 'Re-check-in test after fix'
      })
    });
    
    const checkIn2Result = await checkIn2Response.json();
    console.log('Re-check-in result:', checkIn2Result.success ? '✅ Success' : '❌ Failed');
    if (!checkIn2Result.success) {
      console.log('Error:', checkIn2Result.message);
    } else {
      console.log('✅ Re-check-in works! The duplicate key error has been fixed.');
    }
    
    console.log('\n🎉 Test completed!');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
};

// Note: This test requires valid authentication tokens and employee IDs
// For manual testing, use the frontend dashboard instead
console.log('📝 Note: This test script requires valid auth tokens and employee IDs.');
console.log('🌐 For testing, please use the frontend employee dashboard at http://localhost:5173');
console.log('👤 Login as an employee and try the check-in/check-out functionality.');

// Uncomment the line below to run the test (after setting up proper auth tokens)
// testCheckInFix();