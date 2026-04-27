# WorkPlus Pro - HRMS Platform Upgrade Tasks

**Project:** Full-Stack HRMS Platform Stabilization & Security Hardening  
**Status:** Ready for Implementation  
**Date:** April 24, 2026

---

## PHASE 2: FIX CRITICAL ERRORS

### 2.1 Remove Mock Data from Components
- [ ] 2.1.1 Remove mockEmployees from DocumentGenerator.tsx
- [ ] 2.1.2 Remove mockEmployees from DigitalDocumentGenerator.tsx
- [ ] 2.1.3 Remove mockEmployees & mockAcknowledgments from DocumentTracking.tsx
- [ ] 2.1.4 Remove mockHolidays from HolidayCalendar.tsx
- [ ] 2.1.5 Remove mockHolidays from EmployeeHolidayCalendar.tsx
- [ ] 2.1.6 Replace mock data with API calls in employee/Dashboard.tsx
- [ ] 2.1.7 Replace mock data with API calls in employee/Leave.tsx
- [ ] 2.1.8 Replace mock data with API calls in employee/Performance.tsx

### 2.2 Implement Missing Backend Endpoints
- [ ] 2.2.1 Create attendanceController.js with check-in/check-out logic
- [ ] 2.2.2 Implement GET /api/attendance/check-in endpoint
- [ ] 2.2.3 Implement POST /api/attendance/check-out endpoint
- [ ] 2.2.4 Implement GET /api/employees/search endpoint
- [ ] 2.2.5 Implement GET /api/holidays/organization/:orgId endpoint
- [ ] 2.2.6 Implement POST /api/holidays endpoint
- [ ] 2.2.7 Implement GET /api/documents/templates endpoint
- [ ] 2.2.8 Implement POST /api/documents/upload endpoint (with validation)
- [ ] 2.2.9 Implement GET /api/company-documents endpoint
- [ ] 2.2.10 Implement POST /api/company-documents/digital-generate endpoint

### 2.3 Add Role-Based Access Control
- [ ] 2.3.1 Create middleware/roleCheck.js with requireRole function
- [ ] 2.3.2 Add role enforcement to POST /api/documents/upload
- [ ] 2.3.3 Add role enforcement to DELETE /api/documents/:id
- [ ] 2.3.4 Add role enforcement to POST /api/holidays
- [ ] 2.3.5 Add role enforcement to PUT /api/holidays/:id
- [ ] 2.3.6 Add role enforcement to DELETE /api/holidays/:id
- [ ] 2.3.7 Add role enforcement to GET /api/company-documents
- [ ] 2.3.8 Add role enforcement to all admin endpoints
- [ ] 2.3.9 Add role enforcement to all employee endpoints
- [ ] 2.3.10 Verify all protected routes have role checks

### 2.4 Update Database Models
- [ ] 2.4.1 Update Employee.js - Add email, dateOfBirth, gender, maritalStatus fields
- [ ] 2.4.2 Update User.js - Add tenantId, lastLogin, passwordChangedAt fields
- [ ] 2.4.3 Update Attendance.js - Add lateBy, earlyCheckOut fields
- [ ] 2.4.4 Create models/Department.js with proper schema
- [ ] 2.4.5 Create models/Announcement.js with proper schema
- [ ] 2.4.6 Add indexes to all models for performance
- [ ] 2.4.7 Verify all models have timestamps
- [ ] 2.4.8 Verify all models have proper validation

### 2.5 Fix Duplicate Components
- [ ] 2.5.1 Consolidate DocumentGenerator.tsx and DigitalDocumentGenerator.tsx
- [ ] 2.5.2 Add role-based rendering to consolidated DocumentGenerator
- [ ] 2.5.3 Consolidate HolidayCalendar.tsx and EmployeeHolidayCalendar.tsx
- [ ] 2.5.4 Add role-based rendering to consolidated HolidayCalendar
- [ ] 2.5.5 Consolidate admin/Attendance.tsx and employee/Attendance.tsx
- [ ] 2.5.6 Add role-based rendering to consolidated Attendance
- [ ] 2.5.7 Remove duplicate component files
- [ ] 2.5.8 Update all imports to use consolidated components

---

## PHASE 3: SECURITY FIXES

### 3.1 Add File Upload Validation
- [ ] 3.1.1 Create middleware/fileValidator.js
- [ ] 3.1.2 Add file type whitelist (pdf, doc, docx, xls, xlsx, jpg, png)
- [ ] 3.1.3 Add file size limit (5MB)
- [ ] 3.1.4 Add virus scanning (optional)
- [ ] 3.1.5 Apply fileValidator to POST /api/documents/upload
- [ ] 3.1.6 Test file upload with valid and invalid files

### 3.2 Implement Error Logging
- [ ] 3.2.1 Install Winston logger package
- [ ] 3.2.2 Create utils/logger.js with Winston configuration
- [ ] 3.2.3 Create middleware/errorHandler.js for centralized error handling
- [ ] 3.2.4 Add error logging to all route handlers
- [ ] 3.2.5 Add request logging with Morgan
- [ ] 3.2.6 Configure log file rotation
- [ ] 3.2.7 Test error logging with sample errors

### 3.3 Implement Token Refresh
- [ ] 3.3.1 Create POST /api/auth/refresh-token endpoint
- [ ] 3.3.2 Implement refresh token generation logic
- [ ] 3.3.3 Store refresh tokens in database
- [ ] 3.3.4 Add token refresh logic to frontend
- [ ] 3.3.5 Implement automatic token refresh before expiry
- [ ] 3.3.6 Test token refresh flow

### 3.4 Add Rate Limiting
- [ ] 3.4.1 Install express-rate-limit package
- [ ] 3.4.2 Create middleware/rateLimiter.js
- [ ] 3.4.3 Apply rate limiting to POST /api/auth/login (5 requests/15 min)
- [ ] 3.4.4 Apply rate limiting to POST /api/auth/register (3 requests/hour)
- [ ] 3.4.5 Test rate limiting with multiple requests
- [ ] 3.4.6 Configure rate limit error messages

---

## PHASE 4: FRONTEND STABILIZATION

### 4.1 Fix Broken API Integrations
- [ ] 4.1.1 Update DocumentGenerator to use real API calls
- [ ] 4.1.2 Update HolidayCalendar to use real API calls
- [ ] 4.1.3 Update Attendance to use real API calls
- [ ] 4.1.4 Update Dashboard to use real API calls
- [ ] 4.1.5 Update Leave page to use real API calls
- [ ] 4.1.6 Update Performance page to use real API calls
- [ ] 4.1.7 Verify all API calls have error handling
- [ ] 4.1.8 Verify all API calls have loading states

### 4.2 Fix Sidebar Visibility
- [ ] 4.2.1 Check Sidebar.tsx for visibility issues
- [ ] 4.2.2 Verify role-based menu items display correctly
- [ ] 4.2.3 Fix any CSS issues with sidebar
- [ ] 4.2.4 Test sidebar on different screen sizes

### 4.3 Fix Role-Based Routing
- [ ] 4.3.1 Verify ProtectedRoute component works correctly
- [ ] 4.3.2 Verify role-based redirects work
- [ ] 4.3.3 Test admin can't access employee routes
- [ ] 4.3.4 Test employee can't access admin routes
- [ ] 4.3.5 Test super admin can access all routes

### 4.4 Remove Dead Code
- [ ] 4.4.1 Remove CurrencyChanger.tsx if unused
- [ ] 4.4.2 Remove FeatureShowcase.tsx if unused
- [ ] 4.4.3 Remove WelcomeBanner.tsx if unused
- [ ] 4.4.4 Remove UserInfoModal.tsx if unused
- [ ] 4.4.5 Remove unused imports from all files
- [ ] 4.4.6 Remove unused CSS classes

---

## PHASE 5: BACKEND CONTROLLERS & ROUTES

### 5.1 Create Controllers
- [ ] 5.1.1 Create controllers/authController.js
- [ ] 5.1.2 Create controllers/employeeController.js
- [ ] 5.1.3 Create controllers/attendanceController.js
- [ ] 5.1.4 Create controllers/departmentController.js
- [ ] 5.1.5 Create controllers/announcementController.js
- [ ] 5.1.6 Create controllers/documentController.js
- [ ] 5.1.7 Create controllers/holidayController.js

### 5.2 Create Routes
- [ ] 5.2.1 Create routes/auth.js
- [ ] 5.2.2 Create routes/employees.js
- [ ] 5.2.3 Create routes/attendance.js
- [ ] 5.2.4 Create routes/departments.js
- [ ] 5.2.5 Create routes/announcements.js
- [ ] 5.2.6 Create routes/documents.js
- [ ] 5.2.7 Create routes/holidays.js

### 5.3 Refactor server.js
- [ ] 5.3.1 Remove inline route handlers from server.js
- [ ] 5.3.2 Import all routes from route files
- [ ] 5.3.3 Register all routes with app.use()
- [ ] 5.3.4 Verify all endpoints still work
- [ ] 5.3.5 Clean up server.js to be modular

---

## PHASE 6: TESTING & VERIFICATION

### 6.1 Unit Tests
- [ ] 6.1.1 Test authController functions
- [ ] 6.1.2 Test employeeController functions
- [ ] 6.1.3 Test attendanceController functions
- [ ] 6.1.4 Test middleware functions
- [ ] 6.1.5 Test validation functions

### 6.2 Integration Tests
- [ ] 6.2.1 Test login flow
- [ ] 6.2.2 Test create employee flow
- [ ] 6.2.3 Test submit expense flow
- [ ] 6.2.4 Test request leave flow
- [ ] 6.2.5 Test check-in/check-out flow
- [ ] 6.2.6 Test role-based access control

### 6.3 E2E Tests
- [ ] 6.3.1 Test complete admin workflow
- [ ] 6.3.2 Test complete employee workflow
- [ ] 6.3.3 Test real-time updates
- [ ] 6.3.4 Test error handling
- [ ] 6.3.5 Test file uploads

### 6.4 Manual Testing
- [ ] 6.4.1 Test all features in browser
- [ ] 6.4.2 Test on different browsers
- [ ] 6.4.3 Test on mobile devices
- [ ] 6.4.4 Test with real data
- [ ] 6.4.5 Verify no console errors

---

## PHASE 7: DOCUMENTATION & DEPLOYMENT

### 7.1 Documentation
- [ ] 7.1.1 Update API documentation
- [ ] 7.1.2 Update database schema documentation
- [ ] 7.1.3 Update setup instructions
- [ ] 7.1.4 Create troubleshooting guide
- [ ] 7.1.5 Create deployment guide

### 7.2 Deployment Preparation
- [ ] 7.2.1 Update environment variables
- [ ] 7.2.2 Configure production database
- [ ] 7.2.3 Configure production CORS
- [ ] 7.2.4 Set up error monitoring
- [ ] 7.2.5 Set up performance monitoring

### 7.3 Final Verification
- [ ] 7.3.1 Verify all features working
- [ ] 7.3.2 Verify no console errors
- [ ] 7.3.3 Verify no unhandled rejections
- [ ] 7.3.4 Verify performance acceptable
- [ ] 7.3.5 Verify security measures in place

---

## SUMMARY

**Total Tasks:** 100+  
**Estimated Duration:** 2-3 weeks  
**Priority:** CRITICAL - Must complete before production deployment

**Key Milestones:**
- Week 1: Complete Phase 2 (Critical Fixes)
- Week 2: Complete Phase 3-4 (Security & Frontend)
- Week 3: Complete Phase 5-7 (Backend Refactor & Testing)

**Success Criteria:**
- ✅ All mock data removed
- ✅ All missing endpoints implemented
- ✅ All endpoints have role enforcement
- ✅ All tests passing
- ✅ No console errors
- ✅ Production ready

