/**
 * Check if backend has new CORS configuration
 */

const API_BASE_URL = 'https://workplus-backend-sg3a.onrender.com';

async function checkCORSConfig() {
  console.log('Checking CORS configuration...\n');
  
  try {
    // Test with hexerve.online origin
    const response = await fetch(`${API_BASE_URL}/api/auth/login`, {
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
    
    console.log('Response Status:', response.status);
    console.log('Response Headers:');
    response.headers.forEach((value, key) => {
      if (key.toLowerCase().includes('access-control') || key.toLowerCase().includes('cors')) {
        console.log(`  ${key}: ${value}`);
      }
    });
    
    const data = await response.json();
    console.log('\nResponse:', JSON.stringify(data, null, 2));
    
  } catch (error) {
    console.error('Error:', error.message);
  }
}

checkCORSConfig();
