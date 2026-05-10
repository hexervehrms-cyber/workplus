/**
 * Delayed test script - run after rate limit expires (15 minutes)
 */

const API_BASE_URL = 'https://workplus-backend-sg3a.onrender.com';

async function testAfterRateLimit() {
  console.log('Testing after rate limit expiration...');
  console.log('If this fails, wait another few minutes and try again.');
  
  const loginResponse = await fetch(`${API_BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'superadmin@company.com',
      password: 'Admin123!SecurePassword'
    })
  });
  
  const loginData = await loginResponse.json();
  console.log('Login Response Status:', loginResponse.status);
  console.log('Login Response:', loginData);
  
  if (loginResponse.ok && loginData.token) {
    console.log('\n✅ Login successful! Token obtained.');
    console.log('User:', loginData.user);
    console.log('\nNow you can test all dashboard functions.');
    console.log('Run: node test-dashboard-functions.js');
  } else {
    console.log('\n❌ Login still failing. Rate limit may not have expired yet.');
    console.log('Message:', loginData.message);
  }
}

testAfterRateLimit().catch(console.error);
