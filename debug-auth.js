const API_BASE_URL = 'https://workplus-backend-sg3a.onrender.com';

async function debugAuth() {
  console.log('Testing without auth...\n');
  
  const routes = [
    '/api/announcements',
    '/api/tasks'
  ];
  
  for (const route of routes) {
    try {
      const response = await fetch(`${API_BASE_URL}${route}`);
      const data = await response.json();
      console.log(`${route}: ${response.status} - ${data.message || JSON.stringify(data).substring(0, 100)}`);
    } catch (err) {
      console.log(`${route}: ERROR - ${err.message}`);
    }
  }
  
  console.log('\nTesting with auth...\n');
  
  // Login
  const loginResponse = await fetch(`${API_BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'atul@hexerve.com',
      password: 'Jadu@123'
    })
  });
  
  const loginData = await loginResponse.json();
  console.log('Login:', loginResponse.ok ? '✅' : '❌');
  
  if (loginData.token) {
    for (const route of routes) {
      try {
        const response = await fetch(`${API_BASE_URL}${route}`, {
          headers: { 'Authorization': `Bearer ${loginData.token}` }
        });
        const data = await response.json();
        console.log(`${route}: ${response.status} - ${data.message || JSON.stringify(data).substring(0, 100)}`);
      } catch (err) {
        console.log(`${route}: ERROR - ${err.message}`);
      }
    }
  }
}

debugAuth();
