# WorkPlus Pro - HRMS Platform Upgrade Requirements

**Project:** Full-Stack HRMS Platform Stabilization & Security Hardening  
**Status:** Phase 1 Validation Complete - Ready for Implementation  
**Date:** April 24, 2026

---

## 📋 BUSINESS REQUIREMENTS

### Core Objectives
1. **Eliminate All Mock Data** - Replace with real database integration
2. **Fix Critical Security Issues** - Implement role-based access control
3. **Stabilize Platform** - Fix broken endpoints and components
4. **Maintain Existing Features** - No breaking changes to working functionality
5. **Production Ready** - Ensure system is stable and secure

### User Roles & Permissions
- **Super Admin**: Full system access, manage admins, view all data
- **Admin**: Manage employees, expenses, leaves, attendance, documents
- **Employee**: View own data, submit expenses, request leaves, mark attendance

### Key Features to Maintain
- ✅ Employee management (CRUD)
- ✅ Expense tracking (submit, approve, reject)
- ✅ Leave management (request, approve, reject)
- ✅ Attendance tracking (check-in, check-out)
- ✅ Payroll management
- ✅ Document management
- ✅ Holiday calendar
- ✅ Real-time updates (Socket.IO)
- ✅ Dashboard analytics

---

## 🔴 CRITICAL ISSUES TO FIX

### Issue 1: Mock Data in 8 Components
**Current State:** Components use hardcoded mock data instead of API calls  
**Files Affected:** 8 frontend components  
**Impact:** Features won't work with real data  
**Solution:** Replace all mock data with API calls

**Components:**
1. `src/app/components/DocumentGenerator.tsx` - mockEmployees
2. `src/app/components/DigitalDocumentGenerator.tsx` - mockEmployees
3. `src/app/components/DocumentTracking.tsx` - mockEmployees, mockAcknowledgments
4. `src/app/components/HolidayCalendar.tsx` - mockHolidays
5. `src/app/components/EmployeeHolidayCalendar.tsx` - mockHolidays
6. `src/app/pages/employee/Dashboard.tsx` - Mock data structures
7. `src/app/pages/employee/Leave.tsx` - Mock leave balance
8. `src/app/pages/employee/Performance.tsx` - Mock performance data

### Issue 2: Missing Backend API Endpoints
**Current State:** 10+ endpoints referenced in frontend but not implemented  
**Impact:** 404 errors, broken features  
**Solution:** Implement all missing endpoints

**Missing Endpoints:**
1. `GET /api/attendance/check-in` - Check-in functionality
2. `POST /api/attendance/check-out` - Check-out functionality
3. `GET /api/employees/search` - Search employees
4. `GET /api/holidays/organization/:organizationId` - Get holidays
5. `POST /api/holidays` - Create holiday
6. `GET /api/documents/templates` - Get document templates
7. `POST /api/documents/upload` - Upload documents (needs validation)
8. `GET /api/company-documents` - Get company documents
9. `POST /api/company-documents/digital-generate` - Generate digital documents
10. `GET /api/documents/organization/:organizationId` - Get org documents

### Issue 3: No Backend Role Enforcement
**Current State:** Backend doesn't verify user role on protected endpoints  
**Impact:** SECURITY VULNERABILITY - Employees can access admin data  
**Solution:** Add role-based middleware to all protected routes

**Affected Endpoints:**
- `POST /api/documents/upload` - Should be admin-only
- `DELETE /api/documents/:documentId` - Should be admin-only
- `POST /api/holidays` - Should be admin-only
- `GET /api/company-documents` - Should be admin-only
- All admin endpoints need role enforcement

### Issue 4: Duplicate Components
**Current State:** Multiple components with identical functionality  
**Impact:** Code duplication, maintenance burden  
**Solution:** Consolidate into single reusable components

**Duplicates:**
1. `DocumentGenerator.tsx` vs `DigitalDocumentGenerator.tsx`
2. `HolidayCalendar.tsx` vs `EmployeeHolidayCalendar.tsx`
3. `Attendance.tsx` (admin) vs `Attendance.tsx` (employee)

### Issue 5: Incomplete Database Models
**Current State:** Models missing critical fields  
**Impact:** Can't store complete employee information  
**Solution:** Update models with all required fields

**Model Issues:**
- `Employee.js` - Missing: email, dateOfBirth, gender, maritalStatus
- `User.js` - Missing: tenantId, lastLogin, passwordChangedAt
- `Attendance.js` - Missing: lateBy, earlyCheckOut
- Missing: `Department.js` model
- Missing: `Announcement.js` model

---

## 🟠 HIGH PRIORITY ISSUES

### Issue 6: No File Upload Validation
**Current State:** Any file type accepted  
**Impact:** Security risk  
**Solution:** Add file type and size validation

### Issue 7: No Error Logging
**Current State:** Only console.error() used  
**Impact:** Hard to troubleshoot production issues  
**Solution:** Implement Winston logger

### Issue 8: No Token Refresh
**Current State:** JWT expires after 24 hours, no refresh mechanism  
**Impact:** Users get logged out without warning  
**Solution:** Implement token refresh endpoint

### Issue 9: No Rate Limiting
**Current State:** Auth endpoints vulnerable to brute force  
**Impact:** Security risk  
**Solution:** Add rate limiting middleware

---

## ✅ ACCEPTANCE CRITERIA

### Phase 2: Critical Fixes
- [ ] All mock data removed from components
- [ ] All components use real API calls
- [ ] All missing endpoints implemented
- [ ] All endpoints have role-based access control
- [ ] Database models updated with all required fields
- [ ] No 404 errors on API calls
- [ ] All features working with real data

### Phase 3: Security
- [ ] File upload validation implemented
- [ ] Error logging system working
- [ ] Token refresh mechanism implemented
- [ ] Rate limiting on auth endpoints
- [ ] All endpoints enforce role-based access

### Phase 4: Stability
- [ ] No console errors in browser
- [ ] No unhandled promise rejections
- [ ] All API calls have error handling
- [ ] Loading states working correctly
- [ ] Real-time updates working

### Phase 5: Production Ready
- [ ] All tests passing
- [ ] No dead code
- [ ] Clean folder structure
- [ ] Comprehensive documentation
- [ ] Ready for deployment

---

## 📊 IMPLEMENTATION PHASES

### Phase 2: Fix Critical Errors (Days 1-3)
1. Remove all mock data
2. Implement missing endpoints
3. Add role-based access control
4. Update database models
5. Fix duplicate components

### Phase 3: Security Fixes (Days 4-5)
1. Add file upload validation
2. Implement error logging
3. Add token refresh
4. Add rate limiting

### Phase 4: Frontend Stabilization (Days 6-7)
1. Fix broken API integrations
2. Fix sidebar visibility
3. Fix role-based routing
4. Remove dead code

### Phase 5: Final Polish (Days 8+)
1. Performance optimization
2. Comprehensive testing
3. Documentation
4. Deployment preparation

---

## 🎯 SUCCESS METRICS

- ✅ 100% of mock data removed
- ✅ 100% of missing endpoints implemented
- ✅ 100% of endpoints have role enforcement
- ✅ 0 console errors
- ✅ 0 unhandled promise rejections
- ✅ All features working with real data
- ✅ All tests passing
- ✅ Production ready

---

## 📝 NOTES

- Do NOT break existing working features
- Do NOT use mock data as fallback
- Do NOT skip role validation
- Keep code modular and production-ready
- Prioritize stability over speed
- All changes must be backward compatible

