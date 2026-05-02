# Implementation Plan

## Bug Condition Exploration Tests

- [x] 1. Write orgId extraction bug condition exploration test
  - **Property 1: Bug Condition** - orgId Extraction from JWT
  - **IMPORTANT**: Write this property-based test BEFORE implementing the fix
  - **GOAL**: Surface counterexamples that demonstrate the orgId extraction bug exists
  - Test that POST /api/employees with admin user extracts orgId from JWT correctly
  - Verify created employee.orgId matches admin's orgId (not 'system' or undefined)
  - Counterexample to find: employee.orgId = 'system' when admin has valid orgId
  - Run test on UNFIXED code - expect FAILURE (confirms bug exists)
  - Document counterexamples found (e.g., "Admin from org_123456 creates employee with orgId='system'")
  - _Requirements: 2.1_

- [ ] 2. Write socket room naming bug condition exploration test
  - **Property 1: Bug Condition** - Socket Room Naming Consistency
  - **IMPORTANT**: Write this property-based test BEFORE implementing the fix
  - **GOAL**: Surface counterexamples that demonstrate socket room naming inconsistency
  - Test that employee_created event is received by clients in 'tenant_${orgId}' room
  - Verify broadcastToOrganization uses consistent room naming across modules
  - Counterexample to find: client in 'tenant_org_123456' doesn't receive events sent to 'org_org_123456'
  - Run test on UNFIXED code - expect FAILURE (confirms bug exists)
  - Document counterexamples found
  - _Requirements: 2.2_

- [ ] 3. Write socket payload structure bug condition exploration test
  - **Property 1: Bug Condition** - Socket Payload Structure
  - **IMPORTANT**: Write this property-based test BEFORE implementing the fix
  - **GOAL**: Surface counterexamples that demonstrate incorrect socket payload structure
  - Test that employee_created event payload includes 'type', 'data', 'timestamp', 'orgId' fields
  - Verify payload structure matches frontend expectations: { type: 'create', data: {...}, timestamp: Date, orgId: string }
  - Counterexample to find: payload missing 'type' field or has wrong structure
  - Run test on UNFIXED code - expect FAILURE (confirms bug exists)
  - Document counterexamples found
  - _Requirements: 2.2, 2.4_

- [ ] 4. Write RBAC orgId verification bug condition exploration test
  - **Property 1: Bug Condition** - RBAC orgId Verification
  - **IMPORTANT**: Write this property-based test BEFORE implementing the fix
  - **GOAL**: Surface counterexamples that demonstrate missing RBAC orgId verification
  - Test that admin from org_A cannot create employee with orgId = org_B
  - Verify request is rejected with 403 when admin's orgId doesn't match target orgId
  - Counterexample to find: admin from org_A successfully creates employee in org_B
  - Run test on UNFIXED code - expect FAILURE (confirms bug exists)
  - Document counterexamples found
  - _Requirements: 2.6_

- [ ] 5. Write MongoDB transaction bug condition exploration test
  - **Property 1: Bug Condition** - MongoDB Transaction for User/Employee
  - **IMPORTANT**: Write this property-based test BEFORE implementing the fix
  - **GOAL**: Surface counterexamples that demonstrate missing transaction for User/Employee creation
  - Test that User and Employee are created atomically (both succeed or both fail)
  - Verify no orphaned User record when Employee creation fails
  - Counterexample to find: User created but Employee creation fails, leaving orphaned User
  - Run test on UNFIXED code - expect FAILURE (confirms bug exists)
  - Document counterexamples found
  - _Requirements: 2.7_

## Preservation Property Tests

- [ ] 6. Write preservation property tests for non-employee-creation behavior
  - **Property 2: Preservation** - Non-Employee-Creation Behavior
  - **IMPORTANT**: Follow observation-first methodology
  - Observe: GET /api/employees returns basic employee info (employeeCode, designation, department, joiningDate, status) with salary/personal details hidden
  - Observe: Authentication middleware continues validating JWT tokens
  - Observe: Optimistic locking with __v version field prevents race conditions
  - Observe: Soft-delete sets status to 'terminated' and deactivates User account
  - Observe: Dashboard stats filtering by user's orgId works correctly
  - Observe: Real-time attendance events emit to organization room
  - Observe: Leave request notifications queue and emit to role-based rooms
  - Observe: Audit logging logs userId, role, endpoint, and IP address
  - Write property-based tests capturing observed behavior patterns
  - Run tests on UNFIXED code - expect PASSING (confirms baseline behavior)
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8_

## Implementation

- [ ] 7. Fix routes/employees.js - orgId extraction and RBAC verification

  - [ ] 7.1 Implement strict orgId extraction (Change 1.1)
    - Remove fallback to 'system' in orgId extraction
    - Reject requests with missing or 'system' orgId with 400 error
    - Log error with userId and orgId details for debugging
    - _Bug_Condition: isBugCondition(input) where input.user.orgId is undefined or 'system'_
    - _Expected_Behavior: Return 400 with code MISSING_ORG_ID_
    - _Preservation: GET requests and other operations unchanged_
    - _Requirements: 2.1_

  - [ ] 7.2 Add RBAC orgId verification middleware (Change 1.2)
    - Verify admin's orgId matches target organization in request body
    - Reject with 403 if admin from org_A attempts to create employee in org_B
    - Allow super_admin to operate across organizations
    - _Bug_Condition: isBugCondition(input) where RBACVerification(input.user, input.body) fails_
    - _Expected_Behavior: Return 403 with code ORG_ID_MISMATCH_
    - _Preservation: Non-admin users handled by authorize middleware_
    - _Requirements: 2.6_

  - [ ] 7.3 Implement MongoDB transaction for User/Employee creation (Change 1.3)
    - Wrap User.create and Employee.create in transaction session
    - Use session.commitTransaction() on success
    - Use session.abortTransaction() and rollback on any error
    - Log transaction failures with error details
    - _Bug_Condition: isBugCondition(input) where MongoDBTransaction(input) is not used_
    - _Expected_Behavior: Both User and Employee created atomically or neither_
    - _Preservation: Employee data structure and fields unchanged_
    - _Requirements: 2.7_

  - [ ] 7.4 Correct socket payload structure (Change 1.4)
    - Update employee_created event to include 'type', 'data', 'orgId', 'timestamp' fields
    - Broadcast to super_admin room for analytics update
    - Broadcast dashboard_update with orgBreakdown to super_admin
    - _Bug_Condition: isBugCondition(input) where socketPayload(input) is missing 'type' field_
    - _Expected_Behavior: Payload matches { type: 'create', data: {...}, orgId: string, timestamp: Date }_
    - _Preservation: Event types and data content preserved_
    - _Requirements: 2.2, 2.4, 2.5_

  - [ ] 7.5 Apply verifyOrgIdMatch middleware to POST route (Change 5.1)
    - Add verifyOrgIdMatch() middleware after authorize()
    - _Requirements: 2.6_

- [ ] 8. Fix utils/socketManager.js - room naming and role normalization

  - [ ] 8.1 Standardize room naming to 'tenant_${orgId}' (Change 2.1)
    - Update authenticateUser to use 'tenant_${orgId}' for organization rooms
    - Normalize role names to lowercase for role-based rooms
    - Join both 'role_${role}' and simple role room for compatibility
    - _Bug_Condition: isBugCondition(input) where socketRoomName(input.user?.orgId) is not consistent_
    - _Expected_Behavior: All organization rooms use 'tenant_' prefix consistently_
    - _Preservation: Client connection and authentication flow unchanged_
    - _Requirements: 2.2, 2.8_

  - [ ] 8.2 Update broadcastToOrganization for consistent room naming (Change 2.2)
    - Use 'tenant_' prefix for organization room broadcasts
    - Maintain backward compatibility with 'org_' prefix
    - _Bug_Condition: isBugCondition(input) where socketRoomName(input.user?.orgId) is not consistent_
    - _Expected_Behavior: broadcastToOrganization uses 'tenant_${orgId}' room_
    - _Preservation: Event delivery to existing 'org_' rooms continues_
    - _Requirements: 2.2_

  - [ ] 8.3 Update broadcastToRole for role name normalization (Change 2.3)
    - Normalize role names to lowercase before broadcasting
    - Broadcast to both 'role_${role}' and simple role room
    - _Bug_Condition: isBugCondition(input) where socketRoomName(input.user?.role) has case issues_
    - _Expected_Behavior: broadcastToRole normalizes role names to lowercase_
    - _Preservation: Event delivery to existing rooms continues_
    - _Requirements: 2.8_

- [ ] 9. Fix server.js - socket authentication and change streams

  - [ ] 9.1 Update socket authentication for consistent room naming (Change 3.1)
    - Normalize role to lowercase in socket authentication
    - Join 'tenant_${tenantId}' for organization room
    - Join 'role_${normalizedRole}' and simple role room for compatibility
    - Join 'management' room for admin/super_admin roles
    - _Bug_Condition: isBugCondition(input) where socketRoomName(input.user?.orgId) is not consistent_
    - _Expected_Behavior: Socket authentication uses consistent room naming_
    - _Preservation: Socket connection and basic authentication unchanged_
    - _Requirements: 2.2, 2.8_

  - [ ] 9.2 Add MongoDB change stream setup for real-time updates (Change 3.2)
    - Setup Employee.watch() change stream after database connection
    - Broadcast employee_created to super_admin room on insert
    - Broadcast employee_updated to organization room on update
    - Broadcast employee_deleted to super_admin room on delete
    - Handle change stream errors gracefully
    - _Bug_Condition: isBugCondition(input) where changeStreamSubscription(input.user?.orgId) is missing_
    - _Expected_Behavior: Super Admin dashboard receives real-time employee updates_
    - _Preservation: Existing socket events and authentication unchanged_
    - _Requirements: 2.3, 2.5_

- [ ] 10. Fix middleware/auth.js - add verifyOrgIdMatch middleware

  - [ ] 10.1 Add verifyOrgIdMatch middleware function (Change 4.1)
    - Create middleware that verifies admin's orgId matches target organization
    - Allow super_admin to operate across organizations
    - Return 400 if admin missing orgId
    - Return 403 if orgId mismatch
    - Set req.body.orgId from user's orgId if not provided
    - _Bug_Condition: isBugCondition(input) where RBACVerification(input.user, input.body) fails_
    - _Expected_Behavior: verifyOrgIdMatch returns 400/403 or calls next()_
    - _Preservation: Other middleware and authentication flow unchanged_
    - _Requirements: 2.6_

## Validation

- [ ] 11. Verify orgId extraction bug condition test now passes
  - **Property 1: Expected Behavior** - orgId Extraction from JWT
  - **IMPORTANT**: Re-run the SAME test from task 1 - do NOT write a new test
  - The test from task 1 encodes the expected behavior
  - Run orgId extraction exploration test from step 1
  - **EXPECTED OUTCOME**: Test PASSES (confirms orgId is correctly extracted from JWT)
  - _Requirements: 2.1_

- [ ] 12. Verify socket room naming bug condition test now passes
  - **Property 1: Expected Behavior** - Socket Room Naming Consistency
  - **IMPORTANT**: Re-run the SAME test from task 2 - do NOT write a new test
  - Run socket room naming exploration test from step 2
  - **EXPECTED OUTCOME**: Test PASSES (confirms consistent room naming)
  - _Requirements: 2.2_

- [ ] 13. Verify socket payload structure bug condition test now passes
  - **Property 1: Expected Behavior** - Socket Payload Structure
  - **IMPORTANT**: Re-run the SAME test from task 3 - do NOT write a new test
  - Run socket payload structure exploration test from step 3
  - **EXPECTED OUTCOME**: Test PASSES (confirms correct payload structure)
  - _Requirements: 2.2, 2.4_

- [ ] 14. Verify RBAC orgId verification bug condition test now passes
  - **Property 1: Expected Behavior** - RBAC orgId Verification
  - **IMPORTANT**: Re-run the SAME test from task 4 - do NOT write a new test
  - Run RBAC orgId verification exploration test from step 4
  - **EXPECTED OUTCOME**: Test PASSES (confirms orgId mismatch is rejected)
  - _Requirements: 2.6_

- [ ] 15. Verify MongoDB transaction bug condition test now passes
  - **Property 1: Expected Behavior** - MongoDB Transaction for User/Employee
  - **IMPORTANT**: Re-run the SAME test from task 5 - do NOT write a new test
  - Run MongoDB transaction exploration test from step 5
  - **EXPECTED OUTCOME**: Test PASSES (confirms atomic creation)
  - _Requirements: 2.7_

- [ ] 16. Verify preservation tests still pass
  - **Property 2: Preservation** - Non-Employee-Creation Behavior
  - **IMPORTANT**: Re-run the SAME tests from task 6 - do NOT write new tests
  - Run preservation property tests from step 6
  - **EXPECTED OUTCOME**: Tests PASS (confirms no regressions)
  - Confirm all tests still pass after fix (no regressions)
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8_

- [ ] 17. Checkpoint - Ensure all tests pass
  - Run full test suite to ensure all bug condition tests pass
  - Run full test suite to ensure all preservation tests pass
  - Verify no regressions in existing functionality
  - Ask user if questions arise before proceeding to deployment