# Testing Expense CRUD Operations - Step by Step

## Prerequisites
- Backend running on `http://localhost:5000`
- Frontend running on `http://localhost:5173` (or your dev server)
- Super Admin credentials: `superadmin@company.com` / `Jadu@123`

## Step 1: Start Backend Server

```bash
cd backend
npm start
# or
node server.js
```

Expected output:
```
Server running on port 5000
Connected to MongoDB
```

## Step 2: Start Frontend Dev Server

```bash
cd frontend
npm run dev
```

Expected output:
```
VITE v5.x.x  ready in xxx ms

➜  Local:   http://localhost:5173/
```

## Step 3: Login to Application

1. Open browser: `http://localhost:5173`
2. Navigate to login page
3. Enter credentials:
   - Email: `superadmin@company.com`
   - Password: `Jadu@123`
4. Click "Login"

Expected:
- ✅ Redirected to `/employee` dashboard
- ✅ User profile shows "Super Admin"
- ✅ No errors in browser console

## Step 4: Navigate to Expenses Section

1. Click on "Expenses" in sidebar
2. Wait for expenses list to load

Expected:
- ✅ Expenses page loads
- ✅ Summary cards show (Pending, Approved, Total)
- ✅ Expense Claims table appears (may be empty)
- ✅ "Add Expense" button is visible

## Step 5: Create First Expense

1. Click "Add Expense" button
2. Fill in form:
   - **Claim Title**: "Client Meeting Lunch"
   - **Category**: "Food"
   - **Amount**: "500"
   - **Date**: Today's date
   - **Description**: "Team lunch with client"
   - **Receipt**: Leave empty (optional)
3. Click "Submit Claim"

Expected:
- ✅ Toast notification: "Expense submitted successfully"
- ✅ Dialog closes
- ✅ Expense appears in list with:
  - Title: "Client Meeting Lunch"
  - Category: "Food"
  - Amount: "₹500.00"
  - Status: "Pending" (yellow badge)
  - Edit button (pencil icon)
  - Delete button (trash icon)

**Backend Console Should Show**:
```
=== CREATE EXPENSE DEBUG ===
Expense created: {
  _id: <ObjectId>,
  userId: <ObjectId>,
  title: "Client Meeting Lunch",
  amount: 500,
  status: "pending"
}
```

## Step 6: Edit the Expense

1. Click Edit button (pencil icon) on the expense
2. Dialog opens with title "Edit Expense"
3. Form is populated with existing data:
   - Title: "Client Meeting Lunch"
   - Category: "Food"
   - Amount: "500"
4. Change values:
   - **Title**: "Client Meeting Lunch - Updated"
   - **Amount**: "750"
5. Click "Update Claim"

Expected:
- ✅ Toast notification: "Expense updated successfully"
- ✅ Dialog closes
- ✅ Expense list updates with new values:
  - Title: "Client Meeting Lunch - Updated"
  - Amount: "₹750.00"
- ✅ NO "Unauthorized access" error

**Backend Console Should Show**:
```
=== UPDATE EXPENSE DEBUG ===
Authorization check: {
  expenseUserIdStr: "<ObjectId>",
  reqUserIdStr: "<ObjectId>",
  isOwner: true,
  userRole: "super_admin",
  isAdmin: true,
  allowed: true
}
✅ Authorization passed
✅ Expense saved successfully
```

## Step 7: Create Second Expense

1. Click "Add Expense" button
2. Fill in form:
   - **Claim Title**: "Office Supplies"
   - **Category**: "Office"
   - **Amount**: "1200"
   - **Date**: Today's date
3. Click "Submit Claim"

Expected:
- ✅ New expense appears in list
- ✅ Now have 2 expenses in the list

## Step 8: Delete an Expense

1. Click Delete button (trash icon) on "Office Supplies" expense
2. Confirmation dialog appears: "Are you sure you want to delete this expense?"
3. Click "OK" to confirm

Expected:
- ✅ Toast notification: "Expense deleted successfully"
- ✅ Expense is removed from list
- ✅ Only 1 expense remains
- ✅ NO "Unauthorized access" error

**Backend Console Should Show**:
```
=== DELETE EXPENSE DEBUG ===
Authorization check: {
  expenseUserIdStr: "<ObjectId>",
  reqUserIdStr: "<ObjectId>",
  isOwner: true,
  userRole: "super_admin",
  isAdmin: true,
  allowed: true
}
✅ Authorization passed
✅ Expense deleted successfully
```

## Step 9: Test with Receipt Upload

1. Click "Add Expense" button
2. Fill in form:
   - **Claim Title**: "Travel Expense"
   - **Category**: "Travel"
   - **Amount**: "2500"
   - **Date**: Today's date
3. Click on receipt upload area
4. Select a PDF or image file from your computer
5. File name should appear in upload area
6. Click "Submit Claim"

Expected:
- ✅ Receipt uploads successfully
- ✅ Expense appears in list with "Receipt" badge
- ✅ Download button appears next to the expense

## Step 10: Test Download Receipt

1. Find expense with receipt (has "Receipt" badge)
2. Click Download button (download icon)

Expected:
- ✅ File downloads to your computer
- ✅ Filename format: `<expense-title>-receipt.<ext>`

## Step 11: Test Filters

1. Create 3-4 expenses with different categories and statuses
2. Use Category filter: Select "Travel"
3. Use Status filter: Select "Pending"

Expected:
- ✅ List filters correctly
- ✅ Only matching expenses appear

## Step 12: Test with Employee Account

1. Create a new employee user (if available)
2. Login with employee credentials
3. Create an expense
4. Try to edit it
5. Try to delete it

Expected:
- ✅ Employee can create expense
- ✅ Employee can edit their own pending expense
- ✅ Employee can delete their own pending expense
- ✅ Employee CANNOT edit/delete other employees' expenses

## Troubleshooting

### Issue: "Unauthorized access" error on update/delete

**Check**:
1. Backend console for authorization debug logs
2. Verify `isOwner` is `true` or `isAdmin` is `true`
3. Check that `expenseUserIdStr === reqUserIdStr`

**Solution**:
- Clear browser cache: `Ctrl+Shift+Delete`
- Logout and login again
- Restart backend server

### Issue: Expense not appearing in list after creation

**Check**:
1. Browser console for errors
2. Backend console for creation errors
3. Network tab in DevTools (check API response)

**Solution**:
- Verify title field is filled in
- Check that amount is a valid number
- Ensure category is selected

### Issue: Edit button not appearing

**Check**:
1. Expense status is "pending" (not "approved" or "rejected")
2. You are the owner of the expense

**Expected Behavior**:
- Edit/Delete buttons only appear for pending expenses
- Approved/rejected expenses are read-only

### Issue: Receipt upload fails

**Check**:
1. File size is less than 10MB
2. File type is PDF, PNG, or JPG
3. Network connection is stable

**Solution**:
- Try with a smaller file
- Try with a different file format
- Check backend logs for upload errors

## Success Criteria

All of the following should work without errors:

- ✅ Create expense with title, category, amount, date
- ✅ Edit pending expense (title, amount, category)
- ✅ Delete pending expense
- ✅ Upload receipt (optional)
- ✅ Download receipt
- ✅ Filter by category and status
- ✅ Approved/rejected expenses are read-only
- ✅ Employee can only edit/delete their own expenses
- ✅ Admin can edit/delete any expense
- ✅ No "Unauthorized access" errors on update/delete

## Backend Debug Output

When testing, you should see console output like:

```
=== CREATE EXPENSE DEBUG ===
Expense created: { _id: ..., userId: ..., title: "...", amount: ..., status: "pending" }

=== UPDATE EXPENSE DEBUG ===
Authorization check: { isOwner: true, isAdmin: true, allowed: true }
✅ Authorization passed
✅ Expense saved successfully

=== DELETE EXPENSE DEBUG ===
Authorization check: { isOwner: true, isAdmin: true, allowed: true }
✅ Authorization passed
✅ Expense deleted successfully

=== GET USER EXPENSES DEBUG ===
✅ Expenses found: 3
```

If you see `❌` messages, there's an issue that needs to be debugged.

## Next Steps

After successful testing:

1. Commit changes to git
2. Push to GitHub
3. Deploy to Render (backend) and Vercel (frontend)
4. Test on production URLs
5. Monitor logs for any issues
