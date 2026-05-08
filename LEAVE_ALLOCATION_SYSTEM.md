# Leave Allocation System - Complete Implementation

## Overview
A comprehensive leave management system that allows admins to allocate leave balances to employees on a monthly basis, and employees to apply for leaves which are automatically deducted from their allocated kitty.

## Features Implemented

### 1. Backend Models & Routes

#### LeaveAllocation Model (`backend/models/LeaveAllocation.js`)
- Stores monthly leave allocations for each employee
- Tracks allocated, used, pending, and carried forward leaves
- Supports 10 leave types:
  - Vacation
  - Sick Leave
  - Casual Leave
  - Maternity Leave
  - Paternity Leave
  - Compensatory Off
  - Personal
  - Emergency
  - NCNS (No Call No Show)
  - Sandwich Leave

#### Leave Allocation Routes (`backend/routes/leave-allocation.js`)
- `GET /api/leave-allocation/employee/:employeeId` - Get employee allocations
- `GET /api/leave-allocation/organization/:orgId` - Get org allocations with pagination
- `POST /api/leave-allocation` - Create/update allocation
- `GET /api/leave-allocation/:id` - Get single allocation
- `PATCH /api/leave-allocation/:id` - Update allocation
- `DELETE /api/leave-allocation/:id` - Delete allocation
- `GET /api/leave-allocation/balance/:employeeId` - Get current leave balance
- `POST /api/leave-allocation/deduct` - Deduct leaves when approved
- `POST /api/leave-allocation/restore` - Restore leaves when rejected
- `POST /api/leave-allocation/bulk-allocate` - Bulk allocate to multiple employees

### 2. Frontend Components

#### Admin Leave Allocation Page (`frontend/src/app/pages/admin/LeaveAllocation.tsx`)
- **Features:**
  - Filter allocations by year and month
  - View all employee allocations in a table
  - Add new leave allocations for employees
  - Edit existing allocations
  - Delete allocations
  - Form dialog with all 10 leave types
  - Real-time updates

- **UI Elements:**
  - Year and Month selectors
  - Employee selection dropdown
  - Leave type input fields (numeric)
  - Add, Edit, Delete buttons
  - Professional card-based layout

#### Employee Leave Page (Updated `frontend/src/app/pages/employee/Leave.tsx`)
- **Enhanced Features:**
  - Display leave balance KPI cards showing:
    - Total allocated leaves
    - Used leaves
    - Pending leaves
    - Available remaining leaves
  - Leave request form with balance validation
  - Automatic deduction of leaves when request is submitted
  - Real-time balance updates
  - Leave history with status badges

### 3. API Service

#### LeaveAllocationService (`frontend/src/app/utils/api.ts`)
```typescript
- getEmployeeAllocations(employeeId, year?, month?)
- getOrganizationAllocations(orgId, year?, month?, status?)
- createAllocation(data)
- updateAllocation(allocationId, data)
- deleteAllocation(allocationId)
- getEmployeeBalance(employeeId)
- deductLeaves(employeeId, leaveType, days, leaveRequestId?)
- restoreLeaves(employeeId, leaveType, days, leaveRequestId?)
- bulkAllocate(orgId, year, month, employees, allocations, allocatedBy)
```

### 4. Navigation & Routing

#### Admin Sidebar
- Added "Leave Allocation" under "Leave Management" submenu
- Path: `/admin/leave-allocation`

#### Routes
- Added route in `frontend/src/app/routes.tsx`
- Protected route with admin role requirement

## Workflow

### Admin Workflow
1. Navigate to Admin → Leave Management → Leave Allocation
2. Select Year and Month
3. Click "Add Allocation"
4. Select Employee
5. Enter leave days for each leave type
6. Click "Save Allocation"
7. Allocations are saved and visible in the table

### Employee Workflow
1. Navigate to Employee → Leave
2. View Leave Balance KPI cards showing:
   - Total days allocated
   - Days already used
   - Days pending approval
   - Days available to apply
3. Click "Request Leave"
4. Select leave type (system validates available balance)
5. Select dates and enter reason
6. Submit request
7. Leaves are automatically deducted from the kitty
8. Balance updates in real-time

## Leave Balance Calculation

```
Available Balance = (Allocated + Carried Forward) - Used - Pending
```

- **Allocated**: Days allocated by admin for the month
- **Carried Forward**: Days carried from previous month
- **Used**: Days deducted when leave is approved
- **Pending**: Days deducted when leave request is submitted

## Database Schema

### LeaveAllocation Collection
```javascript
{
  employeeId: ObjectId,
  userId: ObjectId,
  orgId: String,
  year: Number,
  month: Number,
  allocations: {
    vacation: Number,
    sickLeave: Number,
    casualLeave: Number,
    maternityLeave: Number,
    paternityLeave: Number,
    compensatoryOff: Number,
    personal: Number,
    emergency: Number,
    ncns: Number,
    sandwichLeave: Number
  },
  used: { /* same structure */ },
  pending: { /* same structure */ },
  carriedForward: { /* same structure */ },
  notes: String,
  status: "draft" | "allocated" | "locked",
  allocatedBy: ObjectId,
  allocatedDate: Date,
  createdAt: Date,
  updatedAt: Date
}
```

## Integration Points

### With Leave Request System
- When employee submits leave request, system checks available balance
- If balance is insufficient, request is rejected
- When leave is approved, leaves are deducted from allocation
- When leave is rejected, leaves are restored to allocation

### With Employee Dashboard
- Leave balance is displayed in KPI cards
- Real-time updates via Socket.IO
- Pending leaves are shown separately

## Error Handling

- Insufficient balance validation
- Duplicate allocation prevention (unique index on employeeId, year, month)
- Optimistic locking for concurrent updates
- Comprehensive error messages

## Future Enhancements

1. Carry forward logic for unused leaves
2. Leave expiry management
3. Bulk allocation templates
4. Leave policy engine integration
5. Leave balance reports
6. Approval workflows for allocations
7. Leave adjustment requests
8. Historical leave balance tracking

## Files Modified/Created

### Backend
- ✅ `backend/models/LeaveAllocation.js` - NEW
- ✅ `backend/routes/leave-allocation.js` - NEW
- ✅ `backend/server.js` - MODIFIED (added routes import and registration)

### Frontend
- ✅ `frontend/src/app/pages/admin/LeaveAllocation.tsx` - NEW
- ✅ `frontend/src/app/pages/employee/Leave.tsx` - MODIFIED (added balance display and deduction)
- ✅ `frontend/src/app/utils/api.ts` - MODIFIED (added LeaveAllocationService)
- ✅ `frontend/src/app/routes.tsx` - MODIFIED (added route)
- ✅ `frontend/src/app/components/Sidebar.tsx` - MODIFIED (added menu item)

## Testing Checklist

- [ ] Admin can create leave allocation for employee
- [ ] Admin can view allocations by month/year
- [ ] Admin can edit allocations
- [ ] Admin can delete allocations
- [ ] Employee can view leave balance
- [ ] Employee can apply for leave with sufficient balance
- [ ] Employee cannot apply for leave with insufficient balance
- [ ] Leaves are deducted when request is submitted
- [ ] Balance updates in real-time
- [ ] Leaves are restored when request is rejected
- [ ] Bulk allocation works for multiple employees
- [ ] Pagination works for large datasets
- [ ] Optimistic locking prevents conflicts

## API Endpoints Summary

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/leave-allocation/employee/:employeeId` | Get employee allocations |
| GET | `/api/leave-allocation/organization/:orgId` | Get org allocations |
| POST | `/api/leave-allocation` | Create allocation |
| GET | `/api/leave-allocation/:id` | Get single allocation |
| PATCH | `/api/leave-allocation/:id` | Update allocation |
| DELETE | `/api/leave-allocation/:id` | Delete allocation |
| GET | `/api/leave-allocation/balance/:employeeId` | Get balance |
| POST | `/api/leave-allocation/deduct` | Deduct leaves |
| POST | `/api/leave-allocation/restore` | Restore leaves |
| POST | `/api/leave-allocation/bulk-allocate` | Bulk allocate |
