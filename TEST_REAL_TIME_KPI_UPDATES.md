# Test Plan: Real-Time KPI Card Updates

## Prerequisites
- Both backend (port 5000) and frontend (port 5173) servers are running
- Admin user is logged in to the dashboard
- Browser console is open to monitor Socket.IO events

## Test Scenarios

### Test 1: Expense Creation Real-Time Update
**Objective**: Verify that "This Month Expense" KPI updates when an employee submits an expense

**Steps**:
1. Open admin dashboard in one browser tab
2. Note the current "This Month Expense" value
3. Open employee dashboard in another tab (or use same browser with different user)
4. Employee navigates to Expenses page
5. Employee clicks "Add Expense" button
6. Employee fills in:
   - Title: "Test Expense"
   - Amount: 500
   - Category: "Travel"
   - Description: "Test expense for real-time update"
7. Employee clicks "Submit"
8. **Expected Result**: 
   - Admin dashboard "This Month Expense" KPI updates instantly
   - No page refresh needed
   - Console shows: "💰 Expense update received: { type: 'created', expense: {...} }"

### Test 2: Leave Request Real-Time Update
**Objective**: Verify that "On Leave" and "Pending Leaves" KPI updates when an employee applies for leave

**Steps**:
1. Open admin dashboard in one browser tab
2. Note the current "On Leave" and "Pending Leaves" values
3. Open employee dashboard in another tab
4. Employee navigates to Leave page
5. Employee clicks "Request Leave" button
6. Employee fills in:
   - Leave Type: "Vacation"
   - Start Date: Tomorrow
   - End Date: Day after tomorrow
   - Reason: "Test leave for real-time update"
7. Employee clicks "Submit"
8. **Expected Result**:
   - Admin dashboard "Pending Leaves" KPI increases by 1
   - Leave requests table shows new request with "pending" status
   - Console shows: "📅 Leave update received: { type: 'created', leave: {...} }"

### Test 3: Leave Approval Real-Time Update
**Objective**: Verify that leave status updates in real-time when admin approves

**Steps**:
1. Admin dashboard shows pending leave request
2. Admin clicks "Approve" button on the leave request
3. **Expected Result**:
   - Leave request status changes from "pending" to "approved" instantly
   - "Pending Leaves" KPI decreases by 1
   - Leave requests table updates without refresh
   - Console shows: "📅 Leave update received: { type: 'updated', leave: {...} }"

### Test 4: Attendance Check-In Real-Time Update
**Objective**: Verify that "Logged In Employees" KPI updates when employee checks in

**Steps**:
1. Open admin dashboard in one browser tab
2. Note the current "Logged In Employees" value
3. Open employee dashboard in another tab
4. Employee clicks "Check In" button
5. **Expected Result**:
   - Admin dashboard "Logged In Employees" KPI increases by 1
   - Today's Attendance table shows new check-in record
   - Console shows: "⏰ Attendance update received: {...}"

### Test 5: Multiple Employees Real-Time Update
**Objective**: Verify that KPI updates correctly with multiple employees submitting data

**Steps**:
1. Open admin dashboard
2. Open 3 employee dashboards in separate tabs
3. Employee 1 submits expense of 1000
4. Employee 2 applies for leave
5. Employee 3 checks in
6. **Expected Result**:
   - All KPI cards update instantly
   - "This Month Expense" increases by 1000
   - "Pending Leaves" increases by 1
   - "Logged In Employees" increases by 1
   - All updates happen without page refresh

### Test 6: Expense Update Real-Time Update
**Objective**: Verify that KPI updates when employee edits an expense

**Steps**:
1. Employee has submitted an expense for 500
2. Admin dashboard shows "This Month Expense" includes this 500
3. Employee edits the expense and changes amount to 750
4. **Expected Result**:
   - Admin dashboard "This Month Expense" updates instantly
   - Difference of 250 is added to the total
   - Console shows: "💰 Expense update received: { type: 'updated', expense: {...} }"

### Test 7: Expense Deletion Real-Time Update
**Objective**: Verify that KPI updates when employee deletes an expense

**Steps**:
1. Employee has submitted an expense for 500
2. Admin dashboard shows "This Month Expense" includes this 500
3. Employee deletes the expense
4. **Expected Result**:
   - Admin dashboard "This Month Expense" decreases by 500
   - Console shows: "💰 Expense update received: { type: 'deleted', expense: {...} }"

## Browser Console Monitoring

### Expected Console Logs:
```
✅ Socket connected: [socket-id]
🔐 Authenticating with: { userId: '...', role: 'admin', orgId: '...' }
✅ Socket authenticated: { success: true, ... }
📊 Dashboard update event received: { type: 'active_users_updated', ... }
💰 Expense update received: { type: 'created', expense: {...} }
📅 Leave update received: { type: 'created', leave: {...} }
⏰ Attendance update received: {...}
```

### Troubleshooting Console Logs:
- If you see "❌ Socket connection error", check backend server is running
- If you see "❌ Socket authentication failed", check JWT token is valid
- If you see "📊 Dashboard update event received" but KPI doesn't update, check browser console for errors in handleDashboardUpdate()

## Performance Metrics

### Expected Performance:
- KPI update latency: < 1 second
- No page refresh required
- Smooth animation/transition of KPI values
- No console errors or warnings

### Performance Issues to Watch For:
- If KPI updates take > 2 seconds, check network latency
- If multiple updates cause lag, check browser performance
- If Socket.IO connection drops, check firewall/proxy settings

## Rollback Plan

If real-time updates are not working:
1. Check backend server logs for errors
2. Check frontend browser console for Socket.IO errors
3. Verify Socket.IO connection is established
4. Check that `req.emitDashboardUpdate()` is being called in routes
5. Verify that frontend is listening to the correct events
6. Check that orgId/tenantId is being passed correctly

## Success Criteria

✅ All 7 test scenarios pass
✅ KPI cards update within 1 second of data submission
✅ No page refresh required
✅ No console errors
✅ Multiple simultaneous updates work correctly
✅ Leave approval/rejection updates in real-time
✅ Expense CRUD operations update KPI instantly
✅ Attendance check-in/out updates KPI instantly
