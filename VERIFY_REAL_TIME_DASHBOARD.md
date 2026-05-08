# Verify Real-Time Dashboard Updates - Quick Guide

## How to Test the Fix

### Step 1: Open Admin Dashboard
1. Login as Admin
2. Navigate to Admin → Dashboard
3. Note the "Logged In Employees" count in the Operational Metrics section

### Step 2: Login as Employee (New Browser/Tab)
1. Open a new browser tab or window
2. Go to the login page
3. Login with an employee account
4. **Expected**: Admin dashboard should immediately show +1 in "Logged In Employees"

### Step 3: Logout Employee
1. In the employee browser tab, click logout
2. **Expected**: Admin dashboard should immediately show -1 in "Logged In Employees"

### Step 4: Multiple Employees
1. Login with multiple employee accounts in different tabs
2. **Expected**: Admin dashboard count increases with each login
3. Logout each employee
4. **Expected**: Admin dashboard count decreases with each logout

### Step 5: Refresh Admin Dashboard
1. While employees are logged in, refresh the admin dashboard
2. **Expected**: "Logged In Employees" count should match the number of active sessions

## What to Look For

### In Admin Dashboard
- **Operational Metrics** section
- **Logged In Employees** KPI card
- Should show real-time count (0, 1, 2, 3, etc.)
- Should update instantly when employees log in/out

### In Browser Console (Admin)
Look for these logs:
```
📊 Dashboard update event received: {
  type: 'active_users_updated',
  data: {
    activeUsers: 1,
    userId: 'user_123',
    role: 'employee',
    action: 'login'
  }
}
```

### In Backend Logs
Look for these messages:
```
✅ Socket connected: socket_id
✅ Socket authenticated: user_id
📊 Dashboard update emitted for tenant org_id { activeUsers: 1 }
⚠️ User disconnected: socket_id
📊 Dashboard update emitted for tenant org_id { activeUsers: 0 }
```

## Troubleshooting

### Issue: Count doesn't update
**Check**:
1. Is Socket.IO connected? (Check browser console for "✅ Socket connected")
2. Is authentication successful? (Check for "✅ Socket authenticated")
3. Are there any errors in backend logs?
4. Is the Session model imported in server.js?

### Issue: Count shows 0 even with logged-in employees
**Check**:
1. Restart backend server
2. Check if Session collection exists in MongoDB
3. Verify Socket.IO is running on port 5000
4. Check if frontend is connecting to correct socket URL

### Issue: Count increases but doesn't decrease on logout
**Check**:
1. Verify disconnect handler is being called
2. Check if Session.findByIdAndUpdate is working
3. Look for errors in backend logs during disconnect

## Database Verification

### Check Active Sessions
```javascript
// In MongoDB shell
db.sessions.find({ isActive: true })
```

Should show one document per logged-in employee.

### Check Session Count
```javascript
db.sessions.countDocuments({ isActive: true })
```

Should match the "Logged In Employees" count in admin dashboard.

### Check Session Details
```javascript
db.sessions.find({ isActive: true }).pretty()
```

Should show:
- userId: Employee's user ID
- orgId: Organization ID
- socketId: Socket connection ID
- role: 'employee'
- isActive: true
- loginTime: When they logged in

## Performance Check

### Monitor Real-Time Updates
1. Open admin dashboard
2. Open browser DevTools → Network tab
3. Login/logout employees
4. Should see Socket.IO messages (not HTTP requests)
5. Updates should be instant (< 100ms)

### Check Database Performance
1. Monitor MongoDB for slow queries
2. Session queries should be < 10ms
3. No N+1 query problems

## Success Criteria

✅ Admin dashboard shows correct count of logged-in employees
✅ Count updates instantly when employees log in
✅ Count updates instantly when employees log out
✅ Count is accurate after dashboard refresh
✅ Multiple employees can be tracked simultaneously
✅ No errors in browser console
✅ No errors in backend logs
✅ Socket.IO connection is stable
✅ Database queries are fast

## Common Test Scenarios

### Scenario 1: Single Employee
1. Admin dashboard shows 0 logged-in employees
2. Employee logs in
3. Admin dashboard shows 1 logged-in employee
4. Employee logs out
5. Admin dashboard shows 0 logged-in employees
✅ **Expected**: All steps work correctly

### Scenario 2: Multiple Employees
1. Admin dashboard shows 0 logged-in employees
2. Employee 1 logs in → shows 1
3. Employee 2 logs in → shows 2
4. Employee 3 logs in → shows 3
5. Employee 2 logs out → shows 2
6. Employee 1 logs out → shows 1
7. Employee 3 logs out → shows 0
✅ **Expected**: Count increases/decreases correctly

### Scenario 3: Dashboard Refresh
1. 3 employees are logged in
2. Admin dashboard shows 3 logged-in employees
3. Admin refreshes dashboard
4. Admin dashboard still shows 3 logged-in employees
✅ **Expected**: Count persists after refresh

### Scenario 4: Browser Close
1. Employee is logged in
2. Admin dashboard shows 1 logged-in employee
3. Employee closes browser (without logout)
4. Admin dashboard shows 0 logged-in employees (after ~5 seconds)
✅ **Expected**: Socket disconnect is detected

## Next Steps

If all tests pass:
1. ✅ Real-time dashboard updates are working
2. ✅ System is ready for production
3. ✅ Monitor for any issues in production

If tests fail:
1. Check troubleshooting section
2. Review backend logs
3. Verify database connection
4. Restart services if needed
5. Contact support if issues persist

## Support

For issues or questions:
1. Check backend logs: `backend/logs/all.log`
2. Check browser console for errors
3. Verify Socket.IO connection
4. Check MongoDB for Session collection
5. Review this guide's troubleshooting section
