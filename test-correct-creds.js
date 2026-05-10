/**
 * Test with correct credentials from Render dashboard
 */

const API_BASE_URL = 'https://workplus-backend-sg3a.onrender.com';

async function testLogin() {
  console.log('Testing login with correct credentials...');
  console.log('Email: superadmin@company.com');
  console.log('Password: Jadu@123');
  
  const loginResponse = await fetch(`${API_BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'superadmin@company.com',
      password: 'Jadu@123'
    })
  });
  
  const loginData = await loginResponse.json();
  console.log('\nLogin Response Status:', loginResponse.status);
  console.log('Login Response:', JSON.stringify(loginData, null, 2));
  
  if (loginResponse.ok && loginData.token) {
    console.log('\n✅ Login successful!');
    console.log('User:', loginData.user);
    console.log('Token obtained (first 50 chars):', loginData.token.substring(0, 50) + '...');
    
    // Test a few key endpoints
    console.log('\nTesting key endpoints...');
    const endpoints = [
      '/api/dashboard/stats',
      '/api/employees?simple=true',
      '/api/expenses',
      '/api/leave-requests'
    ];
    
    for (const endpoint of endpoints) {
      const response = await fetch(`${API_BASE_URL}${endpoint}`, {
        headers: { 'Authorization': `Bearer ${loginData.token}` }
      });
      
      const data = await response.json();
      console.log(`${endpoint}: ${response.ok ? '✅' : '❌'} ${response.status}`);
      if (!response.ok) {
        console.log('   Error:', data.message);
      }
    }
  } else {
    console.log('\n❌ Login failed');
  }
}

testLogin().catch(console.error);
