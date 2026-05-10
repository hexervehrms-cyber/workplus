/**
 * Comprehensive CRUD Verification Script for REAL Data
 * Tests GET, POST, PUT, DELETE against production backend
 */
import axios from 'axios';

const API_BASE_URL = 'https://workplus-backend-sg3a.onrender.com';

async function runCrudTests() {
  console.log('='.repeat(70));
  console.log('WORKPLUS PRO - PRODUCTION CRUD VERIFICATION (REAL DATA)');
  console.log('='.repeat(70));
  
  // Create axios instance with cookie support
  const client = axios.create({
    baseURL: API_BASE_URL,
    withCredentials: true,
    headers: {
      'Content-Type': 'application/json'
    }
  });

  let csrfToken = '';
  let cookies = [];

  // Helper to extract CSRF and cookies
  const updateSession = (response) => {
    const newToken = response.headers['x-csrf-token'];
    if (newToken) csrfToken = newToken;
    
    const setCookie = response.headers['set-cookie'];
    if (setCookie) cookies = setCookie;
  };

  // 0. Get CSRF Token from a GET request
  console.log('--- 0. SESSION INITIALIZATION ---');
  try {
    const healthRes = await client.get('/api/auth/me', {
      validateStatus: () => true
    });
    updateSession(healthRes);
    if (csrfToken) {
      console.log('✅ CSRF Token obtained');
    }
  } catch (err) {
    console.log('⚠️ Session init failed:', err.message);
  }

  // 1. Login with real credentials
  console.log('\n--- 1. AUTHENTICATION ---');
  try {
    const loginResponse = await client.post('/api/auth/login', {
      email: 'atul@hexerve.com',
      password: 'Jadu@123'
    }, {
      headers: { 
        'X-CSRF-Token': csrfToken,
        'Cookie': cookies.join('; ')
      }
    });
    
    updateSession(loginResponse);
    const loginData = loginResponse.data;
    
    const token = loginData.token;
    const userId = loginData.user.id || loginData.user._id;
    const orgId = loginData.user.orgId || 'system';
    
    console.log(`✅ Logged in as: ${loginData.user.name} (${loginData.user.role})`);
    console.log(`✅ Org ID: ${orgId}`);

    // Set default auth header for subsequent requests
    client.defaults.headers.common['Authorization'] = `Bearer ${token}`;

    // Helper for subsequent requests to keep cookies/csrf in sync
    const callApi = async (path, method = 'GET', body = null) => {
      const config = {
        method,
        url: path,
        headers: {
          'X-CSRF-Token': csrfToken,
          'Cookie': cookies.join('; ')
        }
      };
      if (body) config.data = body;
      
      const response = await client(config);
      updateSession(response);
      return response;
    };

    // 2. Read Tests (Verify GET)
    console.log('\n--- 2. READ VERIFICATION (GET) ---');
    const sections = [
      { name: 'Dashboard Stats', path: '/api/dashboard/stats' },
      { name: 'Employee List', path: '/api/employees?simple=true' },
      { name: 'Tasks', path: '/api/tasks' }
    ];

    for (const section of sections) {
      const res = await callApi(section.path);
      if (res.status === 200) {
        console.log(`✅ ${section.name.padEnd(20)} - Status 200 (Found ${Array.isArray(res.data.data) ? res.data.data.length : 'data'} records)`);
      } else {
        console.log(`❌ ${section.name.padEnd(20)} - Status ${res.status}: ${res.data.message}`);
      }
    }

    // 3. Create Test (Verify POST)
    console.log('\n--- 3. CREATE VERIFICATION (POST) ---');
    const newTask = {
      title: 'Production Verification Task ' + new Date().getTime(),
      description: 'This is a test task created during production verification',
      assignedTo: userId,
      priority: 'medium',
      category: 'general',
      orgId: orgId
    };

    const createRes = await callApi('/api/tasks', 'POST', newTask);
    let taskId = null;
    
    if (createRes.status === 201 || (createRes.status === 200 && createRes.data.success)) {
      taskId = createRes.data.data._id;
      console.log(`✅ Task Created - ID: ${taskId}`);
    } else {
      console.log(`❌ Task Creation Failed - Status ${createRes.status}: ${createRes.data.message}`);
      return;
    }

    // 4. Update Test (Verify PUT)
    console.log('\n--- 4. UPDATE VERIFICATION (PUT) ---');
    const updateData = {
      title: newTask.title + ' (UPDATED)',
      status: 'in_progress'
    };

    const updateRes = await callApi(`/api/tasks/${taskId}`, 'PUT', updateData);
    
    if (updateRes.status === 200 && updateRes.data.success) {
      console.log(`✅ Task Updated - New Title: ${updateRes.data.data.title}`);
    } else {
      console.log(`❌ Task Update Failed - Status ${updateRes.status}: ${updateRes.data.message}`);
    }

    // 5. Delete Test (Verify DELETE)
    console.log('\n--- 5. DELETE VERIFICATION (DELETE) ---');
    const deleteRes = await callApi(`/api/tasks/${taskId}`, 'DELETE');
    
    if (deleteRes.status === 200 && deleteRes.data.success) {
      console.log(`✅ Task Deleted Successfully`);
    } else {
      console.log(`❌ Task Deletion Failed - Status ${deleteRes.status}: ${deleteRes.data.message}`);
    }

  } catch (err) {
    console.log('❌ Test failed with error:', err.response ? err.response.data : err.message);
  }

  // Summary
  console.log('\n' + '='.repeat(70));
  console.log('CRUD TEST COMPLETE');
  console.log('='.repeat(70));
}

runCrudTests();
