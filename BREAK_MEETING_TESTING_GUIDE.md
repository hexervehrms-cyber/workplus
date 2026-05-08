# Break and Meeting Feature - Testing Guide

## Quick Test Scenarios

### Test 1: Basic Break Functionality
1. **Login** as employee
2. **Navigate** to Employee Dashboard
3. **Click** "Check In"
   - ✅ Break and Meeting buttons should appear
4. **Click** "Start Break"
   - ✅ Button should change to "End Break"
   - ✅ Status should show "On Break"
   - ✅ Break duration should display
5. **Wait** 30 seconds
6. **Click** "End Break"
   - ✅ Button should change back to "Start Break"
   - ✅ Status should show "Working"
7. **Refresh** page
   - ✅ Break should be ended (not stuck on break)
   - ✅ Status should show "Working"

### Test 2: Basic Meeting Functionality
1. **Login** as employee
2. **Navigate** to Employee Dashboard
3. **Click** "Check In"
   - ✅ Break and Meeting buttons should appear
4. **Click** "Start Meeting"
   - ✅ Button should change to "End Meeting"
   - ✅ Status should show "In Meeting"
5. **Wait** 30 seconds
6. **Click** "End Meeting"
   - ✅ Button should change back to "Start Meeting"
   - ✅ Status should show "Working"
7. **Refresh** page
   - ✅ Meeting should be ended
   - ✅ Status should show "Working"

### Test 3: Break/Meeting Mutual Exclusivity
1. **Login** as employee
2. **Check In**
3. **Click** "Start Break"
   - ✅ Status shows "On Break"
4. **Verify** Meeting button is disabled (grayed out)
   - ✅ Cannot click "Start Meeting" button
5. **Click** "End Break"
   - ✅ Status shows "Working"
6. **Verify** Meeting button is enabled
   - ✅ Can click "Start Meeting" button
7. **Click** "Start Meeting"
   - ✅ Status shows "In Meeting"
8. **Verify** Break button is disabled (grayed out)
   - ✅ Cannot click "Start Break" button
9. **Click** "End Meeting"
   - ✅ Status shows "Working"
10. **Verify** Break button is enabled
    - ✅ Can click "Start Break" button

### Test 4: Break/Meeting Buttons Hidden When Not Checked In
1. **Login** as employee
2. **Navigate** to Employee Dashboard
3. **Verify** Break and Meeting buttons are NOT visible
   - ✅ Only "Check In" button visible
4. **Click** "Check In"
   - ✅ Break and Meeting buttons appear
5. **Click** "Check Out"
   - ✅ Break and Meeting buttons disappear
   - ✅ Only "Check In" button visible

### Test 5: Data Persistence
1. **Login** as employee
2. **Check In**
3. **Start Break**
   - ✅ Status shows "On Break"
4. **Refresh** page (F5)
   - ✅ Still shows "On Break"
   - ✅ Break duration continues
5. **End Break**
6. **Start Meeting**
   - ✅ Status shows "In Meeting"
7. **Refresh** page
   - ✅ Still shows "In Meeting"
8. **End Meeting**
9. **Refresh** page
   - ✅ Status shows "Working"

### Test 6: Multiple Breaks in One Day
1. **Login** as employee
2. **Check In**
3. **Start Break** (Break 1)
4. **Wait** 1 minute
5. **End Break**
6. **Start Break** (Break 2)
7. **Wait** 1 minute
8. **End Break**
9. **Check Out**
10. **Go to Attendance page**
    - ✅ Should show 2 breaks recorded
    - ✅ Each break should have duration

### Test 7: Admin Dashboard Visibility
1. **Login** as admin
2. **Navigate** to Attendance section
3. **Have employee check in, start break, end break**
4. **Verify** admin dashboard shows:
    - ✅ Employee is checked in
    - ✅ Break information is visible
    - ✅ Break duration is recorded

### Test 8: Status Badge Updates
1. **Login** as employee
2. **Check In**
   - ✅ Badge shows "Working"
3. **Start Break**
   - ✅ Badge shows "On Break"
4. **End Break**
   - ✅ Badge shows "Working"
5. **Start Meeting**
   - ✅ Badge shows "In Meeting"
6. **End Meeting**
   - ✅ Badge shows "Working"
7. **Check Out**
   - ✅ Badge shows "Not checked in"

### Test 9: Error Handling
1. **Try to start break without checking in**
   - ✅ Should show error message
2. **Check in, start break, try to start another break**
   - ✅ Should show error: "Already on break"
3. **End break, start meeting, try to start break**
   - ✅ Should show error: "Cannot start break while in meeting"
4. **End meeting, start break, try to start meeting**
   - ✅ Should show error: "Cannot start meeting while on break"

### Test 10: Break Duration Display
1. **Login** as employee
2. **Check In**
3. **Start Break**
4. **Wait** 2 minutes
5. **Verify** break duration shows approximately 2 minutes
   - ✅ Should display "Break duration: 2 min"
6. **Wait** another minute
7. **Verify** duration updates to 3 minutes
   - ✅ Should display "Break duration: 3 min"
8. **End Break**
   - ✅ Duration should be recorded in database

## Expected UI Behavior

### When Not Checked In
```
[Check In Button]
(Break and Meeting buttons hidden)
```

### When Checked In (Working)
```
[Check Out Button]
[Start Break] [Start Meeting]
Status: Working
```

### When On Break
```
[Check Out Button]
[End Break] [Start Meeting] (disabled/grayed out)
Status: On Break
Break duration: X min
```

### When In Meeting
```
[Check Out Button]
[Start Break] (disabled/grayed out) [End Meeting]
Status: In Meeting
```

## Console Checks

Open browser console (F12) and verify:
- ✅ No errors when starting break
- ✅ No errors when ending break
- ✅ No errors when starting meeting
- ✅ No errors when ending meeting
- ✅ API calls succeed (200/201 status)
- ✅ No undefined function errors

## Database Verification

Check MongoDB to verify data:

```javascript
// Check attendance with breaks and meetings
db.attendances.findOne({ 
  date: { $gte: new Date("2026-05-06") },
  "breaks.0": { $exists: true }
}).pretty()

// Should show:
// - breaks array with startTime, endTime, duration
// - meetingMode with isActive, startTime, endTime, duration
```

## Performance Checks

- ✅ Start break completes in < 1 second
- ✅ End break completes in < 1 second
- ✅ Start meeting completes in < 1 second
- ✅ End meeting completes in < 1 second
- ✅ Page refresh completes in < 3 seconds
- ✅ No memory leaks

## Sign-off Checklist

- [ ] Break start works
- [ ] Break end works
- [ ] Meeting start works
- [ ] Meeting end works
- [ ] Meeting button disabled when on break
- [ ] Break button disabled when in meeting
- [ ] Buttons hidden when not checked in
- [ ] Status badge updates correctly
- [ ] Break duration displays
- [ ] Data persists after refresh
- [ ] Multiple breaks work
- [ ] Admin dashboard shows data
- [ ] No console errors
- [ ] No stuck states
- [ ] Error messages display correctly

---
**Testing Date**: 2026-05-06
**Status**: Ready for Testing
