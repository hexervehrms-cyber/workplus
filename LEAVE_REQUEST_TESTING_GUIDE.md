# Leave Request Testing Guide

## Quick Test Steps

### Test 1: Submit Leave Request (Employee)

**Steps:**
1. Login as employee
2. Navigate to Employee > Leave Management
3. Click "Request Leave" button
4. Fill form:
   - Leave Type: "Sick Leave"
   - From Date: Today
   - To Date: Tomorrow
   - Reason: "Medical appointment"
5. Click "Submit Request"

**Expected Result:**
- ✅ Success toast message appears
- ✅ Dialog closes
- ✅ Leave appears in history with "Pending" status
- ✅ Leave balance updates

---

### Test 2: View Leave History (Employee)

**Steps:**
1. After submitting leave request
2. Check "Leave History" section

**Expected Result:**
- ✅ Leave request appears with correct details
- ✅ Status shows "Pending"
- ✅ Dates are formatted correctly
- ✅ Reason is displayed

---

### Test 3: Approve Leave Request (Admin)

**Steps:**
1. Login as admin
2. Navigate to Admin > Leave Requests
3. Find pending leave request
4. Click "Approve" button

**Expected Result:**
- ✅ Status changes to "Approved" (green badge)
- ✅ Employee receives notification
- ✅ Leave balance updates
- ✅ Real-time update in admin panel

---

### Test 4: Reject Leave Request (Admin)

**Steps:**
1. Login as admin
2. Navigate to Admin > Leave Requests
3. Find pending leave request
4. Click "Reject" button

**Expected Result:**
- ✅ Status changes to "Rejected" (red badge)
- ✅ Employee receives notification with reason
- ✅ Leave balance remains unchanged
- ✅ Real-time update in admin panel

---

### Test 5: Bulk Approve (Admin)

**Steps:**
1. Login as admin
2. Navigate to Admin > Leave Requests
3. Select multiple pending requests (checkboxes)
4. Click "Approve Selected" button

**Expected Result:**
- ✅ All selected requests change to "Approved"
- ✅ Count shows correct number selected
- ✅ All employees receive notifications
- ✅ Real-time updates for all

---

### Test 6: Bulk Reject (Admin)

**Steps:**
1. Login as admin
2. Navigate to Admin > Leave Requests
3. Select multiple pending requests
4. Click "Reject Selected" button

**Expected Result:**
- ✅ All selected requests change to "Rejected"
- ✅ All employees receive notifications
- ✅ Real-time updates for all

---

### Test 7: Leave Balance Calculation

**Steps:**
1. Check leave balance cards
2. Submit multiple leave requests
3. Approve some requests
4. Check balance updates

**Expected Result:**
- ✅ Total days remain constant
- ✅ Used days increase when approved
- ✅ Remaining days decrease correctly
- ✅ All leave types tracked separately

---

### Test 8: Error Handling

**Steps:**
1. Try to submit without filling all fields
2. Try to submit with end date before start date
3. Try to submit overlapping leave requests

**Expected Result:**
- ✅ Error message appears
- ✅ Form is not submitted
- ✅ User can correct and retry

---

## Data Validation Tests

### Valid Leave Request
```javascript
{
  userId: "user123",
  employeeId: "emp456",
  leaveType: "Sick Leave",
  startDate: "2026-05-10",
  endDate: "2026-05-12",
  reason: "Medical appointment",
  orgId: "org789"
}
```
✅ Should succeed

### Invalid - Missing Fields
```javascript
{
  userId: "user123",
  // Missing employeeId
  leaveType: "Sick Leave",
  startDate: "2026-05-10",
  endDate: "2026-05-12",
  reason: "Medical appointment",
  orgId: "org789"
}
```
❌ Should fail with "All fields are required"

### Invalid - End Before Start
```javascript
{
  userId: "user123",
  employeeId: "emp456",
  leaveType: "Sick Leave",
  startDate: "2026-05-12",
  endDate: "2026-05-10",  // Before start date
  reason: "Medical appointment",
  orgId: "org789"
}
```
❌ Should fail with "End date must be after start date"

---

## Browser Console Checks

### Check Request Payload
```javascript
// Open browser console (F12)
// Submit leave request
// Look for: "Submitting leave request:"
// Verify payload has:
// - userId ✅
// - employeeId ✅
// - leaveType ✅
// - startDate ✅
// - endDate ✅
// - reason ✅
// - orgId ✅
```

### Check Response
```javascript
// After submission, check response:
// {
//   success: true,
//   message: "Leave request submitted successfully",
//   data: {
//     leaveRequest: { ... }
//   }
// }
```

---

## Common Issues & Solutions

### Issue: "Submit Request" button doesn't work
**Solution:**
- Check browser console for errors
- Verify all form fields are filled
- Check network tab for API response
- Verify backend is running

### Issue: Leave doesn't appear in history
**Solution:**
- Refresh page (Ctrl+Shift+R)
- Check if request was actually submitted (check admin panel)
- Verify user ID is correct
- Check browser console for errors

### Issue: Admin panel shows no requests
**Solution:**
- Verify admin is logged in
- Check if employees have submitted requests
- Refresh page
- Check network tab for API response

### Issue: Real-time updates not working
**Solution:**
- Check Socket.IO connection (should show "connected")
- Verify WebSocket is not blocked by firewall
- Check browser console for socket errors
- Restart browser

---

## Performance Tests

### Load Test
1. Submit 10+ leave requests
2. Check admin panel loads all
3. Verify no lag in UI

### Bulk Operation Test
1. Select 50+ requests
2. Bulk approve/reject
3. Verify all update correctly

### Real-time Test
1. Open admin panel in 2 browsers
2. Submit request in one
3. Verify appears in other immediately

---

## Regression Tests

### After Each Fix
- [ ] Submit leave request works
- [ ] Leave history displays correctly
- [ ] Admin panel shows all requests
- [ ] Approve/reject works
- [ ] Bulk operations work
- [ ] Real-time updates work
- [ ] Error handling works
- [ ] Leave balance updates

---

## Test Data

### Test Employees
- Employee 1: emp001@company.com
- Employee 2: emp002@company.com
- Employee 3: emp003@company.com

### Test Leave Types
- Vacation
- Sick Leave
- Personal
- Emergency

### Test Dates
- Today: 2026-05-03
- Tomorrow: 2026-05-04
- Next Week: 2026-05-10
- Next Month: 2026-06-03

---

## Sign-Off Checklist

- [ ] All tests passed
- [ ] No console errors
- [ ] No network errors
- [ ] Real-time updates working
- [ ] Admin panel functional
- [ ] Employee dashboard functional
- [ ] Error handling working
- [ ] Performance acceptable
- [ ] Ready for production
