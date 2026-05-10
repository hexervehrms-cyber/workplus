/**
 * Test with actual .env credentials
 * atul@hexerve.com / Jadu@123
 */

const API_BASE_URL = 'https://workplus-backend-sg3a.onrender.com';

async function testWithEnvCreds() {
  console.log('Testing with .env credentials...');
  console.log('Email: atul@hexerve.com');
  console.log('Password: Jadu@123');
  console.log('');
  
  try {
    const loginResponse = await fetch(`${API_BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'atul@hexerve.com',
        password: 'Jadu@123'
      })
    });
    
    const loginData = await loginResponse.json();
    console.log('Status:', loginResponse.status);
    console.log('Response:', JSON.stringify(loginData, null, 2));
    
    if (loginResponse.ok && loginData.token) {
      console.log('\n✅ LOGIN SUCCESSFUL!');
      console.log('User:', loginData.user);
      
      // Test key endpoints
      const token = loginData.token;
      const endpoints = [
        { name: 'Dashboard Stats', path: '/api/dashboard/stats' },
        { name: 'Employee List', path: '/api/employees?simple=true' },
        { name: 'Attendance', path: '/api/attendance' },
        { name: 'Leave Requests', path: '/api/leave-requests' },
        { name: 'Expenses', path: '/api/expenses' },
        { name: 'Payslips', path: '/api/payslips' },
        { name: 'Holidays', path: '/api/holidays' },
        { name: 'Documents', path: '/api/documents' }
      ];
      
      console.log('\n--- Testing Admin Sections ---');
      for (const endpoint of endpoints) {
        try {
          const response = await fetch(`${API_BASE_URL}${endpoint.path}`, {
            headers: { 'Authorization': `Bearer ${token}` }
          });
          const data = await response.json();
          console.log(`${endpoint.name}: ${response.ok ? '✅' : '❌'} ${response.status} - ${data.message || 'OK'}`);
        } catch (err) {
          console.log(`${endpoint.name}: ❌ Error - ${err.message}`);
        }
      }
      
      // Test Employee Dashboard
      console.log('\n--- Testing Employee Sections ---');
      const employeeEndpoints = [
        { name: 'Employee Dashboard', path: '/api/dashboard/employee/stats' },
        { name: 'My Profile', path: '/api/profile' },
        { name: 'My Tasks', path: '/api/tasks/my-tasks' }
      ];
      
      for (const endpoint of employeeEndpoints) {
        try {
          const response = await fetch(`${API_BASE_URL}${endpoint.path}`, {
            headers: { 'Authorization': `Bearer ${token}` }
          });
          const data = await response.json();
          console.log(`${endpoint.name}: ${response.ok ? '✅' : '❌'} ${response.status} - ${data.message || 'OK'}`);
        } catch (err) {
          console.log(`${endpoint.name}: ❌ Error - ${err.message}`);
        }
      }
      
    } else {
      console.log('\n❌ Login failed:', loginData.message);
    }
  } catch (error) {
    console.error('Error:', error.message);
  }
}

testWithEnvCreds();
