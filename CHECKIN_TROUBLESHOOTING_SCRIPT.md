# Check-in Troubleshooting Script

## Browser Console Debugging Script

Copy and paste this script into your browser console (F12) to diagnose check-in issues:

```javascript
// ============================================
// CHECK-IN STATE PERSISTENCE TROUBLESHOOTING
// ============================================

console.log('=== CHECK-IN TROUBLESHOOTING SCRIPT ===\n');

// 1. Check User Data
console.log('1. USER DATA:');
const user = JSON.parse(localStorage.getItem('user') || '{}');
console.log('User ID:', user.id);
console.log('User Name:', user.name);
console.log('Org ID:', user.orgId || user.tenantId);
console.log('Role:', user.role);
console.log('Full User:', user);
console.log('');

// 2. Check Token
console.log('2. AUTHENTICATION TOKEN:');
const token = localStorage.getItem('authToken') || localStorage.getItem('token');
console.log('Token exists:', !!token);
console.log('Token length:', token?.length);
console.log('Token preview:', token?.substring(0, 50) + '...');
console.log('');

// 3. Test API Call
console.log('3. TESTING API CALL:');
fetch('/api/attendance/today', {
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  }
})
.then(res => {
  console.log('API Response Status:', res.status);
  return res.json();
})
.then(data => {
  console.log('API Response Data:', data);
  if (data.data?.attendance) {
    console.log('Check-in Time:', data.data.attendance.checkIn);
    console.log('Check-out Time:', data.data.attendance.checkOut);
    console.log('Status:', data.data.attendance.status);
    console.log('Live Status:', data.data.liveStatus?.status);
    console.log('Is Checked In:', !!data.data.attendance.checkIn && !data.data.attendance.checkOut);
  } else {
    console.log('No attendance data found');
  }
})
.catch(err => {
  console.error('API Error:', err);
});
console.log('');

// 4. Check Local Storage
console.log('4. LOCAL STORAGE:');
console.log('Keys:', Object.keys(localStorage));
console.log('');

// 5. Check Session Storage
console.log('5. SESSION STORAGE:');
console.log('Keys:', Object.keys(sessionStorage));
console.log('');

// 6. Check React State (if available)
console.log('6. REACT STATE:');
console.log('(Check React DevTools for component state)');
console.log('');

console.log('=== END TROUBLESHOOTING ===');
```

## Step-by-Step Troubleshooting

### Step 1: Verify User Authentication
```javascript
// Check if user is logged in
const user = JSON.parse(localStorage.getItem('user') || '{}');
console.log('User logged in:', !!user.id);
console.log('User ID:', user.id);
```

**Expected Output**: User ID should be a valid MongoDB ObjectId

### Step 2: Verify Token
```javascript
// Check if authentication token exists
const token = localStorage.getItem('authToken') || localStorage.getItem('token');
console.log('Token exists:', !!token);
console.log('Token is valid JWT:', token?.split('.').length === 3);
```

**Expected Output**: Token should exist and have 3 parts (JWT format)

### Step 3: Test Attendance API
```javascript
// Test the attendance API directly
const token = localStorage.getItem('authToken') || localStorage.getItem('token');
fetch('/api/attendance/today', {
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  }
})
.then(res => res.json())
.then(data => {
  console.log('Response:', data);
  console.log('Has attendance:', !!data.data?.attendance);
  console.log('Check-in time:', data.data?.attendance?.checkIn);
  console.log('Is checked in:', !!data.data?.attendance?.checkIn && !data.data?.attendance?.checkOut);
});
```

**Expected Output**: 
- `success: true`
- `data.attendance` with checkIn timestamp
- `data.liveStatus.status` showing "checked_in"

### Step 4: Check Database Directly
```javascript
// If you have MongoDB access, run this query
db.attendances.findOne({ 
  date: { $gte: new Date("2026-05-06") }
}).pretty()
```

**Expected Output**: Should show attendance record with:
- `checkIn`: timestamp
- `checkOut`: null (if still checked in)
- `status`: "present"

### Step 5: Monitor Network Requests
1. Open DevTools (F12)
2. Go to Network tab
3. Refresh page
4. Look for `/api/attendance/today` request
5. Check:
   - Status: 200 (success)
   - Response: Contains attendance data
   - Headers: Authorization header present

## Common Issues and Solutions

### Issue 1: API Returns 401 Unauthorized
**Cause**: Token is invalid or expired
**Solution**:
```javascript
// Log out and log back in
localStorage.clear();
// Refresh page and log in again
```

### Issue 2: API Returns 404 Not Found
**Cause**: Endpoint doesn't exist or wrong URL
**Solution**:
```javascript
// Verify endpoint is correct
console.log('API URL:', '/api/attendance/today');
// Check if backend is running
```

### Issue 3: API Returns Empty Attendance
**Cause**: No attendance record in database
**Solution**:
```javascript
// Check if check-in was successful
// Try checking in again
// Verify database has the record
```

### Issue 4: State Not Updating After Check-in
**Cause**: State update not being triggered
**Solution**:
```javascript
// Check React DevTools for component state
// Verify fetchDashboardData is being called
// Check console for errors
```

## Advanced Debugging

### Monitor State Changes
```javascript
// Add this to monitor state changes
const originalSetState = React.useState;
React.useState = function(initialValue) {
  const [state, setState] = originalSetState(initialValue);
  console.log('State changed:', state);
  return [state, setState];
};
```

### Monitor API Calls
```javascript
// Intercept fetch calls
const originalFetch = window.fetch;
window.fetch = function(...args) {
  console.log('API Call:', args[0]);
  return originalFetch.apply(this, args)
    .then(res => {
      console.log('API Response:', res.status);
      return res;
    });
};
```

### Check Component Lifecycle
```javascript
// Monitor component mount/unmount
console.log('Component mounted at:', new Date().toLocaleTimeString());
// Check if useEffect hooks are running
```

## Performance Monitoring

### Check API Response Time
```javascript
const start = performance.now();
fetch('/api/attendance/today', {
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  }
})
.then(res => res.json())
.then(data => {
  const end = performance.now();
  console.log('API Response Time:', (end - start).toFixed(2) + 'ms');
});
```

### Check Memory Usage
```javascript
// Check memory usage (Chrome only)
if (performance.memory) {
  console.log('Memory Usage:', {
    usedJSHeapSize: (performance.memory.usedJSHeapSize / 1048576).toFixed(2) + ' MB',
    totalJSHeapSize: (performance.memory.totalJSHeapSize / 1048576).toFixed(2) + ' MB',
    jsHeapSizeLimit: (performance.memory.jsHeapSizeLimit / 1048576).toFixed(2) + ' MB'
  });
}
```

## Logging Checklist

When reporting an issue, provide:
- [ ] Browser console logs (screenshot or copy)
- [ ] Backend server logs
- [ ] Network tab showing API calls
- [ ] Database query results
- [ ] User ID and Org ID
- [ ] Steps to reproduce
- [ ] Expected vs actual behavior

---
**Troubleshooting Script Date**: 2026-05-06
**Status**: ✅ Ready to Use
