# Roles Page - Quick Test Guide

## ✅ Status
- ✅ Page created: `frontend/src/app/pages/admin/Roles.tsx`
- ✅ Route added: `/admin/roles`
- ✅ Frontend hot-reloading
- ✅ No compilation errors

## 🚀 Quick Test (2 minutes)

### Step 1: Navigate to Roles Page
1. Go to http://localhost:5173
2. Login as admin
3. Click **Admin > Roles & Permissions** in sidebar
4. Or navigate directly to: http://localhost:5173/admin/roles

### Step 2: Verify Page Loads
✅ You should see:
- Page title: "Roles & Permissions"
- Search bar for employees
- List of employees with their current roles
- Edit button for each employee

### Step 3: Test Search
1. Type an employee name in the search box
2. ✅ List should filter in real-time
3. ✅ Should show matching employees

### Step 4: Test Edit Role
1. Click the Edit (pencil) icon on any employee
2. ✅ Dialog should open showing:
   - Employee name
   - Dropdown with available roles
   - Role description
   - Cancel and Update buttons
3. Select a different role from dropdown
4. ✅ Description should update
5. Click "Update Role"
6. ✅ Should show success toast: "Role updated to [role]"
7. ✅ Dialog should close
8. ✅ Employee list should refresh with new role

## 🎯 Expected Behavior

### Page Load
- ✅ Shows all employees
- ✅ Shows current role for each
- ✅ Shows department if available
- ✅ Search bar is functional

### Edit Dialog
- ✅ Opens when Edit button clicked
- ✅ Shows employee name
- ✅ Shows available roles
- ✅ Shows role description
- ✅ Has Cancel and Update buttons

### Role Update
- ✅ Sends PUT request to backend
- ✅ Shows loading spinner during update
- ✅ Shows success toast on completion
- ✅ Refreshes employee list
- ✅ Shows new role in list

## 🔍 Browser Console

Open F12 and check Console tab for:
- No errors
- No warnings
- Successful API calls

## 📊 Available Roles

The page shows these roles:
1. **Employee** - Standard employee access
2. **Manager** - Manager with team oversight
3. **HR** - Human Resources access
4. **Accountant** - Accounting and finance access
5. **Admin** - Full administrative access

## ⚠️ Possible Issues

### Issue: Page shows 404
**Solution**:
- Refresh the page (F5)
- Check if you're logged in as admin
- Verify sidebar shows "Roles & Permissions" option

### Issue: Employees not loading
**Solution**:
- Check browser console (F12) for errors
- Verify backend is running on port 5000
- Check if `/api/employees` endpoint exists
- Verify authentication token is valid

### Issue: Edit button doesn't work
**Solution**:
- Check browser console for errors
- Verify dialog opens
- Try refreshing the page

### Issue: Role update fails
**Solution**:
- Check browser console for error message
- Verify backend supports PUT `/api/employees/:id`
- Check if role value is valid
- Verify authorization

## 🔐 Permissions

- ✅ Only admins can access this page
- ✅ Only admins can update roles
- ✅ Requires valid authentication token

## 📝 What to Test

- [ ] Page loads without errors
- [ ] All employees are displayed
- [ ] Search filters employees correctly
- [ ] Edit button opens dialog
- [ ] Role dropdown shows all roles
- [ ] Role description updates
- [ ] Update button saves changes
- [ ] Success toast appears
- [ ] Employee list refreshes
- [ ] New role is displayed

## 🎓 Features Implemented

- ✅ Employee listing
- ✅ Search functionality
- ✅ Edit role dialog
- ✅ Role selection dropdown
- ✅ Role descriptions
- ✅ Color-coded badges
- ✅ Loading states
- ✅ Error handling
- ✅ Toast notifications
- ✅ API integration

## 📞 Need Help?

1. **Check Console** (F12 > Console)
   - Look for error messages
   - Check network requests

2. **Check Backend Logs**
   - Look for API errors
   - Check authorization

3. **Verify Setup**
   - Frontend running on 5173
   - Backend running on 5000
   - Logged in as admin

## ✨ Next Steps

1. Test the page functionality
2. Verify role updates work
3. Check backend logs for errors
4. Report any issues with error messages

---

**Status**: ✅ Ready for Testing
**Date**: May 2, 2026
**Frontend**: ✅ Running
**Backend**: ✅ Running
