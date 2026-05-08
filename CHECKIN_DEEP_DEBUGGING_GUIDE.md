# Check-in State Persistence - Deep Debugging Guide

## Enhanced Logging Added

I've added comprehensive logging to both frontend and backend to help identify exactly where the issue is occurring.

## Step-by-Step Debugging

### Step 1: Check Backend Logs During Check-in

When you click "Check In", look for these logs in the backend console:

```
CHECK-IN REQUEST: {
  bodyUserId: "xxx",
  bodyEmployeeId: "xxx",
  bodyOrgId: "xxx",
  authUserId: "xxx",
  authOrgId: "xxx"
}

CHECK-IN DATE RANGE: {
  today: 2026-05-06T00:00:00.000Z,
  tomorrow: 2026-05-07T00:00:00.000Z
}

EXISTING ATTENDANCE CHECK: {
  found: false,
  checkIn: null,
  checkOut: null
}

ATTENDANCE CREATED: {
  id: "xxx",
  userId: "xxx",
  orgId: "xxx",
  checkIn: 2026-05-06T14:30:00.000Z,
  date: 2026-05-06T00:00:00.000Z
}
```

**What to check:**
- ✅ `bodyUserId` should match `authUserId`
- ✅ `bodyOrgId` should match `authOrgId`
- ✅ `ATTENDANCE CREATED` should show the record was saved

### Step 2: Check Backend Logs During Page Refresh

When you refresh the page, look for these logs:

```
GET /today - Fetching attendance for: {
  currentUserId: "xxx",
  userOrgId: "xxx"
}

Query date range: {
  today: 2026-05-06T00:00:00.000Z,
  tomorrow: 2026-05-07T00:00:00.000Z
}

Attendance query result (by userId): {
  found: true,
  userId: "xxx",
  orgId: "xxx",
  checkIn: 2026-05-06T14:30:00.000Z,
  checkOut: null,
  status: "present"
}

Calculated liveStatus: checked_in
```

**What to check:**
- ✅ `currentUserId` should match the userId from check-in
- ✅ `found: true` means record was found
- ✅ `checkIn` should have a timestamp
- ✅ `checkOut` should be null
- ✅ `liveStatus` should be "checked_in"

### Step 3: Check Frontend Logs

In browser console (F12), look for:

```
Attendance API response: {
  success: true,
  data: {
    attendance: {...},
    liveStatus: {
      status: "checked_in",
      ...
    }
  }
}

Attendance data received: {
  checkIn: 2026-05-06T14:30:00.000Z,
  checkOut: null,
  isCurrentlyCheckedIn: true,
  status: "present"
}

State updated - isCheckedIn: true
```

**What to check:**
- ✅ API response should have `success: true`
- ✅ `attendance` should have checkIn timestamp
- ✅ `isCurrentlyCheckedIn` should be `true`
- ✅ State should be updated to `isCheckedIn: true`

## Possible Issues and Solutions

### Issue 1: userId Mismatch

**Symptom**: Backend logs show different userId in check-in vs query

**Cause**: Frontend is sending wrong userId

**Solution**:
```javascript
// In browser console, check:
const user = JSON.parse(localStorage.getItem('user') || '{}');
console.log('User ID:', user.id);
console.log('User ID type:', typeof user.id);
```

### Issue 2: orgId Mismatch

**Symptom**: Backend logs show different orgId in check-in vs query

**Cause**: Frontend is sending wrong orgId

**Solution**:
```javascript
// In browser console, check:
const user = JSON.parse(localStorage.getItem('user') || '{}');
console.log('Org ID:', user.orgId || user.tenantId);
```

### Issue 3: Record Not Found in Query

**Symptom**: `found: false` in GET /today logs

**Cause**: Record was not saved or query is wrong

**Solution**:
1. Check if "ATTENDANCE CREATED" log appears during check-in
2. If it does, check if userId/orgId match
3. If they don't match, that's the problem

### Issue 4: API Response Not Received

**Symptom**: No "Attendance API response" log in browser console

**Cause**: API call failed or response not processed

**Solution**:
```javascript
// In browser console, check:
const token = localStorage.getItem('authToken') || localStorage.getItem('token');
fetch('/api/attendance/today', {
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  }
})
.then(res => {
  console.log('Response status:', res.status);
  return res.json();
})
.then(data => console.log('Response data:', data))
.catch(err => console.error('Error:', err));
```

### Issue 5: State Not Updating

**Symptom**: API returns correct data but state doesn't update

**Cause**: React state update not working

**Solution**:
1. Check React DevTools for component state
2. Verify `setIsCheckedIn` is being called
3. Check for console errors

## Database Verification

### Check if Record Exists

```javascript
// In MongoDB
db.attendances.findOne({ 
  date: { $gte: new Date("2026-05-06") }
}).pretty()
```

**Expected output:**
```javascript
{
  _id: ObjectId("xxx"),
  userId: ObjectId("xxx"),
  employeeId: ObjectId("xxx"),
  orgId: "xxx",
  date: ISODate("2026-05-06T00:00:00.000Z"),
  checkIn: ISODate("2026-05-06T14:30:00.000Z"),
  checkOut: null,
  status: "present",
  ...
}
```

### Check All Records for a User

```javascript
// In MongoDB
db.attendances.find({ 
  userId: ObjectId("xxx"),
  date: { $gte: new Date("2026-05-06") }
}).pretty()
```

## Complete Debugging Workflow

### 1. Check-in Phase
```
1. Click "Check In"
2. Look for "CHECK-IN REQUEST" log
3. Verify userId and orgId match
4. Look for "ATTENDANCE CREATED" log
5. Verify record was saved with correct data
```

### 2. Refresh Phase
```
1. Refresh page (F5)
2. Look for "GET /today" log
3. Verify userId and orgId match check-in
4. Look for "Attendance query result" log
5. Check if record was found (found: true/false)
```

### 3. Frontend Phase
```
1. Check browser console
2. Look for "Attendance API response" log
3. Verify success: true
4. Look for "Attendance data received" log
5. Verify isCurrentlyCheckedIn: true
6. Look for "State updated" log
7. Verify isCheckedIn: true
```

### 4. UI Phase
```
1. Check if "Check Out" button appears
2. If not, check all previous logs
3. Identify where the issue occurs
```

## Collecting Diagnostic Information

When reporting the issue, provide:

1. **Backend logs** (from check-in and refresh):
   - CHECK-IN REQUEST
   - ATTENDANCE CREATED
   - GET /today
   - Attendance query result

2. **Frontend logs** (from browser console):
   - Attendance API response
   - Attendance data received
   - State updated

3. **Database query result**:
   - Show attendance record from MongoDB

4. **Screenshots**:
   - Browser console logs
   - Backend server logs
   - Database query result

## Quick Diagnostic Script

Run this in browser console to collect all diagnostic info:

```javascript
console.log('=== DIAGNOSTIC INFORMATION ===\n');

// 1. User data
const user = JSON.parse(localStorage.getItem('user') || '{}');
console.log('1. USER DATA:');
console.log('User ID:', user.id);
console.log('Org ID:', user.orgId || user.tenantId);
console.log('');

// 2. Test API
console.log('2. TESTING API:');
const token = localStorage.getItem('authToken') || localStorage.getItem('token');
fetch('/api/attendance/today', {
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  }
})
.then(res => res.json())
.then(data => {
  console.log('API Response:', data);
  console.log('Has attendance:', !!data.data?.attendance);
  console.log('Check-in:', data.data?.attendance?.checkIn);
  console.log('Is checked in:', !!data.data?.attendance?.checkIn && !data.data?.attendance?.checkOut);
})
.catch(err => console.error('API Error:', err));
```

---
**Deep Debugging Guide Date**: 2026-05-06
**Status**: ✅ Ready to Use
