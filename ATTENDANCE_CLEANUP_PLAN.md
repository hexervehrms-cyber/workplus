# Attendance Tracking Code Removal Plan

## Overview
This document lists all files that need to be modified to remove attendance tracking related code (check-in, check-out, break, and meeting functionality) while keeping the basic attendance model and `/today` endpoint.

---

## Files to Modify

### 1. **Frontend: Employee Dashboard**
**File:** `frontend/src/app/pages/employee/Dashboard.tsx`

**Code to Remove:**
- **Imports:** Remove attendance-related icons: `Coffee`, `LogOut`, `LogIn`, `Pause`, `Play`, `Activity`
- **Interface:** Remove `TimeRecord` interface (lines ~45-50)
- **State Variables:** Remove all of these:
  - `currentBreak` state
  - `currentMeeting` state
  - `timeRecords` state
  - `timeTrackingTab` state
  - `wasOnBreakBeforeCheckout` state
  - `reCheckInTimer` state
  - `showReCheckInDialog` state

- **Functions to Remove:**
  - `handleCheckIn()` - entire function
  - `handleCheckOut()` - entire function
  - `handleBreakStart()` - entire function
  - `handleBreakEnd()` - entire function
  - `handleMeetingToggle()` - entire function
  - `handleReCheckIn()` - entire function
  - `handleReCheckInCancel()` - entire function

- **Data Processing:** Remove all code that processes breaks and meetings from attendance data:
  - Break duration calculations
  - Meeting mode state setting
  - Time records building from breaks/meetings arrays
  - Local break/meeting record merging logic

- **UI Components to Remove:**
  - Break/Meeting status display sections
  - Time tracking tabs and records table
  - Break start/end buttons
  - Meeting mode toggle button
  - Re-check-in dialog

- **Socket.IO Listeners:** Keep only the basic listeners, remove attendance-specific ones if any

**Keep:**
- Basic check-in/check-out buttons
- Today's attendance display (checkInTime, checkOutTime, hoursWorked, status)
- `/api/attendance/today` API call
- Basic attendance state (`isCheckedIn`, `todayAttendance`)

---

### 2. **Frontend: Employee Attendance Page**
**File:** `frontend/src/app/pages/employee/Attendance.tsx`

**Code to Remove:**
- **Functions:**
  - `handleBreakStart()` - entire function (lines ~325-364)
  - `handleBreakEnd()` - entire function (lines ~366-404)
  - `handleMeetingToggle()` - entire function (lines ~407-440)

- **API Calls:**
  - POST `/api/attendance/break-start`
  - POST `/api/attendance/break-end`
  - POST `/api/attendance/meeting-mode`

- **UI Components:**
  - Break start/end button
  - Meeting mode toggle button
  - Status display for break/meeting states
  - Any UI that shows break duration or meeting status

- **State Variables:**
  - `status` state (if only used for break/meeting tracking)
  - `actionLoading` state (if only used for break/meeting actions)

**Keep:**
- Basic check-in/check-out functionality
- Today's attendance display
- Attendance history/records view

---

### 3. **Backend: Attendance Routes**
**File:** `backend/routes/attendance.js`

**Endpoints to Remove:**
1. **POST `/api/attendance/break-start`** (lines ~310-410)
   - Entire endpoint including:
   - Break validation logic
   - Socket.IO emissions
   - Activity logging
   - Real-time update emissions

2. **POST `/api/attendance/break-end`** (lines ~412-580)
   - Entire endpoint including:
   - Break end logic
   - Duration calculations
   - Socket.IO emissions
   - Activity logging

3. **POST `/api/attendance/meeting-mode`** (lines ~582-730)
   - Entire endpoint including:
   - Meeting mode toggle logic
   - Socket.IO emissions
   - Activity logging

4. **POST `/api/attendance/break/start`** (lines ~1250-1320)
   - Fallback break start endpoint

5. **POST `/api/attendance/break/end`** (lines ~1322-1390)
   - Fallback break end endpoint

**Code to Remove from Existing Endpoints:**
- In **GET `/api/attendance/today`** (lines ~100-250):
  - Remove all break processing logic
  - Remove all meeting processing logic
  - Remove `allBreaks` and `allMeetings` array building
  - Remove `isOnBreak`, `breakDuration`, `totalBreakTime` calculations
  - Remove meeting mode status checks
  - Keep only: basic check-in/check-out status, hours worked, live status

- In **POST `/api/attendance/check-in`** (lines ~750-950):
  - Remove break/meeting related comments
  - Keep core check-in logic

- In **POST `/api/attendance/check-out`** (lines ~952-1200):
  - Remove break/meeting related comments
  - Keep core check-out logic

**Keep:**
- GET `/api/attendance` - list endpoint
- GET `/api/attendance/today` - (simplified, without break/meeting data)
- POST `/api/attendance/check-in`
- POST `/api/attendance/check-out`
- GET `/api/attendance/stats/summary`
- GET `/api/attendance/analytics`
- GET `/api/attendance/report`
- GET `/api/attendance/export`
- POST `/api/attendance/import`
- GET `/api/attendance/activity-logs/today`
- All policy and system endpoints

---

### 4. **Backend: Server Socket.IO Handlers**
**File:** `backend/server.js`

**Code to Remove:**
- Socket.IO event handlers for attendance (lines ~746-769):
  - `socket.on('attendance:create', ...)`
  - `socket.on('attendance:update', ...)`

- In the request middleware (lines ~193-200):
  - `req.emitAttendanceUpdate` function (if only used for break/meeting updates)
  - Keep if used for basic check-in/check-out updates

**Keep:**
- Basic attendance socket events if they're used for check-in/check-out
- Dashboard update emissions

---

### 5. **Backend: Server Stable Socket.IO Handlers**
**File:** `backend/server-stable.js`

**Code to Remove:**
- Socket.IO event handlers for attendance (lines ~402-412):
  - `socket.on('attendance:create', ...)`

---

### 6. **Frontend: Real-Time Socket Utility**
**File:** `frontend/src/app/utils/realTimeSocket.ts`

**Code to Remove:**
- Socket.IO listeners in `setupDashboardListeners()`:
  - `socket.on('attendance:create', ...)` (lines ~155-158)
  - `socket.on('attendance:update', ...)` (lines ~160-163)

- Callback arrays:
  - `attendanceUpdateCallbacks` array (if only used for break/meeting updates)

- Public methods:
  - `onAttendanceUpdate()` method (if only used for break/meeting updates)
  - `notifyAttendanceUpdate()` method (if only used for break/meeting updates)

**Keep:**
- Basic attendance update listeners if used for check-in/check-out
- Other socket listeners (leave, expense, employee, etc.)

---

### 7. **Backend: Employee Dashboard Routes**
**File:** `backend/routes/employee-dashboard.js`

**Code to Remove:**
- Socket.IO emissions related to breaks and meetings:
  - `global.socketManager.emitToOrg(orgId, 'attendance:checkin', ...)` (if only for break/meeting context)
  - `global.socketManager.emitToOrg(orgId, 'attendance:checkout', ...)` (if only for break/meeting context)

**Keep:**
- Basic check-in/check-out socket emissions

---

## Attendance Model Changes

**File:** `backend/models/Attendance.js`

**Keep the following fields:**
- `userId`
- `employeeId`
- `employeeName`
- `date`
- `checkIn`
- `checkOut`
- `hoursWorked`
- `status`
- `orgId`
- `checkInLocation`
- `checkOutLocation`
- `checkInDevice`
- `checkOutDevice`
- `checkInIP`
- `checkOutIP`
- `checkInNotes`
- `checkOutNotes`

**Can Remove (Optional - depends on data migration needs):**
- `breaks` array
- `meetings` array
- `meetingMode` object
- `lastBreakStart`
- `lastBreakEnd`
- `isReEntry`
- `previousAttendanceId`
- Any break/meeting related fields

---

## Summary of Changes

| Category | Count | Details |
|----------|-------|---------|
| **Frontend Files** | 2 | Dashboard.tsx, Attendance.tsx |
| **Backend Route Files** | 1 | attendance.js |
| **Backend Server Files** | 2 | server.js, server-stable.js |
| **Frontend Utility Files** | 1 | realTimeSocket.ts |
| **Endpoints to Remove** | 5 | break-start, break-end, meeting-mode, break/start, break/end |
| **State Variables to Remove** | 6+ | currentBreak, currentMeeting, timeRecords, etc. |
| **Functions to Remove** | 6+ | handleBreakStart, handleBreakEnd, handleMeetingToggle, etc. |
| **Socket Listeners to Remove** | 4+ | attendance:create, attendance:update, break events |

---

## Implementation Order

1. **Remove backend endpoints first** (attendance.js)
2. **Remove Socket.IO handlers** (server.js, server-stable.js)
3. **Remove Socket.IO listeners** (realTimeSocket.ts)
4. **Remove frontend functions** (Attendance.tsx, Dashboard.tsx)
5. **Remove frontend UI components** (Attendance.tsx, Dashboard.tsx)
6. **Test basic check-in/check-out** to ensure it still works
7. **Verify no broken imports or references**

---

## Testing Checklist

- [ ] Basic check-in still works
- [ ] Basic check-out still works
- [ ] `/api/attendance/today` endpoint returns data without breaks/meetings
- [ ] No console errors related to missing functions
- [ ] No broken imports
- [ ] Socket.IO connections still work for other features
- [ ] Dashboard loads without errors
- [ ] Employee attendance page loads without errors
