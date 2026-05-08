# Sensitive Information 12-Hour Lock Feature - Implementation Complete

## Overview
Implemented a comprehensive 12-hour edit restriction feature for sensitive employee information (Aadhar, PAN, Bank Account, IFSC Code). Once an employee updates any sensitive field, it becomes locked for 12 hours, preventing further edits during that period.

## Features Implemented

### 1. Frontend Changes (`frontend/src/app/pages/employee/Profile.tsx`)

#### New Imports
- Added `LockOpen` and `Clock` icons from lucide-react for better visual feedback

#### Updated EmployeeData Interface
- Added `sensitiveInfoLocks` field to track lock timestamps for each sensitive field:
  ```typescript
  sensitiveInfoLocks?: {
    aadharNumber?: number;
    panNumber?: number;
    bankAccount?: number;
    ifscCode?: number;
  };
  ```

#### New State Variables
- `isEditingSensitive`: Boolean to toggle edit mode for sensitive information
- `sensitiveForm`: Object containing current values of sensitive fields
- `lockedFields`: Object tracking which fields are currently locked
- `lockTimestamps`: Object storing the timestamp when each field was locked
- `remainingTime`: Object displaying countdown timer for each locked field

#### New useEffect Hooks
1. **Initialize Sensitive Form** (runs when employee data loads):
   - Populates sensitive form with current employee data
   - Checks lock status for each field
   - Calculates if 12-hour lock period has expired
   - Sets initial lock state

2. **Countdown Timer** (runs every minute):
   - Updates remaining lock time for each field
   - Automatically unlocks fields when 12 hours have passed
   - Cleans up interval on component unmount

#### New Handler Function
- `handleUpdateSensitive()`: 
  - Sends PUT request to `/api/profile` with sensitive information
  - Includes all sensitive fields in the request
  - Shows success toast with "locked for 12 hours" message
  - Refreshes employee data after update

#### Updated Sensitive Information Card UI
- **Edit Mode Toggle**: 
  - "Edit" button to enter edit mode
  - "Cancel" and "Save & Lock" buttons in edit mode
  
- **Field Display**:
  - View mode: Shows masked values (e.g., "**** **** ****" for Aadhar)
  - Edit mode: Shows input fields for editing
  - Locked fields: Disabled with gray background
  
- **Lock Status Indicator**:
  - Lock icon with countdown timer (e.g., "11h 45m") when locked
  - LockOpen icon when field is editable
  - Tooltip showing lock status
  
- **Warning Banner**:
  - Appears when in edit mode and some fields are locked
  - Explains that locked fields cannot be edited until restriction expires

### 2. Backend Changes

#### Employee Model (`backend/models/Employee.js`)
Added new field to track lock timestamps:
```javascript
sensitiveInfoLocks: {
  aadharNumber: { type: Number, default: null },
  panNumber: { type: Number, default: null },
  bankAccount: { type: Number, default: null },
  ifscCode: { type: Number, default: null }
}
```

#### Profile Route (`backend/routes/profile.js`)
Updated PUT `/api/profile` endpoint to handle sensitive information:

1. **Request Body**: Now accepts `sensitiveInfo` object with sensitive fields
2. **Lock Timestamp Logic**:
   - When sensitive field is updated, current timestamp (Date.now()) is stored
   - Timestamp is stored in `sensitiveInfoLocks` for that field
   - Frontend uses this timestamp to calculate remaining lock time
3. **Validation**: Trims and validates all sensitive information
4. **Logging**: Logs sensitive information updates with timestamp

## How It Works

### User Flow
1. Employee clicks "Edit" button in Sensitive Information section
2. Fields become editable (unless locked)
3. Employee updates desired fields
4. Employee clicks "Save & Lock" button
5. Updated information is sent to backend with current timestamp
6. Backend stores timestamp for each updated field
7. Frontend receives updated data and locks fields for 12 hours
8. Countdown timer shows remaining lock time (updates every minute)
9. After 12 hours, fields automatically unlock and become editable again

### Lock Duration Calculation
- **Lock Duration**: 12 hours = 12 × 60 × 60 × 1000 milliseconds
- **Lock Check**: `timeSinceLock < LOCK_DURATION`
- **Remaining Time**: `LOCK_DURATION - timeSinceLock`
- **Display Format**: "Xh Ym" (e.g., "11h 45m")

### Security Features
- Locked fields are disabled and cannot be edited
- Lock status is persisted in database
- Countdown timer prevents accidental edits
- Visual indicators (lock icon, warning banner) inform user of restrictions
- Timestamps are stored server-side for audit trail

## API Endpoint

### PUT `/api/profile`
**Request Body**:
```json
{
  "sensitiveInfo": {
    "aadharNumber": "123456789012",
    "panNumber": "ABCDE1234F",
    "bankAccount": "1234567890123456",
    "ifscCode": "SBIN0001234"
  }
}
```

**Response**:
```json
{
  "success": true,
  "message": "Profile updated successfully",
  "data": {
    "user": { ... },
    "employee": {
      "aadharNumber": "123456789012",
      "panNumber": "ABCDE1234F",
      "bankAccount": "1234567890123456",
      "ifscCode": "SBIN0001234",
      "sensitiveInfoLocks": {
        "aadharNumber": 1714752000000,
        "panNumber": 1714752000000,
        "bankAccount": 1714752000000,
        "ifscCode": 1714752000000
      }
    }
  }
}
```

## Files Modified

1. **Frontend**:
   - `frontend/src/app/pages/employee/Profile.tsx` - Main implementation

2. **Backend**:
   - `backend/models/Employee.js` - Added sensitiveInfoLocks field
   - `backend/routes/profile.js` - Added sensitive info update logic

## Testing Checklist

- [ ] Employee can enter edit mode for sensitive information
- [ ] Employee can update sensitive fields
- [ ] After saving, fields are locked for 12 hours
- [ ] Lock status shows countdown timer
- [ ] Locked fields are disabled and cannot be edited
- [ ] Warning banner appears when fields are locked
- [ ] After 12 hours, fields automatically unlock
- [ ] Countdown timer updates every minute
- [ ] Page refresh maintains lock status
- [ ] Multiple fields can have different lock times
- [ ] Toast notification shows success message
- [ ] Error handling works for failed updates

## Future Enhancements

1. **Admin Override**: Allow admins to unlock sensitive fields immediately
2. **Audit Trail**: Track all sensitive information changes with user and timestamp
3. **Email Notification**: Send email when sensitive information is updated
4. **Two-Factor Verification**: Require 2FA for sensitive information updates
5. **Change History**: Show history of sensitive information changes
6. **Partial Masking**: Show more digits in masked view (e.g., last 4 digits)

## Notes

- Lock duration is hardcoded to 12 hours (can be made configurable)
- Timestamps are stored as milliseconds since epoch (Date.now())
- Countdown updates every minute (can be adjusted for real-time updates)
- All sensitive fields are masked in view mode for security
- Backend validates and trims all input before storing
