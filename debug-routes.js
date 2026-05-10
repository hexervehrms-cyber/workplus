const API_BASE_URL = 'https://workplus-backend-sg3a.onrender.com';

async function debugRoutes() {
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
  const token = loginData.token;
  
  console.log('Testing routes with token...\n');
  
  const routes = [
    '/api/announcements',
    '/api/tasks',
    '/api/tasks/my-tasks',
    '/api/tasks/dashboard-stats'
  ];
  
  for (const route of routes) {
    try {
      const response = await fetch(`${API_BASE_URL}${route}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      console.log(`${route}: ${response.status} - ${data.message || JSON.stringify(data).substring(0, 100)}`);
    } catch (err) {
      console.log(`${route}: ERROR - ${err.message}`);
    }
  }
}

debugRoutes();
