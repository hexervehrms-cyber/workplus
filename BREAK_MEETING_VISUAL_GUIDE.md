# Break and Meeting Feature - Visual Guide

## Dashboard UI States

### State 1: Not Checked In
```
┌─────────────────────────────────────┐
│     Today's Attendance              │
├─────────────────────────────────────┤
│ Check-in Time: Not checked in       │
│ Hours Today: 0h                     │
│                                     │
│ Status: Not checked in              │
│ ┌─────────────────────────────────┐ │
│ │      [Check In Button]          │ │
│ └─────────────────────────────────┘ │
│                                     │
│ (Break and Meeting buttons hidden)  │
└─────────────────────────────────────┘
```

### State 2: Checked In (Working)
```
┌─────────────────────────────────────┐
│     Today's Attendance              │
├─────────────────────────────────────┤
│ Check-in Time: 09:00 AM             │
│ Hours Today: 2.5h                   │
│                                     │
│ Status: Working                     │
│ ┌─────────────────────────────────┐ │
│ │      [Check Out Button]         │ │
│ └─────────────────────────────────┘ │
│                                     │
│ ┌──────────────┬──────────────────┐ │
│ │ Start Break  │ Start Meeting    │ │
│ └──────────────┴──────────────────┘ │
└─────────────────────────────────────┘
```

### State 3: On Break
```
┌─────────────────────────────────────┐
│     Today's Attendance              │
├─────────────────────────────────────┤
│ Check-in Time: 09:00 AM             │
│ Hours Today: 2.5h                   │
│                                     │
│ Status: On Break                    │
│ ┌─────────────────────────────────┐ │
│ │      [Check Out Button]         │ │
│ └─────────────────────────────────┘ │
│                                     │
│ ┌──────────────┬──────────────────┐ │
│ │  End Break   │ Start Meeting ✗  │ │
│ │              │ (disabled)       │ │
│ └──────────────┴──────────────────┘ │
│                                     │
│ Break duration: 5 min               │
└─────────────────────────────────────┘
```

### State 4: In Meeting
```
┌─────────────────────────────────────┐
│     Today's Attendance              │
├─────────────────────────────────────┤
│ Check-in Time: 09:00 AM             │
│ Hours Today: 2.5h                   │
│                                     │
│ Status: In Meeting                  │
│ ┌─────────────────────────────────┐ │
│ │      [Check Out Button]         │ │
│ └─────────────────────────────────┘ │
│                                     │
│ ┌──────────────┬──────────────────┐ │
│ │ Start Break ✗│  End Meeting     │ │
│ │ (disabled)   │                  │ │
│ └──────────────┴──────────────────┘ │
└─────────────────────────────────────┘
```

## User Flow Diagram

```
                    ┌─────────────────┐
                    │   Employee      │
                    │   Logs In       │
                    └────────┬────────┘
                             │
                             ▼
                    ┌─────────────────┐
                    │  Dashboard      │
                    │  Loaded         │
                    └────────┬────────┘
                             │
                             ▼
                    ┌─────────────────┐
                    │  Check In       │
                    │  Button Visible │
                    └────────┬────────┘
                             │
                    ┌────────▼────────┐
                    │  Click Check In │
                    └────────┬────────┘
                             │
                    ┌────────▼────────────────────┐
                    │  Break & Meeting Buttons    │
                    │  Now Visible                │
                    └────────┬────────────────────┘
                             │
                ┌────────────┼────────────┐
                │            │            │
                ▼            ▼            ▼
        ┌──────────────┐ ┌──────────────┐ ┌──────────────┐
        │ Start Break  │ │ Start Meeting│ │ Check Out    │
        └──────┬───────┘ └──────┬───────┘ └──────┬───────┘
               │                │                │
        ┌──────▼───────┐ ┌──────▼───────┐       │
        │ On Break     │ │ In Meeting   │       │
        │ (Meeting ✗)  │ │ (Break ✗)    │       │
        └──────┬───────┘ └──────┬───────┘       │
               │                │                │
        ┌──────▼───────┐ ┌──────▼───────┐       │
        │ End Break    │ │ End Meeting  │       │
        └──────┬───────┘ └──────┬───────┘       │
               │                │                │
               └────────┬───────┘                │
                        │                        │
                ┌───────▼────────┐               │
                │ Back to Working│               │
                │ (Both enabled) │               │
                └───────┬────────┘               │
                        │                        │
                        └────────┬───────────────┘
                                 │
                        ┌────────▼────────┐
                        │ Checked Out     │
                        │ (Buttons hidden)│
                        └─────────────────┘
```

## Button State Matrix

| State | Check In | Check Out | Start Break | End Break | Start Meeting | End Meeting |
|-------|----------|-----------|-------------|-----------|---------------|------------|
| Not Checked In | ✅ Enabled | ❌ Hidden | ❌ Hidden | ❌ Hidden | ❌ Hidden | ❌ Hidden |
| Working | ❌ Hidden | ✅ Enabled | ✅ Enabled | ❌ Hidden | ✅ Enabled | ❌ Hidden |
| On Break | ❌ Hidden | ✅ Enabled | ❌ Hidden | ✅ Enabled | ❌ Disabled | ❌ Hidden |
| In Meeting | ❌ Hidden | ✅ Enabled | ❌ Disabled | ❌ Hidden | ❌ Hidden | ✅ Enabled |
| Checked Out | ✅ Enabled | ❌ Hidden | ❌ Hidden | ❌ Hidden | ❌ Hidden | ❌ Hidden |

## Status Badge Colors

```
┌──────────────────────────────────────┐
│ Status Badge                         │
├──────────────────────────────────────┤
│ Not checked in  → Gray               │
│ Working         → Green              │
│ On Break        → Orange/Yellow      │
│ In Meeting      → Blue               │
│ Checked Out     → Gray               │
└──────────────────────────────────────┘
```

## API Call Sequence

### Start Break Flow
```
User clicks "Start Break"
        │
        ▼
POST /api/attendance/break-start
        │
        ├─ Validate: Employee checked in ✓
        ├─ Validate: Not already on break ✓
        ├─ Validate: Not in meeting ✓
        │
        ▼
Create break record in database
        │
        ▼
Return updated attendance
        │
        ▼
Update UI:
  - Button changes to "End Break"
  - Status shows "On Break"
  - Meeting button disabled
  - Break duration displays
```

### Start Meeting Flow
```
User clicks "Start Meeting"
        │
        ▼
POST /api/attendance/meeting-start
        │
        ├─ Validate: Employee checked in ✓
        ├─ Validate: Not already in meeting ✓
        ├─ Validate: Not on break ✓ ⭐ KEY
        │
        ▼
Create meeting record in database
        │
        ▼
Return updated attendance
        │
        ▼
Update UI:
  - Button changes to "End Meeting"
  - Status shows "In Meeting"
  - Break button disabled
```

## Data Flow Diagram

```
┌─────────────────────────────────────────────────────────┐
│                   Frontend (React)                      │
│                                                         │
│  ┌──────────────────────────────────────────────────┐  │
│  │  Dashboard Component                             │  │
│  │  - State: isOnBreak, isInMeeting                 │  │
│  │  - Handlers: handleBreakStart, etc.             │  │
│  │  - UI: Break/Meeting buttons                    │  │
│  └──────────────────────────────────────────────────┘  │
│                        │                                │
│                        │ API Calls                      │
│                        ▼                                │
└─────────────────────────────────────────────────────────┘
                        │
                        │ HTTP
                        │
┌─────────────────────────────────────────────────────────┐
│                   Backend (Node.js)                     │
│                                                         │
│  ┌──────────────────────────────────────────────────┐  │
│  │  Attendance Routes                               │  │
│  │  - POST /break-start                             │  │
│  │  - POST /break-end                               │  │
│  │  - POST /meeting-start                           │  │
│  │  - POST /meeting-end                             │  │
│  │  - GET /today                                    │  │
│  └──────────────────────────────────────────────────┘  │
│                        │                                │
│                        │ Database Queries               │
│                        ▼                                │
│  ┌──────────────────────────────────────────────────┐  │
│  │  MongoDB                                         │  │
│  │  - Attendance Collection                         │  │
│  │  - breaks array                                  │  │
│  │  - meetingMode object                            │  │
│  └──────────────────────────────────────────────────┘  │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

## Constraint Visualization

### Break/Meeting Mutual Exclusivity

```
┌─────────────────────────────────────┐
│         Employee State              │
├─────────────────────────────────────┤
│                                     │
│  ┌─────────────────────────────┐   │
│  │     Working                 │   │
│  │ (Both Break & Meeting OK)   │   │
│  └──────┬──────────────┬────────┘   │
│         │              │             │
│    Start Break    Start Meeting      │
│         │              │             │
│  ┌──────▼──────┐  ┌────▼──────────┐ │
│  │  On Break   │  │  In Meeting   │ │
│  │ Meeting ✗   │  │  Break ✗      │ │
│  └─────────────┘  └───────────────┘ │
│         │              │             │
│    End Break      End Meeting        │
│         │              │             │
│         └──────┬───────┘             │
│                │                     │
│         ┌──────▼──────┐              │
│         │   Working   │              │
│         │ (Both OK)   │              │
│         └─────────────┘              │
│                                     │
└─────────────────────────────────────┘
```

## Real-time Updates

```
Timeline:
09:00 - Check In
        └─ Status: Working
           Break: Available
           Meeting: Available

09:15 - Start Break
        └─ Status: On Break
           Break: Active (5 min)
           Meeting: Disabled ✗

09:20 - End Break
        └─ Status: Working
           Break: Available
           Meeting: Available

09:25 - Start Meeting
        └─ Status: In Meeting
           Break: Disabled ✗
           Meeting: Active

09:35 - End Meeting
        └─ Status: Working
           Break: Available
           Meeting: Available

17:00 - Check Out
        └─ Status: Checked Out
           Break: Hidden
           Meeting: Hidden
```

---
**Visual Guide Date**: 2026-05-06
**Status**: ✅ Complete
