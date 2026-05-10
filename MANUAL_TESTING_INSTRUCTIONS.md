# WorkPlus Pro - Manual Testing Instructions

## Current Status
✅ **Backend Deployment**: SUCCESS - https://workplus-backend-sg3a.onrender.com
✅ **Frontend Deployment**: SUCCESS - https://workplus-qbshegha8-hexervehrms-8667s-projects.vercel.app
✅ **Database**: Connected and healthy
⚠️ **Authentication**: Rate-limited due to API testing (15-minute cooldown)

## Login Credentials
- **Email**: `superadmin@company.com`
- **Password**: `Admin123!SecurePassword`
- **Role**: Super Admin

## Manual Testing Steps

### 1. Test Frontend Login
1. Open https://workplus-qbshegha8-hexervehrms-8667s-projects.vercel.app
2. Enter credentials: `superadmin@company.com` / `Admin123!SecurePassword`
3. Click Login

### 2. Test Admin Dashboard Sections
Once logged in, test each section:

#### 📊 Dashboard Overview
- View overall statistics
- Check today's attendance
- View activity feed

#### 👥 Employee Management
- Navigate to Employees section
- View employee list
- Test employee search/filter
- Check employee details
- View department breakdown

#### ⏰ Attendance Management
- Navigate to Attendance section
- View attendance records
- Check attendance statistics
- Test attendance history
- Verify check-in/check-out functionality

#### 🏖️ Leave Management
- Navigate to Leave Requests section
- View all leave requests
- Test leave request approval/rejection
- Check leave statistics
- View leave balance
- Test leave type settings

#### 💰 Expense Management
- Navigate to Expenses section
- View expense records
- Test expense approval/rejection
- Check expense statistics
- View expense categories

#### 💵 Payroll Management
- Navigate to Payroll section
- View payslips
- Check salary information
- Test advance/loan requests
- View payroll reports

#### 📄 Document Management
- Navigate to Documents section
- View company documents
- Test document upload
- Check document approval workflow
- View my documents

#### 📅 Holiday Management
- Navigate to Holidays section
- View holiday calendar
- Test holiday creation/editing
- Check upcoming holidays

#### 👤 User & Role Management
- Navigate to Users section
- View user list
- Test role assignment
- Check user permissions

#### 🏢 Organization Management
- Navigate to Organization settings
- View organization details
- Test organization settings updates

#### 📢 Announcements
- Navigate to Announcements section
- View announcements
- Test announcement creation
- Check announcement visibility

#### ✅ Tasks
- Navigate to Tasks section
- View task list
- Test task creation/assignment
- Check task status updates

### 3. Test Role Switching
1. Click the role switcher in the top-right corner
2. Switch from Super Admin to Admin
3. Verify Admin dashboard view
4. Switch to Employee role
5. Verify Employee dashboard view
6. Test role-specific permissions

### 4. Test Employee Dashboard (as Employee role)
After switching to Employee role:
- View employee-specific statistics
- Check personal attendance
- View leave balance
- Submit leave request
- View personal expenses
- Check payslips
- View assigned tasks

### 5. Test Communication Features
- Navigate to Chat section
- Test message sending
- Check Teams integration status
- View conversation history

### 6. Test Sales Module (if applicable)
- Navigate to Sales section
- View sales calls
- Check leads and deals
- View performance metrics
- Check revenue reports

## Expected Results
- All sections should load without errors
- Data should display correctly
- CRUD operations should work
- Role permissions should be enforced
- Role switching should work smoothly

## Known Issues
- API rate limiting may affect automated tests
- Some endpoints may return empty data if no test data exists
- Document upload may require valid file types

## Troubleshooting
If login fails:
1. Wait 15 minutes for rate limit to reset
2. Clear browser cache and cookies
3. Try incognito/private browsing mode
4. Check browser console for errors

If sections don't load:
1. Check browser console for errors
2. Verify backend is running: https://workplus-backend-sg3a.onrender.com/api/health
3. Check network tab in browser dev tools
4. Verify CORS settings

## Automated Testing
To run automated tests after rate limit expires:
```bash
# Test login
node test-after-rate-limit.js

# Full dashboard test
node test-dashboard-functions.js

# Comprehensive endpoint test
node test-all-endpoints.js
```

## Contact
If you encounter any issues, check:
- Backend logs in Render dashboard
- Frontend deployment in Vercel dashboard
- Browser console for client-side errors
