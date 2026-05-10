/**
 * Test login with REAL super admin credentials from database
 */

const API_BASE_URL = 'https://workplus-backend-sg3a.onrender.com';

async function testRealLogin() {
  console.log('='.repeat(70));
  console.log('TESTING LOGIN WITH REAL DATABASE CREDENTIALS');
  console.log('='.repeat(70));
  
  // Test with atul@hexerve.com (from .env SUPER_ADMIN_EMAIL)
  console.log('\n--- Test 1: atul@hexerve.com (from .env) ---');
  await testCredentials('atul@hexerve.com', 'Jadu@123');
  
  // Test with admin@workpluspro.com (super_admin from DB)
  console.log('\n--- Test 2: admin@workpluspro.com (DB super_admin) ---');
  await testCredentials('admin@workpluspro.com', 'Jadu@123');
  
  // Test with superadmin@company.com (super_admin from DB)
  console.log('\n--- Test 3: superadmin@company.com (DB super_admin) ---');
  await testCredentials('superadmin@company.com', 'Jadu@123');
}

async function testCredentials(email, password) {
  try {
    const response = await fetch(`${API_BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    
    const data = await response.json();
    
    if (response.ok && data.token) {
      console.log(`✅ LOGIN SUCCESS: ${email}`);
      console.log(`   Name: ${data.user.name}`);
      console.log(`   Role: ${data.user.role}`);
      console.log(`   Token: ${data.token.substring(0, 50)}...`);
      
      // Test dashboard access
      const dashResponse = await fetch(`${API_BASE_URL}/api/dashboard/stats`, {
        headers: { 'Authorization': `Bearer ${data.token}` }
      });
      console.log(`   Dashboard: ${dashResponse.ok ? '✅ Accessible' : '❌ Failed'}`);
      
      return data.token;
    } else {
      console.log(`❌ LOGIN FAILED: ${email}`);
      console.log(`   Error: ${data.message}`);
      return null;
    }
  } catch (error) {
    console.log(`❌ ERROR: ${email}`);
    console.log(`   ${error.message}`);
    return null;
  }
}

testRealLogin();
