# Shift Timing Configuration - Quick Start Guide

## For Admins

### Setting Up Employee Shift Timing

1. **Navigate to Employees**
   - Go to Admin Portal → Employees
   - Find the employee you want to configure
   - Click the Edit button

2. **Configure Shift Timing**
   - Scroll down to "Shift Timing Configuration" section
   - Set the following:
     - **Shift Start Time**: When the employee's shift begins (e.g., 09:00)
     - **Shift End Time**: When the employee's shift ends (e.g., 18:00)
     - **Late Threshold**: Grace period in minutes (e.g., 5 means employee can be up to 5 minutes late without being marked late)
     - **Working Days**: Select which days the employee works (Mon-Fri for standard, or custom)

3. **Save**
   - Click "Update Employee" button
   - Shift timing is now active for this employee

### Viewing Late Employees

1. **Go to Attendance Dashboard**
   - Admin Portal → Attendance Dashboard

2. **View "Late Today" Section**
   - At the top of the dashboard, you'll see a "Late Today" card
   - Shows count of late employees
   - Lists each late employee with:
     - Employee name
     - Check-in time
     - Minutes late
     - Shift start time

3. **Real-time Updates**
   - The list updates automatically every minute
   - No need to refresh the page

## How Late Detection Works

### Example 1: Standard 9-5 with 5-minute grace period
```
Shift Start Time: 09:00
Late Threshold: 5 minutes
Allowed Check-in: Up to 09:05

Employee A checks in at 09:03 → Present ✓
Employee B checks in at 09:07 → Late (2 minutes) ✗
Employee C checks in at 09:15 → Late (10 minutes) ✗
```

### Example 2: Flexible shift with no grace period
```
Shift Start Time: 10:00
Late Threshold: 0 minutes
Allowed Check-in: Exactly 10:00

Employee A checks in at 10:00 → Present ✓
Employee B checks in at 10:01 → Late (1 minute) ✗
```

## Working Hours Calculation

When an employee is late, their working hours are calculated from their actual check-in time, not the shift start time.

### Example:
```
Shift: 09:00 - 18:00
Employee checks in: 09:15 (15 minutes late)
Employee takes break: 12:00-13:00 (60 minutes)
Employee checks out: 18:00

Working hours = (18:00 - 09:15) - 60 minutes break
              = 8 hours 45 minutes - 1 hour
              = 7 hours 45 minutes
```

## Common Configurations

### Standard Office Hours
- Start Time: 09:00
- End Time: 18:00
- Late Threshold: 5 minutes
- Working Days: Monday-Friday

### Flexible Hours
- Start Time: 10:00
- End Time: 19:00
- Late Threshold: 15 minutes
- Working Days: Monday-Friday

### Shift Work (Morning)
- Start Time: 06:00
- End Time: 14:00
- Late Threshold: 0 minutes
- Working Days: Monday-Friday

### Shift Work (Evening)
- Start Time: 14:00
- End Time: 22:00
- Late Threshold: 0 minutes
- Working Days: Monday-Friday

### 6-Day Work Week
- Start Time: 09:00
- End Time: 18:00
- Late Threshold: 5 minutes
- Working Days: Monday-Saturday

## Troubleshooting

### "Late Today" section not showing
- Check if any employees were actually late today
- Verify shift timing is configured for employees
- Refresh the page

### Employee marked as late but shouldn't be
- Check the shift start time and late threshold
- Verify the employee's check-in time
- Confirm working days include today

### Working hours seem incorrect
- Check if breaks were recorded
- Verify check-out time is recorded
- Ensure shift timing is configured correctly

## API Reference

### Get Late Employees Today
```bash
GET /api/attendance/late-today

Response:
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

### Update Employee Shift Timing
```bash
PUT /api/employees/:employeeId

Body:
{
  "shiftTiming": {
    "startTime": "09:00",
    "endTime": "18:00",
    "lateThreshold": 5,
    "workingDays": ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"]
  }
}
```

## Tips & Best Practices

1. **Set Realistic Grace Periods**
   - 0 minutes: Strict punctuality required
   - 5 minutes: Standard office environment
   - 15 minutes: Flexible work environment

2. **Configure Working Days Accurately**
   - Ensure working days match your organization's schedule
   - Update for employees with different schedules

3. **Monitor Late Trends**
   - Check the "Late Today" section regularly
   - Identify patterns of late arrivals
   - Take corrective action if needed

4. **Communicate with Employees**
   - Inform employees of their shift timing
   - Explain the grace period policy
   - Set clear expectations

5. **Regular Reviews**
   - Review shift configurations quarterly
   - Update for seasonal changes
   - Adjust grace periods based on feedback
