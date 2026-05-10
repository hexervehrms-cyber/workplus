/**
 * Test with correct credentials from render.yaml
 */

const API_BASE_URL = 'https://workplus-backend-sg3a.onrender.com';

async function testWithCorrectCreds() {
  console.log('Testing with credentials from render.yaml...');
  
  // Test with the credentials from render.yaml
  const loginResponse = await fetch(`${API_BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'superadmin@company.com',
      password: 'Admin123!SecurePassword'
    })
  });
  
  const loginData = await loginResponse.json();
  console.log('Login Response:', loginData);
  
  if (loginResponse.ok && loginData.token) {
    console.log('✅ Login successful! Testing authenticated endpoints...');
    
    // Test a few key endpoints
    const endpoints = [
      '/api/dashboard/stats',
      '/api/employees?simple=true',
      '/api/expenses',
      '/api/leave-requests',
      '/api/attendance',
      '/api/holidays'
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
    console.log('❌ Login failed');
  }
}

testWithCorrectCreds().catch(console.error);
