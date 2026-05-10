/**
 * Test employee login
 */

const API_BASE_URL = 'https://workplus-backend-sg3a.onrender.com';

async function testEmployeeLogin() {
  console.log('Testing employee login...\n');
  
  const employees = [
    { email: 'harsh.gupta@hexerve.com', password: 'Jadu@123', name: 'Harsh Gupta' },
    { email: 'rinky@hexerve.com', password: 'Jadu@123', name: 'Rinky' },
    { email: 'abhishek.rajput@hexerve.com', password: 'Jadu@123', name: 'Abhishek Rajput' }
  ];
  
  for (const emp of employees) {
    console.log(`\n--- Testing: ${emp.name} (${emp.email}) ---`);
    
    try {
      const response = await fetch(`${API_BASE_URL}/api/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Origin': 'https://hexerve.online'
        },
        body: JSON.stringify({
          email: emp.email,
          password: emp.password
        })
      });
      
      const data = await response.json();
      console.log(`Status: ${response.status}`);
      console.log(`Message: ${data.message}`);
      
      if (response.ok && data.token) {
        console.log('✅ Login successful');
      } else {
        console.log('❌ Login failed - Password may be incorrect');
      }
    } catch (error) {
      console.log(`❌ Error: ${error.message}`);
    }
  }
  
  console.log('\n--- To reset employee passwords, you need to: ---');
  console.log('1. Use the admin account to reset passwords');
  console.log('2. Or provide the correct employee passwords');
}

testEmployeeLogin();
