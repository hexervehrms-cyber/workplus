# Bugfix Requirements Document

## Introduction

This document captures the critical enterprise HRMS architecture bugs affecting employee creation, tenant isolation, and real-time synchronization. The bugs prevent proper multi-tenant operation where Admins cannot create employees within their organization boundaries, and Super Admin dashboards fail to reflect real-time changes across the platform.

## Bug Analysis

### Current Behavior (Defect)

1.1 WHEN an Admin creates an employee via POST /api/employees THEN the system uses fallback orgId 'system' when req.user.orgId is undefined, causing employee records to be created outside any organization and breaking tenant isolation

1.2 WHEN an Admin creates an employee THEN the socket events (employee_created, dashboard_update) are emitted but may not reach connected clients due to room naming inconsistencies between 'tenant_{orgId}' and 'organization_{orgId}' in different modules

1.3 WHEN a Super Admin views the dashboard via GET /api/dashboard/superadmin THEN the aggregation queries do not subscribe to change streams or receive real-time updates when employees are created across organizations

1.4 WHEN an Admin creates an employee THEN the frontend employee table does not automatically refresh because the socket event payload structure does not match what the frontend expects (missing 'type' field in employee_created event)

1.5 WHEN an Admin creates an employee THEN the employee is saved to MongoDB but the Super Admin analytics (totalEmployees, orgGrowthRate) are only recalculated on page refresh, not updated in real-time

1.6 WHEN an Admin creates an employee THEN the role-based access control allows any user with 'admin' role to create employees, but the middleware does not verify the admin's own orgId matches the employee's orgId being created

1.7 WHEN an Admin creates an employee THEN the password is hashed correctly but the employee profile creation may fail silently if the User record creation succeeds but Employee record creation fails, leaving orphaned User records

1.8 WHEN an Admin creates an employee THEN the socketManager.broadcastToRole calls use 'admin' and 'hr' room names, but connected clients may be in 'Admin' or 'administrator' rooms due to case sensitivity issues

### Expected Behavior (Correct)

2.1 WHEN an Admin creates an employee via POST /api/employees THEN the system SHALL extract the admin's organizationId from the JWT token (req.user.orgId) and create the employee record with that exact orgId, with no fallback to 'system' or null values

2.2 WHEN an Admin creates an employee THEN the system SHALL emit socket events to the correct organization room using consistent naming convention (tenant_{orgId}) and the event payload SHALL include 'type', 'data', 'timestamp', and 'orgId' fields matching frontend expectations

2.3 WHEN a Super Admin views the dashboard THEN the system SHALL provide real-time updates via Socket.IO when employees are created in any organization, with the totalEmployees count and per-organization stats updating live without page refresh

2.4 WHEN an Admin creates an employee THEN the frontend SHALL receive a properly structured socket event that triggers an automatic refetch of the employee list, with the event containing { type: 'create', employee: {...}, timestamp: Date, orgId: string }

2.5 WHEN an Admin creates an employee THEN the Super Admin analytics SHALL update in real-time, with socket events broadcast to 'super_admin' room containing the new employee count and organization breakdown

2.6 WHEN an Admin creates an employee THEN the RBAC middleware SHALL verify the creating admin's orgId is present and valid, and SHALL reject creation if the admin's orgId does not match the target organization or if orgId is missing

2.7 WHEN an Admin creates an employee THEN the system SHALL use a MongoDB transaction to ensure both User and Employee records are created atomically, preventing orphaned User records on partial failure

2.8 WHEN an Admin creates an employee THEN the socket room names SHALL be normalized to lowercase (e.g., 'admin', 'hr', 'super_admin') to ensure consistent client room joining regardless of how the role was stored

### Unchanged Behavior (Regression Prevention)

3.1 WHEN a regular employee (non-admin) calls GET /api/employees THEN the system SHALL CONTINUE TO return only basic employee info (employeeCode, designation, department, joiningDate, status) with salary and personal details hidden

3.2 WHEN any user with valid JWT calls any API endpoint THEN the authentication middleware SHALL CONTINUE TO validate the token, check user existence, and verify account isActive status

3.3 WHEN an Admin updates an employee via PUT /api/employees/:id THEN the optimistic locking with __v version field SHALL CONTINUE TO prevent race conditions

3.4 WHEN an Admin deletes (terminates) an employee via DELETE /api/employees/:id THEN the system SHALL CONTINUE TO soft-delete by setting status to 'terminated' and deactivating the associated User account

3.5 WHEN any user queries dashboard stats via GET /api/dashboard/stats THEN the system SHALL CONTINUE TO filter results by the user's orgId (except super_admin who sees all)

3.6 WHEN an employee checks in/out via POST /api/employee-dashboard/attendance/checkin THEN the real-time attendance events SHALL CONTINUE TO emit to the organization room

3.7 WHEN leave requests are created or updated THEN the notification system SHALL CONTINUE TO queue and emit events to appropriate role-based rooms

3.8 WHEN any CRUD operation occurs THEN the audit logging middleware SHALL CONTINUE TO log the action with userId, role, endpoint, and IP address