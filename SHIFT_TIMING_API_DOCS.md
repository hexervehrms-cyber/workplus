# Shift Timing API Documentation

## Overview
This document describes the API endpoints and data structures for shift timing and late tracking functionality.

## Base URL
```
http://localhost:5000/api
```

## Authentication
All endpoints require Bearer token authentication:
```
Authorization: Bearer <token>
```

---

## Endpoints

### 1. Get Late Employees Today

**Endpoint**: `GET /attendance/late-today`

**Authorization**: Admin, HR, Manager

**Description**: Returns all employees who were late today based on their shift timing configuration.

**Request**:
```bash
curl -X GET http://localhost:5000/api/attendance/late-today \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json"
```

**Response** (200 OK):
```json
{
  "success": true,
  "data": [
    {
      "employeeId": "507f1f77bcf86cd799439011",
      "employeeName": "John Doe",
      "checkInTime": "2026-05-07T09:15:00.000Z",
      "shiftStartTime": "09:00",
      "lateMinutes": 15,
      "status": "late"
    },
    {
      "employeeId": "507f1f77bcf86cd799439012",
      "employeeName": "Jane Smith",
      "checkInTime": "2026-05-07T09:08:00.000Z",
      "shiftStartTime": "09:00",
      "lateMinutes": 8,
      "status": "late"
    }
  ],
  "count": 2
}
```

**Error Response** (401 Unauthorized):
```json
{
  "success": false,
  "message": "Unauthorized access"
}
```

---

### 2. Update Employee with Shift Timing

**Endpoint**: `PUT /employees/:id`

**Authorization**: Admin, HR

**Description**: Updates employee information including shift timing configuration.

**Request**:
```bash
curl -X PUT http://localhost:5000/api/employees/507f1f77bcf86cd799439011 \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "John Doe",
    "email": "john@company.com",
    "designation": "Software Engineer",
    "department": "IT",
    "baseSalary": 50000,
    "phone": "+1234567890",
    "shiftTiming": {
      "startTime": "09:00",
      "endTime": "18:00",
      "lateThreshold": 5,
      "workingDays": ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"]
    }
  }'
```

**Request Body**:
```json
{
  "name": "John Doe",
  "email": "john@company.com",
  "designation": "Software Engineer",
  "department": "IT",
  "baseSalary": 50000,
  "phone": "+1234567890",
  "shiftTiming": {
    "startTime": "09:00",
    "endTime": "18:00",
    "lateThreshold": 5,
    "workingDays": ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"]
  }
}
```

**Response** (200 OK):
```json
{
  "success": true,
  "data": {
    "_id": "507f1f77bcf86cd799439011",
    "userId": {
      "_id": "507f1f77bcf86cd799439010",
      "name": "John Doe",
      "email": "john@company.com"
    },
    "designation": "Software Engineer",
    "department": "IT",
    "baseSalary": 50000,
    "phone": "+1234567890",
    "shiftTiming": {
      "startTime": "09:00",
      "endTime": "18:00",
      "lateThreshold": 5,
      "workingDays": ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"]
    },
    "createdAt": "2026-05-01T10:00:00.000Z",
    "updatedAt": "2026-05-07T14:30:00.000Z"
  }
}
```

**Error Response** (400 Bad Request):
```json
{
  "success": false,
  "message": "Invalid shift timing configuration"
}
```

---

## Data Structures

### Shift Timing Object
```json
{
  "startTime": "09:00",
  "endTime": "18:00",
  "lateThreshold": 5,
  "workingDays": ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"]
}
```

**Fields**:
- `startTime` (string, required): Shift start time in HH:MM format (24-hour)
  - Example: "09:00", "14:30", "06:00"
  - Default: "09:00"

- `endTime` (string, required): Shift end time in HH:MM format (24-hour)
  - Example: "18:00", "22:00", "14:00"
  - Default: "18:00"

- `lateThreshold` (number, required): Grace period in minutes
  - Example: 0 (no grace), 5 (5 minutes grace), 15 (15 minutes grace)
  - Default: 0
  - Min: 0
  - Max: 120

- `workingDays` (array of strings, required): Days when employee works
  - Valid values: "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"
  - Example: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"]
  - Default: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"]

### Late Employee Object
```json
{
  "employeeId": "507f1f77bcf86cd799439011",
  "employeeName": "John Doe",
  "checkInTime": "2026-05-07T09:15:00.000Z",
  "shiftStartTime": "09:00",
  "lateMinutes": 15,
  "status": "late"
}
```

**Fields**:
- `employeeId` (string): MongoDB ObjectId of employee
- `employeeName` (string): Full name of employee
- `checkInTime` (ISO 8601 datetime): Actual check-in time
- `shiftStartTime` (string): Configured shift start time (HH:MM)
- `lateMinutes` (number): Number of minutes late
- `status` (string): Always "late" for this endpoint

### Attendance Record (with Late Tracking)
```json
{
  "_id": "507f1f77bcf86cd799439020",
  "userId": "507f1f77bcf86cd799439010",
  "employeeId": "507f1f77bcf86cd799439011",
  "employeeName": "John Doe",
  "date": "2026-05-07T00:00:00.000Z",
  "checkIn": "2026-05-07T09:15:00.000Z",
  "checkOut": "2026-05-07T18:00:00.000Z",
  "status": "late",
  "isLate": true,
  "lateMinutes": 15,
  "hoursWorked": 8.75,
  "actualWorkingHours": 8.75,
  "breaks": [
    {
      "startTime": "2026-05-07T12:00:00.000Z",
      "endTime": "2026-05-07T13:00:00.000Z",
      "duration": 60,
      "breakType": "lunch"
    }
  ],
  "orgId": "org123",
  "createdAt": "2026-05-07T09:15:00.000Z",
  "updatedAt": "2026-05-07T18:00:00.000Z"
}
```

**New Fields**:
- `isLate` (boolean): Whether employee was late
- `lateMinutes` (number): Minutes late (0 if on time)
- `actualWorkingHours` (number): Working hours from actual check-in (excluding breaks)

---

## Examples

### Example 1: Standard 9-5 Office

**Request**:
```bash
curl -X PUT http://localhost:5000/api/employees/507f1f77bcf86cd799439011 \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "shiftTiming": {
      "startTime": "09:00",
      "endTime": "18:00",
      "lateThreshold": 5,
      "workingDays": ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"]
    }
  }'
```

**Result**:
- Employee must check in by 09:05 to be on time
- Checking in at 09:06 or later = late
- Works Monday-Friday only

### Example 2: Flexible Hours

**Request**:
```bash
curl -X PUT http://localhost:5000/api/employees/507f1f77bcf86cd799439012 \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "shiftTiming": {
      "startTime": "10:00",
      "endTime": "19:00",
      "lateThreshold": 15,
      "workingDays": ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"]
    }
  }'
```

**Result**:
- Employee must check in by 10:15 to be on time
- Checking in at 10:16 or later = late
- Works Monday-Friday only

### Example 3: Shift Work (No Grace Period)

**Request**:
```bash
curl -X PUT http://localhost:5000/api/employees/507f1f77bcf86cd799439013 \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "shiftTiming": {
      "startTime": "06:00",
      "endTime": "14:00",
      "lateThreshold": 0,
      "workingDays": ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]
    }
  }'
```

**Result**:
- Employee must check in at exactly 06:00 to be on time
- Checking in at 06:01 or later = late
- Works Monday-Saturday

### Example 4: Get Late Employees

**Request**:
```bash
curl -X GET http://localhost:5000/api/attendance/late-today \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json"
```

**Response**:
```json
{
  "success": true,
  "data": [
    {
      "employeeId": "507f1f77bcf86cd799439011",
      "employeeName": "John Doe",
      "checkInTime": "2026-05-07T09:15:00.000Z",
      "shiftStartTime": "09:00",
      "lateMinutes": 15,
      "status": "late"
    },
    {
      "employeeId": "507f1f77bcf86cd799439012",
      "employeeName": "Jane Smith",
      "checkInTime": "2026-05-07T09:08:00.000Z",
      "shiftStartTime": "09:00",
      "lateMinutes": 8,
      "status": "late"
    }
  ],
  "count": 2
}
```

---

## Error Codes

| Code | Message | Description |
|------|---------|-------------|
| 400 | Invalid shift timing configuration | Shift timing data is invalid |
| 401 | Unauthorized access | User not authenticated or lacks permission |
| 403 | Access denied | User doesn't have permission for this action |
| 404 | Employee not found | Employee ID doesn't exist |
| 409 | Version conflict | Employee was modified by another user |
| 500 | Internal server error | Server error occurred |

---

## Rate Limiting

- No specific rate limiting for these endpoints
- General API rate limits apply (if configured)

---

## Pagination

The `/attendance/late-today` endpoint does not support pagination as it returns only today's late employees.

---

## Filtering & Sorting

The `/attendance/late-today` endpoint returns results sorted by:
1. Employee name (alphabetically)
2. Late minutes (descending)

No additional filtering parameters are supported.

---

## Webhooks

No webhooks are currently supported for shift timing events.

---

## Changelog

### Version 1.0 (2026-05-07)
- Initial release
- Added shift timing configuration
- Added late employee tracking
- Added `/attendance/late-today` endpoint
- Added shift timing fields to employee model
- Added late tracking fields to attendance model

---

## Support

For API support or issues:
1. Check error response messages
2. Verify authentication token is valid
3. Ensure user has required permissions
4. Check shift timing configuration is valid
5. Review server logs for detailed error information
