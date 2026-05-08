# Detailed Attendance Code Removal - Line-by-Line Reference

## 1. Frontend: Dashboard.tsx
**File:** `frontend/src/app/pages/employee/Dashboard.tsx`

### Imports to Remove
```typescript
// Remove these icons from the import statement:
Coffee,
Users,
LogOut,
LogIn,
Pause,
Play,
Activity
```

### Interfaces to Remove
```typescript
// Remove entire interface (around line 45-50):
interface TimeRecord {
  id: number;
  type: 'check-in' | 'check-out' | 'break' | 'meeting';
  timestamp: string;
  duration?: string;
  ipAddress?: string;
}
```

### State Variables to Remove
```typescript
// Remove all of these from the component:
const [isCheckedIn, setIsCheckedIn] = useState(false);  // REMOVE
const [currentBreak, setCurrentBreak] = useState<string | null>(null);  // REMOVE
const [currentMeeting, setCurrentMeeting] = useState<string | null>(null);  // REMOVE
const [timeRecords, setTimeRecords] = useState<TimeRecord[]>([]);  // REMOVE
const [showReCheckInDialog, setShowReCheckInDialog] = useState(false);  // REMOVE
const [wasOnBreakBeforeCheckout, setWasOnBreakBeforeCheckout] = useState(false);  // REMOVE
const [reCheckInTimer, setReCheckInTimer] = useState<NodeJS.Timeout | null>(null);  // REMOVE
const [timeTrackingTab, setTimeTrackingTab] = useState<'records' | 'activity'>('records');  // REMOVE
```

### Functions to Remove (Entire Functions)
1. `handleCheckIn()` - entire function
2. `handleCheckOut()` - entire function
3. `handleBreakStart()` - if exists
4. `handleBreakEnd()` - if exists
5. `handleMeetingToggle()` - if exists
6. `handleReCheckIn()` - if exists
7. `handleReCheckInCancel()` - if exists

### Code to Remove from fetchDashboardData()
Remove all code that processes breaks and meetings:
- Lines that set `setCurrentBreak()`
- Lines that set `setCurrentMeeting()`
- Lines that build `timeRecords` array
- Lines that process `attendance.breaks` array
- Lines that process `attendance.meetings` array
- Lines that process `attendance.meetingMode`
- All break/meeting duration calculations

Keep only:
- Check-in/check-out time extraction
- Hours worked calculation
- Basic attendance status

### Code to Remove from useEffect (Socket.IO listeners)
Remove attendance-specific socket listeners if any exist in the Socket.IO setup.

### UI Components to Remove
- Break/Meeting status display sections
- Time tracking tabs and records table
- Break start/end buttons
- Meeting mode toggle button
- Re-check-in dialog component
- Any UI that displays `currentBreak` or `currentMeeting`

---

## 2. Frontend: Attendance.tsx
**File:** `frontend/src/app/pages/employee/Attendance.tsx`

### Functions to Remove

#### handleBreakStart() - Lines ~325-364
```typescript
// REMOVE ENTIRE FUNCTION:
const handleBreakStart = async () => {
  if (!employeeId) {
    toast.error('Employee ID not found');
    return;
  }
  try {
    setActionLoading(true);
    const token = localStorage.getItem('authToken');
    const response = await fetch('/api/attendance/break-start', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        employeeId: employeeId,
        orgId: user?.orgId,
        breakType: 'regular',
        notes: 'Break started from dashboard'
      })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Break start failed');
    }

    toast.success('Break started');
    setStatus('break');
    await fetchTodayAttendance();
  } catch (error) {
    console.error('Break start error:', error);
    toast.error(error instanceof Error ? error.message : 'Break start failed');
  } finally {
    setActionLoading(false);
  }
};
```

#### handleBreakEnd() - Lines ~366-404
```typescript
// REMOVE ENTIRE FUNCTION:
const handleBreakEnd = async () => {
  if (!employeeId) {
    toast.error('Employee ID not found');
    return;
  }
  try {
    setActionLoading(true);
    const token = localStorage.getItem('authToken');
    const response = await fetch('/api/attendance/break-end', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        employeeId: employeeId,
        orgId: user?.orgId,
        notes: 'Break ended from dashboard'
      })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Break end failed');
    }

    toast.success('Break ended');
    setStatus('working');
    await fetchTodayAttendance();
  } catch (error) {
    console.error('Break end error:', error);
    toast.error(error instanceof Error ? error.message : 'Break end failed');
  } finally {
    setActionLoading(false);
  }
};
```

#### handleMeetingToggle() - Lines ~407-440
```typescript
// REMOVE ENTIRE FUNCTION:
const handleMeetingToggle = async (isActive: boolean) => {
  if (!employeeId) {
    toast.error('Employee ID not found');
    return;
  }
  try {
    setActionLoading(true);
    const token = localStorage.getItem('authToken');
    const response = await fetch('/api/attendance/meeting-mode', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        employeeId: employeeId,
        isActive: isActive,
        meetingTitle: 'Meeting',
        meetingType: 'internal',
        orgId: user?.orgId
      })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Meeting toggle failed');
    }

    toast.success(isActive ? 'Meeting mode activated' : 'Meeting mode deactivated');
    setStatus(isActive ? 'meeting' : 'working');
    await fetchTodayAttendance();
  } catch (error) {
    console.error('Meeting toggle error:', error);
    toast.error(error instanceof Error ? error.message : 'Meeting toggle failed');
  } finally {
    setActionLoading(false);
  }
};
```

### UI Components to Remove
- Break start/end button (around line 565)
- Meeting mode toggle button (around line 572)
- Status display for break/meeting states
- Any conditional rendering based on `status === 'break'` or `status === 'meeting'`

---

## 3. Backend: attendance.js
**File:** `backend/routes/attendance.js`

### Endpoints to Remove (Entire Endpoints)

#### 1. POST /api/attendance/break-start - Lines ~310-410
```javascript
// REMOVE ENTIRE ENDPOINT:
router.post('/break-start', authorize(...), idempotencyMiddleware, asyncHandler(async (req, res) => {
  // ... entire function body
}));
```

#### 2. POST /api/attendance/break-end - Lines ~412-580
```javascript
// REMOVE ENTIRE ENDPOINT:
router.post('/break-end', authorize(...), idempotencyMiddleware, asyncHandler(async (req, res) => {
  // ... entire function body
}));
```

#### 3. POST /api/attendance/meeting-mode - Lines ~582-730
```javascript
// REMOVE ENTIRE ENDPOINT:
router.post('/meeting-mode', authorize(...), asyncHandler(async (req, res) => {
  // ... entire function body
}));
```

#### 4. POST /api/attendance/break/start - Lines ~1250-1320
```javascript
// REMOVE ENTIRE ENDPOINT:
router.post('/break/start', asyncHandler(async (req, res) => {
  // ... entire function body
}));
```

#### 5. POST /api/attendance/break/end - Lines ~1322-1390
```javascript
// REMOVE ENTIRE ENDPOINT:
router.post('/break/end', asyncHandler(async (req, res) => {
  // ... entire function body
}));
```

### Code to Modify in GET /api/attendance/today

**Remove from the response building:**
```javascript
// REMOVE: All break processing
let allBreaks = [];
let allMeetings = [];

if (allAttendanceRecords.length > 0) {
  allAttendanceRecords.forEach(record => {
    if (record.breaks && Array.isArray(record.breaks)) {
      allBreaks = allBreaks.concat(record.breaks);
    }
    if (record.meetings && Array.isArray(record.meetings)) {
      allMeetings = allMeetings.concat(record.meetings);
    }
  });
}

// REMOVE: All break/meeting status calculations
let isOnBreak = false;
let breakDuration = 0;
let totalBreakTime = 0;

// ... all the break checking logic

// REMOVE: Meeting mode checks
if (attendance.meetingMode && attendance.meetingMode.isActive) {
  liveStatus = 'in_meeting';
} else if (isOnBreak) {
  liveStatus = 'on_break';
}

// REMOVE: From response
const responseAttendance = attendance ? {
  ...attendance,
  breaks: allBreaks,  // REMOVE THIS LINE
  meetings: allMeetings  // REMOVE THIS LINE
} : null;
```

**Keep in the response:**
```javascript
// KEEP: Basic status and hours
res.json({
  success: true,
  data: {
    attendance: responseAttendance,  // Without breaks/meetings
    liveStatus: {
      status: liveStatus,  // Just 'checked_in', 'checked_out', 'not_checked_in'
      currentHours: Math.round(currentHours * 100) / 100,
      lastUpdated: new Date()
    }
  }
});
```

---

## 4. Backend: server.js
**File:** `backend/server.js`

### Socket.IO Event Handlers to Remove - Lines ~746-769

```javascript
// REMOVE THESE SOCKET HANDLERS:

socket.on('attendance:create', (data) => {
  try {
    const tenantId = socket.tenantId || data?.tenantId;
    if (tenantId) {
      io.to(`tenant_${tenantId}`).emit('attendance:create', data);
      logger.info('Attendance created event broadcast', { tenantId });
    }
  } catch (error) {
    logger.error(`Socket attendance:create error: ${error.message}`);
  }
});

socket.on('attendance:update', (data) => {
  try {
    const tenantId = socket.tenantId || data?.tenantId;
    if (tenantId) {
      io.to(`tenant_${tenantId}`).emit('attendance:update', data);
      logger.info('Attendance updated event broadcast', { tenantId });
    }
  } catch (error) {
    logger.error(`Socket attendance:update error: ${error.message}`);
  }
});
```

### Request Middleware to Review - Lines ~193-200

Check if `req.emitAttendanceUpdate` is used only for break/meeting updates. If so, remove it. If it's used for basic check-in/check-out, keep it.

---

## 5. Backend: server-stable.js
**File:** `backend/server-stable.js`

### Socket.IO Event Handler to Remove - Lines ~402-412

```javascript
// REMOVE THIS SOCKET HANDLER:

socket.on('attendance:create', (data) => {
  try {
    const tenantId = socket.tenantId || data?.tenantId;
    if (tenantId) {
      io.to(`tenant_${tenantId}`).emit('attendance:create', data);
    }
  } catch (error) {
    logger.error(`Socket attendance:create error: ${error.message}`);
  }
});
```

---

## 6. Frontend: realTimeSocket.ts
**File:** `frontend/src/app/utils/realTimeSocket.ts`

### Socket.IO Listeners to Remove from setupDashboardListeners()

```typescript
// REMOVE THESE LISTENERS (Lines ~155-163):

// Attendance updates
this.socket.on('attendance:create', (attendance) => {
  console.log('⏰ Attendance recorded:', attendance);
  this.notifyAttendanceUpdate(attendance);
});

this.socket.on('attendance:update', (data) => {
  console.log('⏰ Attendance update:', data);
  this.notifyAttendanceUpdate(data.attendance);
});
```

### Callback Arrays to Remove

```typescript
// REMOVE IF ONLY USED FOR BREAK/MEETING UPDATES:
private attendanceUpdateCallbacks: ((attendance: any) => void)[] = [];
```

### Public Methods to Remove

```typescript
// REMOVE IF ONLY USED FOR BREAK/MEETING UPDATES:

onAttendanceUpdate(callback: (attendance: any) => void) {
  this.attendanceUpdateCallbacks.push(callback);
  return () => {
    const index = this.attendanceUpdateCallbacks.indexOf(callback);
    if (index > -1) {
      this.attendanceUpdateCallbacks.splice(index, 1);
    }
  };
}

private notifyAttendanceUpdate(attendance: any) {
  this.attendanceUpdateCallbacks.forEach(callback => callback(attendance));
}
```

---

## 7. Backend: employee-dashboard.js
**File:** `backend/routes/employee-dashboard.js`

### Socket.IO Emissions to Review - Lines ~643-756

Check if these emissions are only for break/meeting context. If so, remove them. If they're used for basic check-in/check-out, keep them.

```javascript
// REVIEW AND POTENTIALLY REMOVE:
global.socketManager.emitToOrg(orgId, 'attendance:checkin', {...});
global.socketManager.emitToOrg(orgId, 'attendance:checkout', {...});
```

---

## Summary of Exact Removals

| File | Type | Count | Details |
|------|------|-------|---------|
| Dashboard.tsx | Imports | 7 | Coffee, Users, LogOut, LogIn, Pause, Play, Activity |
| Dashboard.tsx | Interfaces | 1 | TimeRecord |
| Dashboard.tsx | State Variables | 8 | currentBreak, currentMeeting, timeRecords, etc. |
| Dashboard.tsx | Functions | 7+ | handleCheckIn, handleCheckOut, handleBreakStart, etc. |
| Attendance.tsx | Functions | 3 | handleBreakStart, handleBreakEnd, handleMeetingToggle |
| Attendance.tsx | UI Components | 2+ | Break button, Meeting button |
| attendance.js | Endpoints | 5 | break-start, break-end, meeting-mode, break/start, break/end |
| attendance.js | Code Sections | 1 | Break/meeting processing in /today endpoint |
| server.js | Socket Handlers | 2 | attendance:create, attendance:update |
| server-stable.js | Socket Handlers | 1 | attendance:create |
| realTimeSocket.ts | Listeners | 2 | attendance:create, attendance:update |
| realTimeSocket.ts | Methods | 3 | onAttendanceUpdate, notifyAttendanceUpdate, callback array |

