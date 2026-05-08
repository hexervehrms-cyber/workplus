# Test Plan: Logged In Employees KPI Fix

## Prerequisites
- Backend server running on port 5000
- Frontend running on port 5173
- Admin user logged in to dashboard
- Employee user (Rinky) available for testing
- Browser developer console open

## Test Scenario 1: Single Employee Login

### Steps:
1. Open admin dashboard in browser tab 1
2. Note "Logged In Employees" KPI value (should be 0 or current count)
3. Open employee login page in browser tab 2
4. Employee (Rinky) logs in with credentials
5. Wait 2 seconds for Socket.IO connection

### Expected Results:
- ✅ "Logged In Employees" KPI increases by 1
- ✅ No page refresh needed
- ✅ Update happens within 2 seconds
- ✅ Console shows: "📊 Dashboard update event received"

### Verification:
```javascript
// In browser console on admin dashboard
realTimeSocket.isConnected()  // Should return true
```

---

## Test Scenario 2: Multiple Employees Login

### Steps:
1. Open admin dashboard
2. Note current "Logged In Employees" value
3. Open 3 employee login pages in separate tabs
4. Employee 1 (Rinky) logs in
5. Wait 1 second
6. Employee 2 logs in
7. Wait 1 second
8. Employee 3 logs in
9. Wait 2 seconds

### Expected Results:
- ✅ KPI increases from 0 → 1 → 2 → 3
- ✅ Each update happens within 2 seconds
- ✅ No duplicate counts
- ✅ All employees show as logged in

### Verification:
```javascript
// Check database
db.sessions.countDocuments({ isActive: true, role: 'employee' })
// Should return 3
```

---

## Test Scenario 3: Employee Logout

### Steps:
1. Employee (Rinky) is logged in
2. Admin dashboard shows "Logged In Employees: 1"
3. Employee clicks logout button
4. Wait 1 second

### Expected Results:
- ✅ "Logged In Employees" KPI decreases to 0
- ✅ Update happens within 1 second
- ✅ No page refresh needed
- ✅ Console shows logout event

### Verification:
```javascript
// Check database
db.sessions.countDocuments({ isActive: true, role: 'employee' })
// Should return 0
```

---

## Test Scenario 4: Employee Browser Close

### Steps:
1. Employee (Rinky) is logged in
2. Admin dashboard shows "Logged In Employees: 1"
3. Employee closes browser tab (or closes browser)
4. Wait 5 seconds (Socket.IO timeout)

### Expected Results:
- ✅ "Logged In Employees" KPI decreases to 0
- ✅ Update happens within 5 seconds
- ✅ Session marked as inactive in database
- ✅ Console shows disconnect event

### Verification:
```javascript
// Check database
db.sessions.findOne({ userId: rinky_id, isActive: true })
// Should return null
```

---

## Test Scenario 5: Rapid Login/Logout

### Steps:
1. Employee logs in
2. Admin dashboard shows "Logged In Employees: 1"
3. Employee immediately logs out
4. Admin dashboard shows "Logged In Employees: 0"
5. Employee logs in again
6. Admin dashboard shows "Logged In Employees: 1"

### Expected Results:
- ✅ All updates happen correctly
- ✅ No duplicate sessions created
- ✅ KPI counts are accurate
- ✅ No errors in console

### Verification:
```javascript
// Check database for duplicate sessions
db.sessions.find({ userId: rinky_id }).count()
// Should be 3 (login, logout, login)
// But only 1 should be isActive: true
```

---

## Test Scenario 6: Session Persistence

### Steps:
1. Employee logs in
2. Admin dashboard shows "Logged In Employees: 1"
3. Wait 5 minutes
4. Admin dashboard still shows "Logged In Employees: 1"
5. Employee is still logged in

### Expected Results:
- ✅ Session remains active
- ✅ KPI remains at 1
- ✅ No automatic logout
- ✅ Session data persists in database

### Verification:
```javascript
// Check database
db.sessions.findOne({ userId: rinky_id, isActive: true })
// Should still exist with same loginTime
```

---

## Test Scenario 7: Multiple Admins Viewing Dashboard

### Steps:
1. Admin 1 opens dashboard
2. Admin 2 opens dashboard in different browser
3. Employee logs in
4. Both admins should see update

### Expected Results:
- ✅ Both admins see "Logged In Employees: 1"
- ✅ Both receive real-time update
- ✅ No race conditions
- ✅ Counts are consistent

---

## Test Scenario 8: Cross-Organization Isolation

### Steps:
1. Organization A admin opens dashboard
2. Organization B admin opens dashboard
3. Organization A employee logs in
4. Check both dashboards

### Expected Results:
- ✅ Organization A shows "Logged In Employees: 1"
- ✅ Organization B shows "Logged In Employees: 0"
- ✅ No cross-organization data leakage
- ✅ Sessions properly isolated by orgId

---

## Browser Console Monitoring

### Expected Console Logs:

**On Employee Login:**
```
✅ Socket connected: [socket-id]
🔐 Authenticating with: { userId: '...', role: 'employee', orgId: '...' }
✅ Socket authenticated: { success: true, ... }
📊 Dashboard update event received: { type: 'active_users_updated', data: { activeUsers: 1 } }
```

**On Employee Logout:**
```
📊 Dashboard update event received: { type: 'active_users_updated', data: { activeUsers: 0 } }
```

**On Socket Disconnect:**
```
⚠️ Socket disconnected: io server disconnect
📊 Dashboard update event received: { type: 'active_users_updated', data: { activeUsers: 0 } }
```

---

## Backend Log Monitoring

### Expected Backend Logs:

**On Login:**
```
Session created on login: { userId: '...', sessionId: '...', orgId: '...' }
Dashboard update emitted on login: { orgId: '...', activeUsers: 1, userId: '...' }
```

**On Socket.IO Connect:**
```
Session updated for user: { sessionId: '...', socketId: '...' }
```

**On Logout:**
```
User logged out: { userId: '...', sessionsUpdated: 1 }
```

**On Disconnect:**
```
User disconnected: { userId: '...', role: 'employee', tenantId: '...' }
Session marked inactive: { sessionId: '...' }
Dashboard update emitted for tenant: { activeUsers: 0 }
```

---

## Database Verification

### Check Active Sessions:
```javascript
// Count active employee sessions
db.sessions.countDocuments({ isActive: true, role: 'employee' })

// List all active sessions
db.sessions.find({ isActive: true }).pretty()

// Check specific user sessions
db.sessions.find({ userId: ObjectId('...') }).pretty()
```

### Check Session Timeline:
```javascript
// View session lifecycle
db.sessions.findOne({ userId: ObjectId('...') })
// Should show: loginTime, connectTime, logoutTime
```

---

## Performance Metrics

### Expected Performance:
- **Login to KPI Update**: < 2 seconds
- **Logout to KPI Update**: < 1 second
- **Disconnect to KPI Update**: < 5 seconds
- **Database Query**: < 100ms
- **Socket.IO Event Delivery**: < 100ms

### Performance Issues to Watch:
- If KPI update takes > 5 seconds, check network latency
- If database query is slow, check indexes
- If Socket.IO events are delayed, check server load

---

## Troubleshooting

### Issue: KPI shows 0 even though employee is logged in

**Solution:**
1. Check if session was created: `db.sessions.find({ isActive: true })`
2. Check if Socket.IO is connected: `realTimeSocket.isConnected()`
3. Check browser console for errors
4. Check backend logs for session creation errors
5. Verify orgId matches between user and session

### Issue: KPI shows incorrect count

**Solution:**
1. Check for duplicate sessions: `db.sessions.find({ userId: '...' }).count()`
2. Check for stale sessions: `db.sessions.find({ isActive: true, createdAt: { $lt: new Date(Date.now() - 24*60*60*1000) } })`
3. Run cleanup: Mark old sessions as inactive
4. Refresh dashboard

### Issue: KPI doesn't update on logout

**Solution:**
1. Check if logout endpoint was called
2. Check if sessions were marked inactive
3. Check if dashboard update event was emitted
4. Check browser console for errors
5. Verify Socket.IO connection is still active

---

## Success Criteria

✅ All 8 test scenarios pass
✅ KPI updates within expected timeframes
✅ No console errors
✅ No database errors
✅ Sessions properly created and cleaned up
✅ Cross-organization isolation maintained
✅ Real-time updates work reliably
✅ No duplicate sessions created

---

## Sign-Off

- [ ] Test Scenario 1: Single Employee Login - PASSED
- [ ] Test Scenario 2: Multiple Employees Login - PASSED
- [ ] Test Scenario 3: Employee Logout - PASSED
- [ ] Test Scenario 4: Employee Browser Close - PASSED
- [ ] Test Scenario 5: Rapid Login/Logout - PASSED
- [ ] Test Scenario 6: Session Persistence - PASSED
- [ ] Test Scenario 7: Multiple Admins - PASSED
- [ ] Test Scenario 8: Cross-Organization Isolation - PASSED
- [ ] Performance Metrics Verified - PASSED
- [ ] No Console Errors - PASSED
- [ ] No Database Errors - PASSED

**Tested By**: _______________
**Date**: _______________
**Status**: ✅ READY FOR PRODUCTION
