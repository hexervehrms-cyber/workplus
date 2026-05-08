# Shift Timing and Late Tracking Implementation

## Overview
This implementation adds shift timing configuration to employees and automatically tracks late arrivals in the admin portal. When an employee checks in after their shift start time (plus grace period), they are marked as late and their working hours are calculated from the actual check-in time.

## Changes Made

### 1. Backend Models

#### Employee Model (`backend/models/Employee.js`)
Added new `shiftTiming` field to store employee shift configuration:
```javascript
shiftTiming: {
  startTime: String,        // Format: "HH:MM" (24-hour format), default: "09:00"
  endTime: String,          // Format: "HH:MM" (24-hour format), default: "18:00"
  lateThreshold: Number,    // Grace period in minutes, default: 0
  workingDays: [String]     // Array of working day names, default: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"]
}
```

#### Attendance Model (`backend/models/Attendance.js`)
Added new fields to track late arrivals:
- `isLate`: Boolean - Whether employee checked in after shift start time + grace period
- `lateMinutes`: Number - Number of minutes late (0 if on time)
- `actualWorkingHours`: Number - Working hours calculated from actual check-in time (excluding breaks)

### 2. Backend Utilities

#### Shift and Late Tracker (`backend/utils/shiftAndLateTracker.js`)
New utility module with functions for:
- `timeToMinutes()` - Convert HH:MM format to minutes since midnight
- `minutesToTime()` - Convert minutes to HH:MM format
- `getDayName()` - Get day name from date
- `isWorkingDay()` - Check if date is a working day
- `calculateLateArrival()` - Detect late arrivals and calculate late minutes
- `calculateActualWorkingHours()` - Calculate working hours from check-in/out excluding breaks
- `determineAttendanceStatus()` - Determine attendance status (present/late/absent)
- `processAttendanceWithShiftTiming()` - Process attendance record with shift timing
- `getLateEmployeesToday()` - Get all late employees for today
- `formatShiftTiming()` - Format shift timing for display

### 3. Backend API Endpoints

#### New Endpoint: GET `/api/attendance/late-today`
Returns employees who were late today with details:
```json
{
  "success": true,
  "data": [
    {
      "employeeId": "...",
      "employeeName": "John Doe",
      "checkInTime": "2026-05-07T09:15:00Z",
      "shiftStartTime": "09:00",
      "lateMinutes": 15,
      "status": "late"
    }
  ],
  "count": 1
}
```

### 4. Frontend Changes

#### Admin Employees Page (`frontend/src/app/pages/admin/Employees.tsx`)

**Added to formData state:**
- `shiftStartTime`: Shift start time (HH:MM format)
- `shiftEndTime`: Shift end time (HH:MM format)
- `lateThreshold`: Grace period in minutes
- `workingDays`: Array of working day names

**Updated Functions:**
- `openEditModal()` - Now loads shift timing from employee record
- `handleEditEmployee()` - Now sends shift timing to backend

**Added UI Section:**
New "Shift Timing Configuration" section in edit form with:
- Shift Start Time (time input)
- Shift End Time (time input)
- Late Threshold (number input with description)
- Working Days (checkboxes for each day of week)

#### Admin Attendance Dashboard (`frontend/src/app/pages/admin/Attendance.tsx`)

**Added State:**
- `lateEmployees`: Array of late employees
- `lateEmployeesLoading`: Loading state for late employees

**Added Functions:**
- `fetchLateEmployees()` - Fetches late employees from `/api/attendance/late-today`

**Added UI Section:**
New "Late Today" card that displays:
- Count of late employees
- List of late employees with:
  - Employee name
  - Check-in time
  - Minutes late
  - Shift start time
- Only shows if there are late employees

## How It Works

### Setting Shift Timing
1. Admin opens employee edit form
2. Scrolls to "Shift Timing Configuration" section
3. Sets:
   - Shift start time (e.g., 09:00)
   - Shift end time (e.g., 18:00)
   - Late threshold/grace period (e.g., 5 minutes)
   - Working days (select which days employee works)
4. Saves employee

### Detecting Late Arrivals
1. Employee checks in via mobile/web app
2. System compares check-in time with shift start time + grace period
3. If check-in time > (shift start time + grace period):
   - Mark as late
   - Calculate late minutes
   - Set `isLate = true`
   - Set `lateMinutes = actual_late_minutes`
4. Working hours calculated from actual check-in time (not shift start time)

### Admin Dashboard Display
1. Admin views Attendance Dashboard
2. "Late Today" section shows:
   - Total count of late employees
   - List of each late employee with details
   - Updates every minute
3. Can click on employee to view full attendance details

## Example Scenarios

### Scenario 1: On Time
- Shift starts: 09:00
- Grace period: 5 minutes
- Check-in time: 09:03
- Result: Present (within grace period)

### Scenario 2: Late
- Shift starts: 09:00
- Grace period: 5 minutes
- Check-in time: 09:10
- Result: Late (5 minutes late)
- Working hours calculated from 09:10 (not 09:00)

### Scenario 3: With Breaks
- Check-in: 09:00
- Break 1: 12:00-13:00 (60 minutes)
- Break 2: 15:00-15:15 (15 minutes)
- Check-out: 18:00
- Working hours: (18:00 - 09:00) - 60 - 15 = 8 hours 45 minutes

## API Integration

### Update Employee with Shift Timing
```bash
PUT /api/employees/:id
{
  "shiftTiming": {
    "startTime": "09:00",
    "endTime": "18:00",
    "lateThreshold": 5,
    "workingDays": ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"]
  }
}
```

### Get Late Employees Today
```bash
GET /api/attendance/late-today
```

## Future Enhancements

1. **Shift Templates**: Create predefined shift templates (e.g., "Standard 9-5", "Flexible Hours")
2. **Shift Rotation**: Support rotating shifts for employees
3. **Late Penalties**: Automatic deduction of pay for late arrivals
4. **Notifications**: Notify managers when employees are late
5. **Reports**: Generate late arrival reports by employee/department
6. **Geofencing**: Validate check-in location matches office location
7. **Flexible Shifts**: Support flexible start/end times per day

## Testing Checklist

- [ ] Admin can set shift timing for employee
- [ ] Shift timing persists after save
- [ ] Employee checking in on time shows as "present"
- [ ] Employee checking in after grace period shows as "late"
- [ ] Late minutes calculated correctly
- [ ] Working hours calculated from actual check-in time
- [ ] Breaks are excluded from working hours
- [ ] "Late Today" section appears in admin dashboard
- [ ] Late employees list updates in real-time
- [ ] Different working days configuration works correctly
- [ ] Grace period works as expected
