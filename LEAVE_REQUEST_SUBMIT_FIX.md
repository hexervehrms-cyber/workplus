# Leave Request Submit Button Fix

## Problem
The "Submit Request" button in the Leave Management form was not working. The issue was caused by:

1. **Field Name Mismatch**: Frontend was sending `type` but backend expected `leaveType`
2. **Missing Employee ID**: Frontend didn't send `employeeId` which is required by backend
3. **Missing Organization ID**: Frontend wasn't properly sending `orgId`
4. **Data Format Issues**: Admin panel wasn't properly handling the response data format

## Root Causes

### Frontend Issues (Leave.tsx)
- Sending `type` instead of `leaveType`
- Not including `employeeId` in the request
- Not properly handling `orgId`
- Leave history display was using wrong field names

### Admin Panel Issues (LeaveRequests.tsx)
- Using `id` instead of `_id` from MongoDB responses
- Missing `setLoading` state variable
- Socket event handlers not formatting data correctly
- Bulk approve/reject handlers not passing required parameters

## Solutions Implemented

### 1. Fixed Frontend Leave Request Submission (Leave.tsx)

**Before:**
```javascript
const leaveData = {
  userId: user.id,
  employeeName: user.name,
  type: formData.type,  // ❌ Wrong field name
  startDate: formData.startDate,
  endDate: formData.endDate,
  reason: formData.reason,
  orgId: 'system'
};
```

**After:**
```javascript
const employeeId = user.employeeId || user.id;
const orgId = user.orgId || 'system';

const leaveData = {
  userId: user.id,
  employeeId: employeeId,  // ✅ Added required field
  leaveType: formData.type,  // ✅ Correct field name
  startDate: formData.startDate,
  endDate: formData.endDate,
  reason: formData.reason,
  orgId: orgId  // ✅ Proper orgId
};
```

### 2. Fixed Leave History Display (Leave.tsx)

**Before:**
```javascript
{leaveHistory.map((leave) => (
  <div key={leave.id}>  // ❌ Wrong field
    <h4>{leave.type}</h4>  // ❌ Wrong field
    <span>{leave.from}</span>  // ❌ Wrong field
```

**After:**
```javascript
{leaveHistory && leaveHistory.length > 0 ? (
  leaveHistory.map((leave) => (
    <div key={leave._id}>  // ✅ Correct field
      <h4>{leave.leaveType || leave.type}</h4>  // ✅ Correct field
      <span>{new Date(leave.startDate).toLocaleDateString()}</span>  // ✅ Correct field
```

### 3. Fixed Admin Leave Requests Panel (LeaveRequests.tsx)

**Added Missing State:**
```javascript
const [loading, setLoading] = useState(false);  // ✅ Added
```

**Fixed Data Formatting:**
```javascript
// Format API response to match interface
const formattedRequests = requestsData.map((req: any) => ({
  id: req._id || req.id,  // ✅ Handle MongoDB _id
  employeeId: req.employeeId,
  employeeName: req.employeeName || 'Unknown',
  startDate: req.startDate,
  endDate: req.endDate,
  reason: req.reason,
  type: req.leaveType || req.type,  // ✅ Handle both field names
  status: req.status,
  appliedAt: req.createdAt
}));
```

**Fixed Socket Event Handlers:**
```javascript
socketService.on('leave_created', (data) => {
  const formattedData = {
    id: data._id || data.id,  // ✅ Handle _id
    type: data.leaveType || data.type,  // ✅ Handle field name
    // ... other fields
  };
  setLeaveRequests(prev => [formattedData, ...prev]);
});
```

**Fixed Bulk Operations:**
```javascript
// Added approvedBy parameter
const approvedRequests = await LeaveRequestService.bulkApproveLeaveRequests(
  Array.from(selectedRequests),
  user?.id || 'admin'  // ✅ Added required parameter
);
```

## Files Modified

1. **frontend/src/app/pages/employee/Leave.tsx**
   - Fixed leave request submission data format
   - Fixed leave history display
   - Added proper error handling and logging
   - Fixed field name mappings

2. **frontend/src/app/pages/admin/LeaveRequests.tsx**
   - Added missing `loading` state
   - Fixed data formatting from API responses
   - Fixed socket event handlers
   - Fixed bulk approve/reject handlers
   - Added proper error handling

## Backend Endpoint Requirements

### POST /api/leave-requests
**Required Fields:**
```javascript
{
  userId: string,           // Employee user ID
  employeeId: string,       // Employee ID (required)
  leaveType: string,        // Type of leave (required)
  startDate: string,        // Start date (required)
  endDate: string,          // End date (required)
  reason: string,           // Reason for leave (required)
  orgId: string,            // Organization ID (required)
  isHalfDay?: boolean       // Optional: half day flag
}
```

**Response Format:**
```javascript
{
  success: true,
  message: "Leave request submitted successfully",
  data: {
    leaveRequest: {
      _id: string,
      userId: string,
      employeeId: string,
      leaveType: string,
      startDate: Date,
      endDate: Date,
      reason: string,
      status: "pending",
      createdAt: Date,
      // ... other fields
    }
  }
}
```

## Testing Checklist

- [x] Submit leave request from employee dashboard
- [x] Verify request appears in leave history
- [x] Check admin panel displays all leave requests
- [x] Test approve single leave request
- [x] Test reject single leave request
- [x] Test bulk approve multiple requests
- [x] Test bulk reject multiple requests
- [x] Verify real-time updates via Socket.IO
- [x] Check error handling for missing fields
- [x] Verify leave balance calculations

## How to Test

### Employee Side
1. Go to Employee > Leave Management
2. Click "Request Leave" button
3. Fill in all fields:
   - Leave Type: Select from dropdown
   - From Date: Select start date
   - To Date: Select end date
   - Reason: Enter reason
4. Click "Submit Request"
5. Verify success message appears
6. Check leave appears in history

### Admin Side
1. Go to Admin > Leave Requests
2. View all pending leave requests
3. Select one or more requests
4. Click "Approve Selected" or "Reject Selected"
5. Verify status updates in real-time
6. Check statistics update correctly

## Key Changes Summary

| Issue | Before | After |
|-------|--------|-------|
| Field Name | `type` | `leaveType` |
| Employee ID | Not sent | Sent as `employeeId` |
| Org ID | Hardcoded 'system' | From user context |
| Leave History | Using wrong fields | Using correct fields |
| Admin Panel | Using `id` | Using `_id` |
| Loading State | Missing | Added |
| Error Handling | Basic | Comprehensive |

## Notes

- All changes are backward compatible
- The fix handles both old and new field names for flexibility
- Proper error messages are now displayed to users
- Real-time updates work correctly with Socket.IO
- Admin panel now properly formats all data from API responses
