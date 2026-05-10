/**
 * CORS Validation Test Script
 * Tests CORS configuration for multiple origins
 */

const API_BASE_URL = 'https://workplus-backend-sg3a.onrender.com';

const testOrigins = [
  'https://hexerve.online',
  'https://www.hexerve.online',
  'https://workplus-qbshegha8-hexervehrms-8667s-projects.vercel.app'
];

async function testCORS() {
  console.log('='.repeat(70));
  console.log('CORS VALIDATION TEST');
  console.log('='.repeat(70));
  console.log(`Testing against: ${API_BASE_URL}\n`);
  
  for (const origin of testOrigins) {
    console.log(`\n--- Testing Origin: ${origin} ---`);
    
    try {
      // Test OPTIONS preflight request
      console.log('1. Testing OPTIONS preflight...');
      const optionsResponse = await fetch(`${API_BASE_URL}/api/auth/login`, {
        method: 'OPTIONS',
        headers: {
          'Origin': origin,
          'Access-Control-Request-Method': 'POST',
          'Access-Control-Request-Headers': 'Content-Type, Authorization'
        }
      });
      
      console.log(`   Status: ${optionsResponse.status}`);
      console.log(`   Access-Control-Allow-Origin: ${optionsResponse.headers.get('Access-Control-Allow-Origin')}`);
      console.log(`   Access-Control-Allow-Credentials: ${optionsResponse.headers.get('Access-Control-Allow-Credentials')}`);
      console.log(`   Access-Control-Allow-Methods: ${optionsResponse.headers.get('Access-Control-Allow-Methods')}`);
      console.log(`   Access-Control-Allow-Headers: ${optionsResponse.headers.get('Access-Control-Allow-Headers')}`);
      
      const corsOrigin = optionsResponse.headers.get('Access-Control-Allow-Origin');
      if (corsOrigin === origin || corsOrigin === '*') {
        console.log('   ✅ CORS Origin header matches');
      } else {
        console.log(`   ❌ CORS Origin header mismatch. Expected: ${origin}, Got: ${corsOrigin}`);
      }
      
      // Test actual POST request
      console.log('\n2. Testing POST request...');
      const postResponse = await fetch(`${API_BASE_URL}/api/auth/login`, {
        method: 'POST',
        headers: {
          'Origin': origin,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          email: 'atul@hexerve.com',
          password: 'Jadu@123'
        })
      });
      
      console.log(`   Status: ${postResponse.status}`);
      const data = await postResponse.json();
      
      if (postResponse.ok) {
        console.log(`   ✅ Request successful`);
        console.log(`   ✅ Token received: ${data.token ? 'Yes' : 'No'}`);
      } else {
        console.log(`   ❌ Request failed: ${data.message}`);
      }
      
      // Test authenticated request
      if (data.token) {
        console.log('\n3. Testing authenticated request...');
        const authResponse = await fetch(`${API_BASE_URL}/api/dashboard/stats`, {
          method: 'GET',
          headers: {
            'Origin': origin,
            'Authorization': `Bearer ${data.token}`
          }
        });
        
        console.log(`   Status: ${authResponse.status}`);
        if (authResponse.ok) {
          console.log(`   ✅ Authenticated request successful`);
        } else {
          console.log(`   ❌ Authenticated request failed`);
        }
      }
      
    } catch (error) {
      console.log(`   ❌ Error: ${error.message}`);
    }
  }
  
  console.log('\n' + '='.repeat(70));
  console.log('CORS VALIDATION COMPLETE');
  console.log('='.repeat(70));
}

testCORS();
