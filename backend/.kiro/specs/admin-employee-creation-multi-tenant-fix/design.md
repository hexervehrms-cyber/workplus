# Admin Employee Creation Multi-Tenant Fix Design

## Overview

This document outlines the comprehensive fix for eight critical bugs affecting employee creation, tenant isolation, and real-time synchronization in the HRMS platform. The bugs prevent proper multi-tenant operation where Admins cannot create employees within their organization boundaries, and Super Admin dashboards fail to reflect real-time changes across the platform.

The fix addresses orgId extraction from JWT tokens, socket room naming inconsistencies, missing change streams for real-time updates, incorrect socket payload structures, missing RBAC orgId verification, lack of MongoDB transactions for User/Employee creation, and case sensitivity issues in socket room names.

## Glossary

- **Bug_Condition (C)**: The condition that triggers the bug - when any of the 8 identified issues occur during employee creation
- **Property (P)**: The desired behavior when employee creation is performed - proper orgId assignment, correct socket events, atomic transactions, and preserved existing behavior
- **Preservation**: Existing functionality that must remain unchanged by the fix including authentication, optimistic locking, soft-delete, dashboard filtering, attendance events, notification queuing, and audit logging
- **socketManager**: The Socket.IO manager in `utils/socketManager.js` that handles real-time communication
- **orgId**: The organization identifier extracted from JWT token for tenant isolation
- **changeStream**: MongoDB feature for real-time data change notifications
- **MongoDB transaction**: Atomic operation ensuring both User and Employee records are created together or none

## Bug Details

### Bug Condition

The bug manifests when an Admin creates an employee via POST /api/employees and any of the following conditions are true: the orgId is not properly extracted from JWT, socket room names are inconsistent, change streams are not subscribed, socket payloads are malformed, RBAC verification is missing, transactions are not used, or room names have case sensitivity issues.

**Formal Specification:**
```
FUNCTION isBugCondition(input)
  INPUT: input of type Request with user object and body data
  OUTPUT: boolean
  
  orgId := input.user?.orgId OR input.user?.organizationId
  RETURN (orgId IS undefined OR orgId = 'system')
         OR socketRoomName(input.user?.orgId) IS NOT consistent
         OR changeStreamSubscription(input.user?.orgId) IS missing
         OR socketPayload(input) IS missing 'type' field
         OR RBACVerification(input.user, input.body) IS failed
         OR MongoDBTransaction(input) IS not used
         OR socketRoomName(input.user?.role) HAS case issues
END FUNCTION
```

### Examples

**Bug Condition 1 - orgId Fallback:**
When Admin "john@acme.com" (orgId: "org_123456") creates an employee, the system uses fallback 'system' instead of extracting from JWT. Actual: employee.orgId = 'system', Expected: employee.orgId = 'org_123456'.

**Bug Condition 2 - Socket Room Naming:**
When employee is created in org_123456, socket events are emitted to 'tenant_org_123456' but clients are listening on 'organization_org_123456' or 'org_org_123456'. Result: no clients receive the event.

**Bug Condition 3 - Change Streams Missing:**
Super Admin dashboard shows stale data because aggregation queries don't subscribe to change streams. When employee is created in any org, the dashboard doesn't update in real-time.

**Bug Condition 4 - Socket Payload Structure:**
Frontend expects { type: 'create', employee: {...}, timestamp: Date, orgId: string } but receives { employee: {...}, createdBy: 'System', timestamp: Date }. Missing 'type' field causes frontend to ignore the event.

**Bug Condition 5 - Analytics Not Updated:**
Employee count and orgGrowthRate are only recalculated on page refresh. No socket event is broadcast to 'super_admin' room with new analytics data.

**Bug Condition 6 - RBAC orgId Verification:**
Admin from org_A can create employee with orgId = org_B because middleware only checks role='admin' but doesn't verify the admin's orgId matches the target orgId.

**Bug Condition 7 - Orphaned User Records:**
User record is created successfully but Employee creation fails (e.g., duplicate employeeCode). Result: orphaned User record with no associated Employee.

**Bug Condition 8 - Case Sensitivity in Room Names:**
Client joins room 'Admin' but broadcastToRole('admin') sends to 'admin' room. Different rooms cause message delivery failure.

## Expected Behavior

### Preservation Requirements

**Unchanged Behaviors:**
- Regular employees calling GET /api/employees continue to receive only basic employee info (employeeCode, designation, department, joiningDate, status) with salary and personal details hidden
- Authentication middleware continues to validate JWT tokens, check user existence, and verify account isActive status
- Optimistic locking with __v version field continues to prevent race conditions on employee updates
- Soft-delete by setting status to 'terminated' and deactivating User account continues to work
- Dashboard stats filtering by user's orgId continues (except super_admin sees all)
- Real-time attendance events continue to emit to organization room
- Leave request notifications continue to queue and emit to role-based rooms
- Audit logging continues to log userId, role, endpoint, and IP address for all CRUD operations

**Scope:**
All inputs that do NOT involve the 8 identified bug conditions should be completely unaffected by this fix. This includes all existing API endpoints, authentication flows, and business logic that are not directly related to employee creation or real-time updates.

## Hypothesized Root Cause

Based on the bug description and code analysis, the most likely issues are:

**1. orgId Extraction Issue (Bug 1.1, 1.2):**
The employee creation route in routes/employees.js uses fallback logic: `const orgId = req.user?.orgId || req.user?.organizationId || 'system'`. The JWT token may contain organizationId instead of orgId, or the middleware may not be setting either property correctly. The fallback to 'system' indicates the extraction is failing silently.

**2. Socket Room Naming Inconsistency (Bug 1.2, 1.8):**
The socketManager.js uses `org_${orgId}` for organization rooms and `role_${role}` for role rooms, while server.js uses `tenant_${tenantId}` and just the role name (e.g., 'admin', 'hr') for role broadcasts. This inconsistency means events are sent to wrong room names. Additionally, server.js joins 'management' for admin/superadmin/super_admin but socketManager uses 'role_admin' format.

**3. Change Streams Not Implemented (Bug 1.3, 1.5):**
The dashboard routes don't subscribe to MongoDB change streams. The aggregation queries run once on request and don't maintain a persistent connection for real-time updates. No change stream watcher is set up to broadcast employee creation events to super_admin dashboard.

**4. Socket Payload Structure (Bug 1.4):**
The employee_created event in routes/employees.js emits: `{ employee: populatedEmployee, createdBy: req.user?.name || 'System', timestamp: new Date() }`. The frontend expects: `{ type: 'create', employee: {...}, timestamp: Date, orgId: string }`. Missing 'type' and 'orgId' fields cause frontend to not recognize the event.

**5. Analytics Update Missing (Bug 1.5):**
No socket event is broadcast to 'super_admin' room when employees are created. The dashboard_update event goes to organization room but not to super_admin room with aggregated analytics data.

**6. RBAC Verification Missing (Bug 1.6):**
The authorize middleware checks if user has 'admin' or 'hr' role but doesn't verify the admin's orgId matches the employee's orgId being created. The route handler doesn't validate that the creating admin can only create employees within their own organization.

**7. No Transaction for User/Employee Creation (Bug 1.7):**
The User.create() and Employee.create() are separate operations without a MongoDB transaction. If Employee creation fails after User succeeds, the User record remains orphaned. No transaction session is used to wrap both operations.

**8. Case Sensitivity in Room Names (Bug 1.8):**
The broadcastToRole calls use lowercase role names ('admin', 'hr') but clients may join rooms using mixed case ('Admin', 'HR', 'Administrator'). The socketManager.authenticateUser joins `role_${role}` but server.js uses just the role name for broadcasts.

## Correctness Properties

Property 1: Bug Condition - orgId Extraction from JWT

_For any_ request where an Admin creates an employee via POST /api/employees, the fixed route handler SHALL extract the organizationId from req.user.orgId (with fallback to req.user.organizationId) and create the employee record with that exact orgId, with no fallback to 'system' or null values.

**Validates: Requirements 2.1**

Property 2: Bug Condition - Socket Room Naming Consistency

_For any_ employee creation event, the fixed socketManager SHALL use consistent room naming convention across all modules, specifically using 'tenant_${orgId}' for organization rooms and lowercase role names for role-based rooms, ensuring all clients receive the events regardless of which module emitted them.

**Validates: Requirements 2.2**

Property 3: Bug Condition - Change Streams for Real-Time Updates

_For any_ employee creation event, the fixed system SHALL subscribe Super Admin dashboard to MongoDB change streams and broadcast real-time updates when employees are created in any organization, with totalEmployees count and per-organization stats updating live without page refresh.

**Validates: Requirements 2.3, 2.5**

Property 4: Bug Condition - Socket Payload Structure

_For any_ employee_created event, the fixed socket payload SHALL include 'type', 'data', 'timestamp', and 'orgId' fields matching frontend expectations, specifically { type: 'create', employee: {...}, timestamp: Date, orgId: string }.

**Validates: Requirements 2.2, 2.4**

Property 5: Bug Condition - RBAC orgId Verification

_For any_ employee creation request, the fixed RBAC middleware SHALL verify the creating admin's orgId is present, valid, and matches the target organization, rejecting creation if orgId is missing or doesn't match.

**Validates: Requirements 2.6**

Property 6: Bug Condition - MongoDB Transaction for User/Employee

_For any_ employee creation request, the fixed route handler SHALL use a MongoDB transaction to ensure both User and Employee records are created atomically, rolling back the User creation if Employee creation fails, preventing orphaned User records.

**Validates: Requirements 2.7**

Property 7: Bug Condition - Socket Room Name Normalization

_For any_ socket event broadcast, the fixed socketManager SHALL normalize room names to lowercase (e.g., 'admin', 'hr', 'super_admin') to ensure consistent client room joining regardless of how the role was stored or passed.

**Validates: Requirements 2.8**

Property 8: Preservation - Non-Employee-Creation Behavior

_For any_ request that does NOT involve employee creation (GET requests, other POST/PUT/DELETE operations), the fixed code SHALL produce exactly the same behavior as the original code, preserving all existing functionality for authentication, authorization, optimistic locking, soft-delete, dashboard filtering, attendance events, notifications, and audit logging.

**Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8**

## Fix Implementation

### Changes Required

**File: routes/employees.js**

**Function: POST /api/employees route handler (lines ~180-290)**

**Change 1.1 - Proper orgId Extraction:**
Replace the fallback logic with strict orgId extraction that rejects requests without valid orgId.

```javascript
// BEFORE (lines ~185-195):
const orgId = req.user?.orgId || req.user?.organizationId || 'system';

// AFTER:
// Strict orgId extraction - reject if not present
const orgId = req.user?.orgId || req.user?.organizationId;
if (!orgId || orgId === 'system') {
  logger.error('Employee creation failed: missing orgId in JWT', {
    userId: req.user?.userId,
    userOrgId: req.user?.orgId,
    userOrganizationId: req.user?.organizationId
  });
  return res.status(400).json({
    success: false,
    message: 'Organization ID is required. Please re-authenticate.',
    code: 'MISSING_ORG_ID'
  });
}
```

**Change 1.2 - RBAC orgId Verification:**
Add middleware to verify the admin's orgId matches the target organization.

```javascript
// Add after orgId extraction, before any database operations
// Verify admin can only create employees within their own organization
if (req.user.role !== 'super_admin' && req.body.orgId && req.body.orgId !== orgId) {
  logger.warn('RBAC violation: admin attempted to create employee in different org', {
    adminId: req.user?.userId,
    adminOrgId: orgId,
    targetOrgId: req.body.orgId
  });
  return res.status(403).json({
    success: false,
    message: 'You can only create employees within your own organization',
    code: 'ORG_ID_MISMATCH'
  });
}
```

**Change 1.3 - MongoDB Transaction for User/Employee Creation:**
Wrap User and Employee creation in a transaction session.

```javascript
// BEFORE (lines ~210-240):
// Create user
const user = await User.create({
  name: name.trim(),
  email: email.toLowerCase().trim(),
  password: hashedPassword,
  role: 'employee',
  orgId: orgId,
  isActive: true
});

// Create employee
const employee = await Employee.create({
  userId: user._id,
  employeeCode,
  // ... other fields
  orgId: orgId
});

// AFTER:
const session = await mongoose.startSession();
session.startTransaction();

try {
  // Create user within transaction
  const user = await User.create([{
    name: name.trim(),
    email: email.toLowerCase().trim(),
    password: hashedPassword,
    role: 'employee',
    orgId: orgId,
    isActive: true
  }], { session });

  // Create employee within transaction
  const employee = await Employee.create([{
    userId: user[0]._id,
    employeeCode,
    designation,
    department,
    baseSalary: baseSalary || 0,
    hra: hra || 0,
    bonus: bonus || 0,
    incentives: incentives || 0,
    allowances: allowances || 0,
    providentFund: providentFund || 0,
    tax: tax || 0,
    insurance: insurance || 0,
    otherDeductions: otherDeductions || 0,
    joiningDate: joiningDate || new Date(),
    phone,
    address,
    status: 'active',
    orgId: orgId
  }], { session });

  // Commit transaction
  await session.commitTransaction();
  session.endSession();

  // Continue with populating and emitting events
} catch (error) {
  // Rollback transaction on any error
  await session.abortTransaction();
  session.endSession();
  
  logger.error('Employee creation transaction failed', {
    error: error.message,
    orgId,
    email
  });
  
  return res.status(500).json({
    success: false,
    message: 'Failed to create employee. Please try again.',
    code: 'TRANSACTION_FAILED'
  });
}
```

**Change 1.4 - Correct Socket Payload Structure:**
Update socket event emissions to include required fields.

```javascript
// BEFORE (lines ~260-290):
if (global.socketManager) {
  // Broadcast to organization
  global.socketManager.broadcastToOrganization(orgId, 'employee_created', {
    employee: populatedEmployee,
    createdBy: req.user?.name || 'System',
    timestamp: new Date()
  });

  // Broadcast to admins and HR
  global.socketManager.broadcastToRole('admin', 'employee_created', {
    employee: populatedEmployee,
    orgId: orgId,
    createdBy: req.user?.name || 'System'
  });

  global.socketManager.broadcastToRole('hr', 'employee_created', {
    employee: populatedEmployee,
    orgId: orgId,
    createdBy: req.user?.name || 'System'
  });

  // Broadcast dashboard update event
  global.socketManager.broadcastToOrganization(orgId, 'dashboard_update', {
    type: 'employee_count',
    action: 'increment',
    data: { totalEmployees: await Employee.countDocuments({ orgId, status: 'active' }) }
  });
}

// AFTER:
if (global.socketManager) {
  // Broadcast to organization with correct payload structure
  global.socketManager.broadcastToOrganization(orgId, 'employee_created', {
    type: 'create',
    data: {
      employee: populatedEmployee,
      createdBy: req.user?.name || 'System'
    },
    orgId: orgId,
    timestamp: new Date()
  });

  // Broadcast to super_admin room for analytics update
  if (global.socketManager.broadcastToRole) {
    global.socketManager.broadcastToRole('super_admin', 'employee_created', {
      type: 'create',
      data: {
        employee: populatedEmployee,
        orgId: orgId
      },
      orgId: orgId,
      timestamp: new Date()
    });
  }

  // Broadcast to admins and HR with correct payload
  global.socketManager.broadcastToRole('admin', 'employee_created', {
    type: 'create',
    data: {
      employee: populatedEmployee,
      orgId: orgId
    },
    orgId: orgId,
    timestamp: new Date()
  });

  global.socketManager.broadcastToRole('hr', 'employee_created', {
    type: 'create',
    data: {
      employee: populatedEmployee,
      orgId: orgId
    },
    orgId: orgId,
    timestamp: new Date()
  });

  // Broadcast dashboard update event to organization
  global.socketManager.broadcastToOrganization(orgId, 'dashboard_update', {
    type: 'employee_count',
    action: 'increment',
    data: { 
      totalEmployees: await Employee.countDocuments({ orgId, status: 'active' }),
      orgId: orgId
    },
    orgId: orgId,
    timestamp: new Date()
  });

  // Broadcast analytics update to super_admin room
  if (global.socketManager.broadcastToRole) {
    const allOrgs = await Employee.aggregate([
      { $group: { _id: '$orgId', count: { $sum: 1 } } }
    ]);
    global.socketManager.broadcastToRole('super_admin', 'dashboard_update', {
      type: 'analytics',
      action: 'employee_created',
      data: {
        totalEmployees: await Employee.countDocuments({ status: 'active' }),
        orgBreakdown: allOrgs,
        newEmployee: {
          id: employee._id,
          orgId: orgId,
          name: populatedEmployee.userId?.name || name
        }
      },
      orgId: orgId,
      timestamp: new Date()
    });
  }
}
```

**File: utils/socketManager.js**

**Change 2.1 - Standardize Room Naming Convention:**
Update all room naming to use consistent 'tenant_${orgId}' format and normalize role names to lowercase.

```javascript
// BEFORE (authenticateUser method, lines ~70-120):
// Join organization room
socket.join(`org_${orgId}`);
this.addToRoom(this.organizationRooms, orgId, socket.id);

// Join role-based room
socket.join(`role_${role}`);
this.addToRoom(this.roleRooms, role, socket.id);

// AFTER:
// Normalize role to lowercase for consistent room naming
const normalizedRole = role?.toLowerCase();

// Join organization room with consistent naming
socket.join(`tenant_${orgId}`);
this.addToRoom(this.organizationRooms, orgId, socket.id);

// Join department room if available
if (departmentId) {
  socket.join(`tenant_${orgId}_dept_${departmentId}`);
  this.addToRoom(this.departmentRooms, departmentId, socket.id);
}

// Join role-based room with normalized name
socket.join(`role_${normalizedRole}`);
this.addToRoom(this.roleRooms, normalizedRole, socket.id);

// Also join simple role room for backward compatibility
socket.join(normalizedRole);
```

**Change 2.2 - Update broadcastToOrganization Method:**
Ensure consistent room naming across all broadcast methods.

```javascript
// BEFORE (broadcastToOrganization method, lines ~350-365):
broadcastToOrganization(orgId, event, data) {
  try {
    this.io.to(`org_${orgId}`).emit(event, {
      ...data,
      timestamp: new Date()
    });

    logger.info('Organization broadcast', { orgId, event });

  } catch (error) {
    logger.error('Organization broadcast error', { error: error.message });
  }
}

// AFTER:
broadcastToOrganization(orgId, event, data) {
  try {
    // Use consistent 'tenant_' prefix for organization rooms
    this.io.to(`tenant_${orgId}`).emit(event, {
      ...data,
      timestamp: new Date()
    });

    // Also emit to 'org_' prefixed room for backward compatibility
    this.io.to(`org_${orgId}`).emit(event, {
      ...data,
      timestamp: new Date()
    });

    logger.info('Organization broadcast', { orgId, event });

  } catch (error) {
    logger.error('Organization broadcast error', { error: error.message });
  }
}
```

**Change 2.3 - Update broadcastToRole Method:**
Normalize role names to lowercase and support both 'role_' prefixed and simple room names.

```javascript
// BEFORE (broadcastToRole method, lines ~370-385):
broadcastToRole(role, event, data) {
  try {
    this.io.to(`role_${role}`).emit(event, {
      ...data,
      timestamp: new Date()
    });

    logger.info('Role broadcast', { role, event });

  } catch (error) {
    logger.error('Role broadcast error', { error: error.message });
  }
}

// AFTER:
broadcastToRole(role, event, data) {
  try {
    // Normalize role to lowercase
    const normalizedRole = role?.toLowerCase();

    // Broadcast to 'role_' prefixed room
    this.io.to(`role_${normalizedRole}`).emit(event, {
      ...data,
      timestamp: new Date()
    });

    // Also broadcast to simple role room for backward compatibility
    this.io.to(normalizedRole).emit(event, {
      ...data,
      timestamp: new Date()
    });

    logger.info('Role broadcast', { role: normalizedRole, event });

  } catch (error) {
    logger.error('Role broadcast error', { error: error.message });
  }
}
```

**File: server.js**

**Change 3.1 - Update Socket Authentication Handler:**
Normalize room names and use consistent naming convention.

```javascript
// BEFORE (socket authenticate handler, lines ~450-490):
// Join new rooms
socket.join(`tenant_${tenantId}`);
socket.join(role);

// AFTER:
// Normalize role to lowercase for consistent room naming
const normalizedRole = role?.toLowerCase();

// Join organization room with consistent naming
socket.join(`tenant_${tenantId}`);

// Join role-based rooms (both prefixed and simple for compatibility)
socket.join(`role_${normalizedRole}`);
socket.join(normalizedRole);

// Join management room for admin/super_admin roles
if (normalizedRole === 'admin' || normalizedRole === 'superadmin' || normalizedRole === 'super_admin') {
  socket.join('management');
}
```

**Change 3.2 - Add Change Stream Setup for Real-Time Dashboard:**
Add MongoDB change stream watcher for employee collections.

```javascript
// Add after socketManager initialization (around line ~200):
/**
 * Setup MongoDB Change Streams for Real-Time Updates
 */
const setupChangeStreams = async () => {
  try {
    if (!isDBConnected()) {
      logger.warn('Database not connected, skipping change stream setup');
      return;
    }

    // Watch Employee collection for changes
    const employeeChangeStream = Employee.watch([], { fullDocument: 'updateLookup' });
    
    employeeChangeStream.on('change', async (change) => {
      logger.info('Employee change detected', {
        operationType: change.operationType,
        documentKey: change.documentKey?._id
      });

      // Handle different operation types
      switch (change.operationType) {
        case 'insert':
          // Broadcast employee created event
          if (global.socketManager) {
            const newEmployee = change.fullDocument;
            global.socketManager.broadcastToRole('super_admin', 'employee_created', {
              type: 'create',
              data: { employee: newEmployee },
              orgId: newEmployee?.orgId,
              timestamp: new Date()
            });

            // Update analytics
            global.socketManager.broadcastToRole('super_admin', 'dashboard_update', {
              type: 'analytics',
              action: 'employee_created',
              data: {
                orgId: newEmployee?.orgId,
                employeeId: newEmployee?._id
              },
              timestamp: new Date()
            });
          }
          break;

        case 'update':
          // Broadcast employee updated event
          if (global.socketManager) {
            global.socketManager.broadcastToOrganization(
              change.fullDocument?.orgId,
              'employee_updated',
              {
                type: 'update',
                data: { employee: change.fullDocument },
                orgId: change.fullDocument?.orgId,
                timestamp: new Date()
              }
            );
          }
          break;

        case 'delete':
          // Broadcast employee deleted event
          if (global.socketManager) {
            global.socketManager.broadcastToRole('super_admin', 'employee_deleted', {
              type: 'delete',
              data: { 
                employeeId: change.documentKey?._id,
                orgId: change.updateDescription?.updatedFields?.orgId
              },
              timestamp: new Date()
            });
          }
          break;
      }
    });

    employeeChangeStream.on('error', (error) => {
      logger.error('Employee change stream error', { error: error.message });
    });

    // Store change stream reference for cleanup
    global.employeeChangeStream = employeeChangeStream;

    logger.info('MongoDB change streams initialized for employee collection');

  } catch (error) {
    logger.error('Failed to setup change streams', { error: error.message });
  }
};

// Initialize change streams after database connection
if (isDBConnected()) {
  setupChangeStreams();
} else {
  // Retry setup when database connects
  mongoose.connection.once('connected', () => {
    setupChangeStreams();
  });
}
```

**File: middleware/auth.js**

**Change 4.1 - Add orgId Verification Middleware:**
Create middleware to verify admin's orgId matches target organization.

```javascript
// Add new middleware function:
/**
 * Verify that the creating admin's orgId matches the target organization
 * Used for employee creation and other org-scoped operations
 */
export const verifyOrgIdMatch = (targetOrgIdField = 'orgId') => {
  return asyncHandler(async (req, res, next) => {
    const userRole = req.user?.role;
    const userOrgId = req.user?.orgId || req.user?.organizationId;
    const targetOrgId = req.body[targetOrgIdField] || req.params[targetOrgIdField];

    // Super admins can operate across organizations
    if (userRole === 'super_admin') {
      return next();
    }

    // Non-admin users shouldn't be creating employees anyway (handled by authorize)
    if (!['admin', 'hr'].includes(userRole)) {
      return next();
    }

    // Verify orgId is present
    if (!userOrgId || userOrgId === 'system') {
      logger.warn('RBAC: Admin missing orgId', { userId: req.user?.userId });
      return res.status(400).json({
        success: false,
        message: 'Your organization ID is missing. Please re-authenticate.',
        code: 'ADMIN_MISSING_ORG_ID'
      });
    }

    // If target orgId is provided, verify it matches
    if (targetOrgId && targetOrgId !== userOrgId) {
      logger.warn('RBAC: OrgId mismatch', {
        userId: req.user?.userId,
        userOrgId,
        targetOrgId
      });
      return res.status(403).json({
        success: false,
        message: 'You can only perform this action within your own organization',
        code: 'ORG_ID_MISMATCH'
      });
    }

    // Set the orgId from user's orgId if not provided in body
    if (!targetOrgId) {
      req.body[targetOrgIdField] = userOrgId;
    }

    next();
  });
};
```

**File: routes/employees.js**

**Change 5.1 - Apply orgId Verification Middleware:**
Add the verifyOrgIdMatch middleware to the POST route.

```javascript
// BEFORE (line ~180):
router.post('/', authorize('super_admin', 'admin', 'hr'), asyncHandler(async (req, res) => {

// AFTER:
router.post('/', authorize('super_admin', 'admin', 'hr'), verifyOrgIdMatch(), asyncHandler(async (req, res) => {
```

## Testing Strategy

### Validation Approach

The testing strategy follows a two-phase approach: first, surface counterexamples that demonstrate the bugs on unfixed code, then verify the fix works correctly and preserves existing behavior. Each bug condition will be tested with specific test cases targeting the root cause.

### Exploratory Bug Condition Checking

**Goal:** Surface counterexamples that demonstrate each bug BEFORE implementing the fix. Confirm or refute the root cause analysis. If we refute, we will need to re-hypothesize.

**Test Plan:** Write tests that simulate employee creation scenarios for each bug condition. Run these tests on the UNFIXED code to observe failures and understand the root cause.

**Test Cases:**

1. **orgId Extraction Test:** Create employee with admin user, verify orgId in created employee record. Expected: orgId matches admin's orgId. Counterexample on unfixed: orgId is 'system' or undefined.

2. **Socket Room Naming Test:** Create employee, verify socket event is received in client. Expected: client in 'tenant_${orgId}' room receives event. Counterexample on unfixed: client doesn't receive event due to room name mismatch.

3. **Change Stream Test:** Create employee, verify Super Admin dashboard receives real-time update. Expected: change stream event triggers dashboard update. Counterexample on unfixed: no real-time update, only page refresh works.

4. **Socket Payload Structure Test:** Create employee, verify socket payload has 'type' field. Expected: payload has type: 'create'. Counterexample on unfixed: payload missing 'type' field.

5. **Analytics Update Test:** Create employee, verify Super Admin analytics update in real-time. Expected: totalEmployees count updates without page refresh. Counterexample on unfixed: analytics only update on page refresh.

6. **RBAC orgId Verification Test:** Admin from org_A attempts to create employee with orgId = org_B. Expected: request rejected with 403. Counterexample on unfixed: request succeeds, employee created in wrong org.

7. **Transaction Test:** Simulate Employee creation failure after User creation. Expected: User record is rolled back. Counterexample on unfixed: User record remains orphaned.

8. **Case Sensitivity Test:** Client joins 'Admin' room, broadcast to 'admin' room. Expected: client receives message. Counterexample on unfixed: client doesn't receive message due to case mismatch.

**Expected Counterexamples:**
- Employee records created with orgId = 'system' instead of actual orgId
- Socket events not received by clients due to room name inconsistencies
- No real-time updates on Super Admin dashboard
- Frontend ignores socket events due to missing 'type' field
- Analytics only update on page refresh
- Cross-organization employee creation succeeds when it should fail
- Orphaned User records when Employee creation fails
- Socket messages not delivered due to case sensitivity

### Fix Checking

**Goal:** Verify that for all inputs where the bug condition holds, the fixed function produces the expected behavior.

**Pseudocode:**
```
FOR ALL input WHERE isBugCondition(input) DO
  result := fixedFunction(input)
  ASSERT expectedBehavior(result)
END FOR
```

### Preservation Checking

**Goal:** Verify that for all inputs where the bug condition does NOT hold, the fixed function produces the same result as the original function.

**Pseudocode:**
```
FOR ALL input WHERE NOT isBugCondition(input) DO
  ASSERT originalFunction(input) = fixedFunction(input)
END FOR
```

**Testing Approach:** Property-based testing is recommended for preservation checking because it generates many test cases automatically across the input domain, catches edge cases that manual unit tests might miss, and provides strong guarantees that behavior is unchanged for all non-buggy inputs.

**Test Plan:** Observe behavior on UNFIXED code first for non-employee-creation operations, then write property-based tests capturing that behavior.

**Test Cases:**
1. **Employee List Preservation:** Verify GET /api/employees returns limited fields for regular employees
2. **Authentication Preservation:** Verify authentication middleware continues to validate tokens correctly
3. **Optimistic Locking Preservation:** Verify PUT /api/employees/:id uses __v for version control
4. **Soft Delete Preservation:** Verify DELETE sets status to 'terminated' and deactivates User
5. **Dashboard Filtering Preservation:** Verify GET /api/dashboard/stats filters by orgId
6. **Attendance Events Preservation:** Verify attendance check-in/out emits to organization room
7. **Notification Preservation:** Verify leave request notifications queue and emit correctly
8. **Audit Logging Preservation:** Verify all CRUD operations log userId, role, endpoint, IP

### Unit Tests

- Test orgId extraction from JWT with various token formats
- Test socket room naming consistency across modules
- Test change stream event emission for all operation types
- Test socket payload structure matches frontend expectations
- Test RBAC orgId verification rejects cross-organization requests
- Test MongoDB transaction rolls back on failure
- Test socket room name normalization handles case variations
- Test all preservation requirements for non-employee-creation operations

### Property-Based Tests

- Generate random JWT payloads and verify orgId extraction works correctly
- Generate random organization IDs and verify socket room naming is consistent
- Generate random employee creation requests and verify transaction atomicity
- Generate random role names and verify case normalization works
- Generate random non-employee-creation requests and verify preservation of existing behavior

### Integration Tests

- Test full employee creation flow with socket events and real-time updates
- Test Super Admin dashboard receives real-time updates via change streams
- Test cross-organization employee creation is blocked
- Test orphaned User records are prevented with transactions
- Test end-to-end socket communication with proper room naming
- Test complete authentication and authorization flow with orgId verification