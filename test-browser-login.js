/**
 * Test browser login simulation from hexerve.online
 */

const API_BASE_URL = 'https://workplus-backend-sg3a.onrender.com';
const FRONTEND_ORIGIN = 'https://hexerve.online';

async function testBrowserLogin() {
  console.log('='.repeat(70));
  console.log('BROWSER LOGIN SIMULATION TEST');
  console.log('='.repeat(70));
  console.log(`Frontend: ${FRONTEND_ORIGIN}`);
  console.log(`Backend: ${API_BASE_URL}\n`);

  const credentials = [
    { email: 'atul@hexerve.com', password: 'Jadu@123', name: 'Atul (Admin)' },
    { email: 'harsh.gupta@hexerve.com', password: 'Jadu@123', name: 'Harsh (Employee)' },
    { email: 'rinky@hexerve.com', password: 'Jadu@123', name: 'Rinky (Employee)' }
  ];

  for (const cred of credentials) {
    console.log(`\n--- Testing: ${cred.name} ---`);

    try {
      // Simulate browser fetch with Origin header
      const response = await fetch(`${API_BASE_URL}/api/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Origin': FRONTEND_ORIGIN
        },
        credentials: 'include',
        body: JSON.stringify({
          email: cred.email,
          password: cred.password
        })
      });

      const data = await response.json();
      const corsOrigin = response.headers.get('Access-Control-Allow-Origin');

      console.log(`  Status: ${response.status}`);
      console.log(`  CORS Origin: ${corsOrigin || 'Not set'}`);

      if (response.ok && data.token) {
        console.log('  ✅ Login successful');
        console.log(`  Token: ${data.token.substring(0, 50)}...`);

        // Test authenticated API call
        const authResponse = await fetch(`${API_BASE_URL}/api/dashboard/stats`, {
          headers: {
            'Authorization': `Bearer ${data.token}`,
            'Origin': FRONTEND_ORIGIN
          },
          credentials: 'include'
        });

        console.log(`  Dashboard Status: ${authResponse.status}`);
        if (authResponse.ok) {
          console.log('  ✅ Dashboard accessible');
        } else {
          console.log('  ❌ Dashboard failed');
        }
      } else {
        console.log('  ❌ Login failed');
        console.log(`  Error: ${data.message}`);
      }
    } catch (error) {
      console.log(`  ❌ Error: ${error.message}`);
    }
  }

  console.log('\n' + '='.repeat(70));
  console.log('TEST COMPLETE - Frontend should now work at:');
  console.log('https://hexerve.online/login');
  console.log('='.repeat(70));
}

testBrowserLogin();
