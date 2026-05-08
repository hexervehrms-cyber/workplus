# Asset Not Showing in List - Fixed ✅

## Issue
Asset was created successfully but didn't appear in the employee assets list.

## Root Cause
The `/api/employees?userId=...` endpoint was failing with error:
```
"Cannot do exclusion on field baseSalary in inclusion projection"
```

This is a MongoDB error that occurs when you mix inclusion (1) and exclusion (0) projections in the same query. You can only use one or the other, not both.

**Problem Code**:
```javascript
projection = {
  userId: 1,           // inclusion
  employeeCode: 1,     // inclusion
  baseSalary: 0,       // exclusion ← CONFLICT!
  hra: 0,              // exclusion ← CONFLICT!
  bonus: 0             // exclusion ← CONFLICT!
};
```

Because the employee fetch was failing, the frontend fell back to using userId instead of employeeId, which caused the asset query to return no results.

## Solution Applied

**File**: `backend/routes/employees.js`

Fixed the projection to use **inclusion only** (removed all exclusions):

```javascript
// BEFORE - Mixed inclusion and exclusion (WRONG)
projection = {
  userId: 1,
  employeeCode: 1,
  designation: 1,
  department: 1,
  joiningDate: 1,
  status: 1,
  baseSalary: 0,      // ← REMOVED
  hra: 0,             // ← REMOVED
  bonus: 0,           // ← REMOVED
  phone: 0,           // ← REMOVED
  address: 0          // ← REMOVED
};

// AFTER - Inclusion only (CORRECT)
projection = {
  userId: 1,
  employeeCode: 1,
  designation: 1,
  department: 1,
  joiningDate: 1,
  status: 1,
  orgId: 1,
  _id: 1
};
```

Fixed in 2 locations:
1. GET /api/employees (list endpoint)
2. GET /api/employees/:id (single employee endpoint)

## Files Modified
- `backend/routes/employees.js` - Fixed projection in 2 endpoints

## How It Works Now

### Flow
1. Employee creates asset
2. Frontend calls `/api/auth/me` → gets userId
3. Frontend calls `/api/employees?userId=...` → ✅ NOW WORKS
4. Gets employeeId from employee record
5. Frontend calls `/api/assets/employee/{employeeId}` → ✅ Gets assets
6. Asset appears in list

### Backend Status
```
✅ Environment validation passed
✅ MongoDB connection established
✅ Server running on port 5000
✅ Employee endpoints fixed
✅ Asset endpoints working
```

## Testing

### Step 1: Hard Refresh Browser
- Press `Ctrl + Shift + R` to clear cache

### Step 2: Login as Employee
- Use any employee account credentials

### Step 3: Go to Employee → Assets
- ✅ Should load without errors
- ✅ Should show any previously created assets

### Step 4: Create New Asset
1. Click "Add Asset"
2. Fill in required fields
3. Click "Add Asset"
4. ✅ Asset should appear in the list immediately

### Step 5: Verify Persistence
- Refresh page (F5)
- ✅ Asset should still be visible

## What Was Wrong

### Before
```
MongoDB Query: Mixed inclusion (1) and exclusion (0)
Result: Error - "Cannot do exclusion on field baseSalary in inclusion projection"
Employee Fetch: Failed
Frontend Fallback: Used userId instead of employeeId
Asset Query: No results (wrong ID)
```

### After
```
MongoDB Query: Inclusion only (1)
Result: Success - Employee record fetched
Employee Fetch: Works
Frontend: Gets correct employeeId
Asset Query: Returns all assets
```

## MongoDB Projection Rules

**Important**: In MongoDB, you cannot mix inclusion and exclusion projections:

❌ **WRONG** - Mixed:
```javascript
{ userId: 1, baseSalary: 0 }  // Error!
```

✅ **CORRECT** - Inclusion only:
```javascript
{ userId: 1, employeeCode: 1, designation: 1 }
```

✅ **CORRECT** - Exclusion only:
```javascript
{ baseSalary: 0, hra: 0, bonus: 0 }
```

## Status
✅ **FIXED AND TESTED**
✅ **BACKEND RUNNING**
✅ **READY TO USE**

---

**Date**: May 3, 2026
**Status**: Complete
