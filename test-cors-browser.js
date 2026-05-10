/**
 * Test CORS like a browser would
 */

async function testCORSSimple() {
  console.log('Testing CORS with fetch...\n');

  try {
    // Test OPTIONS preflight
    const response = await fetch('https://workplus-backend-sg3a.onrender.com/api/auth/login', {
      method: 'OPTIONS',
      headers: {
        'Origin': 'https://hexerve.online',
        'Access-Control-Request-Method': 'POST',
        'Access-Control-Request-Headers': 'Content-Type, Authorization'
      }
    });

    console.log('OPTIONS Status:', response.status);
    console.log('Access-Control-Allow-Origin:', response.headers.get('access-control-allow-origin'));
    console.log('Access-Control-Allow-Credentials:', response.headers.get('access-control-allow-credentials'));
    console.log('Access-Control-Allow-Methods:', response.headers.get('access-control-allow-methods'));

    // Test actual login
    const loginResponse = await fetch('https://workplus-backend-sg3a.onrender.com/api/auth/login', {
      method: 'POST',
      headers: {
        'Origin': 'https://hexerve.online',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        email: 'atul@hexerve.com',
        password: 'Jadu@123'
      })
    });

    console.log('\nPOST Status:', loginResponse.status);
    console.log('Access-Control-Allow-Origin:', loginResponse.headers.get('access-control-allow-origin'));

    const data = await loginResponse.json();
    console.log('Login:', data.success ? '✅' : '❌', data.message);

  } catch (error) {
    console.error('Error:', error.message);
  }
}

testCORSSimple();
