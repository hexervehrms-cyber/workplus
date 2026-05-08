# Attendance System Testing Guide

## Quick Start Testing

### Test 1: Basic Check-in/Check-out
1. **Login** as an employee
2. **Navigate** to Employee Dashboard
3. **Click** "Check In" button
   - ✅ Should see success message
   - ✅ Button should change to "Check Out"
   - ✅ Check-in time should display
4. **Wait** a few seconds
5. **Click** "Check Out" button
   - ✅ Should see success message
   - ✅ Hours worked should display
   - ✅ Button should change back to "Check In"

### Test 2: Data Persistence
1. **Check in** as an employee
2. **Refresh** the page (F5 or Ctrl+R)
3. **Verify**:
   - ✅ Still shows as checked in
   - ✅ Check-in time is preserved
   - ✅ Hours worked continues to update
4. **Check out**
5. **Refresh** the page again
6. **Verify**:
   - ✅ Shows as checked out
   - ✅ Check-out time is preserved
   - ✅ Total hours worked is preserved

### Test 3: Admin Dashboard
1. **Login** as admin
2. **Navigate** to Attendance section
3. **Verify**:
   - ✅ Employee attendance records are visible
   - ✅ Check-in times are correct
   - ✅ Check-out times are correct
   - ✅ Hours worked are calculated correctly
   - ✅ IP addresses are displayed in location column

### Test 4: Multiple Employees
1. **Have 2-3 employees** check in at different times
2. **Check admin dashboard**
3. **Verify**:
   - ✅ All employees show in attendance list
   - ✅ Each has correct check-in/check-out times
   - ✅ Hours are calculated per employee

### Test 5: Re-entry (Check-in after Check-out)
1. **Check in** as employee
2. **Check out**
3. **Check in again** (same day)
4. **Verify**:
   - ✅ New attendance record created
   - ✅ Can check out again
   - ✅ Both records visible in history

### Test 6: Attendance History
1. **Navigate** to Attendance page
2. **Verify**:
   - ✅ Shows today's attendance
   - ✅ Shows check-in time
   - ✅ Shows check-out time (if checked out)
   - ✅ Shows hours worked
   - ✅ Shows status (present/absent)
   - ✅ No break/meeting columns visible

### Test 7: No Stuck States
1. **Check in** as employee
2. **Refresh** page multiple times
3. **Verify**:
   - ✅ "Check Out" button always shows (not stuck on "End Break")
   - ✅ Status always shows "Working" (not stuck on "Break" or "Meeting")
   - ✅ Can always check out

### Test 8: IP Address Capture
1. **Check in** as employee
2. **Go to admin dashboard**
3. **Look at attendance record**
4. **Verify**:
   - ✅ Location column shows IP address
   - ✅ IP address is valid format (e.g., 192.168.1.1)
5. **Check out**
6. **Verify**:
   - ✅ Check-out also has IP address recorded

## Expected Behavior

### Employee Dashboard
- ✅ Shows "Check In" button when not checked in
- ✅ Shows "Check Out" button when checked in
- ✅ Displays check-in time
- ✅ Displays hours worked (updates in real-time)
- ✅ Shows today's attendance card
- ✅ Shows performance metrics
- ✅ Shows calendar and holidays

### Attendance Page
- ✅ Shows today's attendance record
- ✅ Shows check-in time
- ✅ Shows check-out time (if applicable)
- ✅ Shows hours worked
- ✅ Shows status
- ✅ NO break/meeting buttons
- ✅ NO break/meeting columns
- ✅ Attendance history table shows records

### Admin Dashboard
- ✅ Shows all employee attendance records
- ✅ Shows check-in times
- ✅ Shows check-out times
- ✅ Shows hours worked
- ✅ Shows IP addresses in location column
- ✅ Can filter by date range
- ✅ Can filter by employee

## What Should NOT Appear

- ❌ Break button
- ❌ Meeting button
- ❌ "End Break" button
- ❌ "End Meeting" button
- ❌ Break/Meeting columns in tables
- ❌ Break/Meeting UI components
- ❌ Socket.IO errors in console
- ❌ Stuck states

## Console Checks

Open browser console (F12) and verify:
- ✅ No errors related to attendance
- ✅ No errors related to Socket.IO
- ✅ No undefined function errors
- ✅ API calls to `/api/attendance/check-in` succeed
- ✅ API calls to `/api/attendance/check-out` succeed
- ✅ API calls to `/api/attendance/today` succeed

## Database Verification

Check MongoDB to verify data is being saved:

```javascript
// Check attendance records
db.attendances.find({ date: { $gte: new Date("2026-05-06") } }).pretty()

// Should show:
// - userId
// - employeeId
// - checkIn (timestamp)
// - checkOut (timestamp)
// - hoursWorked (number)
// - checkInIP (IP address)
// - checkOutIP (IP address)
// - status (present/absent)
// - date
```

## Performance Checks

- ✅ Check-in completes in < 2 seconds
- ✅ Check-out completes in < 2 seconds
- ✅ Page refresh completes in < 3 seconds
- ✅ Admin dashboard loads in < 5 seconds
- ✅ No memory leaks (check DevTools Memory tab)

## Troubleshooting

### Issue: Check-in fails with "Already checked in"
- **Solution**: Employee needs to check out first before checking in again

### Issue: Data disappears after refresh
- **Solution**: Check browser console for errors, verify API is responding

### Issue: IP address not showing
- **Solution**: Verify `checkInIP` and `checkOutIP` fields are in database

### Issue: Hours not calculating correctly
- **Solution**: Verify check-in and check-out times are correct in database

### Issue: Admin dashboard not showing records
- **Solution**: Verify employee has correct orgId, check API response

## Sign-off Checklist

- [ ] Check-in works
- [ ] Check-out works
- [ ] Data persists after refresh
- [ ] Admin dashboard shows data
- [ ] IP addresses display correctly
- [ ] No stuck states
- [ ] No console errors
- [ ] Multiple employees work correctly
- [ ] Re-entry works
- [ ] Attendance history displays correctly
- [ ] No break/meeting UI visible
- [ ] Performance is acceptable

---
**Testing Date**: 2026-05-06
**Tester**: [Your Name]
**Status**: Ready for Testing
