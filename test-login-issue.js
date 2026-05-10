/**
 * Test login issue
 */

const API_BASE_URL = 'https://workplus-backend-sg3a.onrender.com';

async function testLogin() {
  console.log('Testing login...\n');
  
  const credentials = [
    { email: 'atul@hexerve.com', password: 'Jadu@123', role: 'Admin' },
    { email: 'superadmin@company.com', password: 'Jadu@123', role: 'Super Admin' },
    { email: 'admin@workpluspro.com', password: 'Jadu@123', role: 'Super Admin' }
  ];
  
  for (const cred of credentials) {
    console.log(`\n--- Testing: ${cred.role} (${cred.email}) ---`);
    
    try {
      const response = await fetch(`${API_BASE_URL}/api/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Origin': 'https://hexerve.online'
        },
        body: JSON.stringify({
          email: cred.email,
          password: cred.password
        })
      });
      
      const data = await response.json();
      console.log(`Status: ${response.status}`);
      console.log(`Response:`, JSON.stringify(data, null, 2));
      
      if (response.ok && data.token) {
        console.log('✅ Login successful');
      } else {
        console.log('❌ Login failed');
      }
    } catch (error) {
      console.log(`❌ Error: ${error.message}`);
    }
  }
}

testLogin();
