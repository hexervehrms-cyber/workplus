# Roles & Permissions - Quick Test Guide

## ✅ Status
- ✅ Component created with detailed permissions
- ✅ Predefined roles implemented (Recruiter, Accountant, Manager, Sales)
- ✅ Custom role creation implemented
- ✅ Employee role assignment implemented
- ✅ Frontend hot-reloading
- ✅ No compilation errors

## 🚀 Quick Test (5 minutes)

### Step 1: Navigate to Roles Page
1. Go to http://localhost:5173
2. Login as admin
3. Click **Admin > Roles & Permissions** in sidebar
4. Or navigate directly to: http://localhost:5173/admin/roles

### Step 2: View Predefined Roles
1. ✅ You should see 4 predefined roles:
   - **Recruiter** - Employee management, salary, leaves, expenses, attendance
   - **Accountant** - Expenses, salary, payroll, taxes
   - **Manager** - Employees, leaves, expenses, attendance
   - **Sales** - Expenses only
2. Click on each role to expand
3. ✅ Should see all permissions for that role

### Step 3: Create Custom Role
1. Click **"Create Custom Role"** button
2. Enter role name: "Team Lead"
3. Enter description: "Team leadership role"
4. Select permissions:
   - ✅ View Employees
   - ✅ Add Employees
   - ✅ Edit Employees
   - ✅ Approve Leaves
   - ✅ Approve Expenses
5. Click **"Create Role"**
6. ✅ Should see success toast: "Role 'Team Lead' created successfully"
7. ✅ New role should appear in list with "Custom" badge

### Step 4: Assign Role to Employee
1. Scroll to **"Assign Roles to Employees"** section
2. Search for an employee by name
3. Click **Edit** button on employee
4. Select **"Team Lead"** role from dropdown
5. ✅ Should show "5 permissions assigned"
6. Click **"Assign Role"**
7. ✅ Should see success toast: "Role updated to team_lead"
8. ✅ Employee's role should update in list

## 🎯 Expected Behavior

### Predefined Roles
- ✅ Recruiter: 13 permissions
- ✅ Accountant: 8 permissions
- ✅ Manager: 10 permissions
- ✅ Sales: 3 permissions

### Custom Role Creation
- ✅ Can enter role name
- ✅ Can enter description
- ✅ Can select permissions by category
- ✅ Can create role with selected permissions
- ✅ New role appears in list with "Custom" badge

### Role Assignment
- ✅ Can search employees
- ✅ Can select role from dropdown
- ✅ Shows permission count
- ✅ Can assign role to employee
- ✅ Employee list updates with new role

## 📊 Permission Categories

### Employee Management (4 permissions)
- View Employees
- Add Employees
- Edit Employees
- Delete Employees

### Salary Management (4 permissions)
- View Salary
- Edit Salary
- Manage Payroll
- Manage Taxes

### Leave Management (4 permissions)
- View Leaves
- Add Leaves
- Edit Leaves
- Approve Leaves

### Expense Management (5 permissions)
- View Expenses
- Add Expenses
- Edit Expenses
- Delete Expenses
- Approve Expenses

### Attendance Management (4 permissions)
- View Attendance
- Edit Attendance
- Approve Attendance
- Delete Attendance

## 🔍 Browser Console

Open F12 and check Console tab for:
- No errors
- No warnings
- Successful API calls

## ⚠️ Possible Issues

### Issue: Page shows 404
**Solution**:
- Refresh the page (F5)
- Check if you're logged in as admin
- Verify sidebar shows "Roles & Permissions"

### Issue: Roles not loading
**Solution**:
- Check browser console (F12) for errors
- Verify backend is running on port 5000
- Check authorization token

### Issue: Can't create custom role
**Solution**:
- Verify role name is entered
- Verify at least one permission is selected
- Check browser console for errors

### Issue: Role assignment fails
**Solution**:
- Check browser console for error message
- Verify backend supports PUT endpoint
- Check authorization

## 📝 What to Test

- [ ] Page loads without errors
- [ ] All 4 predefined roles display
- [ ] Can expand roles to see permissions
- [ ] Can create custom role
- [ ] Custom role appears in list
- [ ] Can assign role to employee
- [ ] Employee list updates
- [ ] Search filters employees
- [ ] Permission count displays
- [ ] Custom role badge shows

## 🎓 Features to Verify

- ✅ Predefined roles (Recruiter, Accountant, Manager, Sales)
- ✅ Custom role creation with checkboxes
- ✅ Permission categories
- ✅ Expandable role cards
- ✅ Employee role assignment
- ✅ Search functionality
- ✅ Permission count display
- ✅ Custom role badge
- ✅ Loading states
- ✅ Error handling

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
2. Create custom roles as needed
3. Assign roles to employees
4. Verify permissions are working

---

**Status**: ✅ Ready for Testing
**Date**: May 2, 2026
**Frontend**: ✅ Running
**Backend**: ✅ Running
