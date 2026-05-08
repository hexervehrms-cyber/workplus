# Servers Running - Ready for Testing

## ✅ Backend Server
- **Status**: Running
- **Port**: 5000
- **URL**: http://localhost:5000
- **API**: http://localhost:5000/api
- **Health Check**: http://localhost:5000/health
- **Database**: MongoDB Atlas (workpluspro)
- **Terminal ID**: 86

### Backend Features
- ✅ MongoDB connected
- ✅ Super Admin seeded
- ✅ All routes loaded
- ✅ Debug logging enabled

---

## ✅ Frontend Dev Server
- **Status**: Running
- **Port**: 5173
- **URL**: http://localhost:5173
- **Terminal ID**: 71

### Frontend Features
- ✅ Vite dev server running
- ✅ Hot module replacement (HMR) enabled
- ✅ API proxy configured to http://localhost:5000

---

## 🧪 Testing Instructions

### Step 1: Open Application
1. Open browser: http://localhost:5173
2. You should see the login page

### Step 2: Login
- Email: `superadmin@company.com`
- Password: `Jadu@123`
- Click "Login"

### Step 3: Navigate to Expenses
1. After login, click "Expenses" in sidebar
2. Wait for expenses list to load

### Step 4: Test Create Expense
1. Click "Add Expense" button
2. Fill in form:
   - **Claim Title**: "Test Expense"
   - **Category**: "Travel"
   - **Amount**: "500"
   - **Date**: Today's date
3. Click "Submit Claim"
4. ✅ Expense should appear in list

### Step 5: Test Edit Expense
1. Click Edit button (pencil icon) on the expense
2. Change title to "Updated Test"
3. Change amount to "750"
4. Click "Update Claim"
5. **Check backend console** for debug output:
   ```
   === UPDATE EXPENSE DEBUG ===
   Authorization check: { isOwner: true, isAdmin: true, allowed: true }
   ✅ Authorization passed
   ✅ Expense saved successfully
   ```
6. ✅ Expense should update WITHOUT 403 error

### Step 6: Test Delete Expense
1. Click Delete button (trash icon)
2. Confirm deletion
3. **Check backend console** for debug output:
   ```
   === DELETE EXPENSE DEBUG ===
   Authorization check: { isOwner: true, isAdmin: true, allowed: true }
   ✅ Authorization passed
   ✅ Expense deleted successfully
   ```
4. ✅ Expense should be removed WITHOUT 403 error

---

## 📊 Expected Results

### ✅ Success Indicators
- Create expense works
- Edit expense works (NO 403 error)
- Delete expense works (NO 403 error)
- Backend console shows debug logs
- Frontend shows success toasts

### ❌ Error Indicators
- 403 Unauthorized on update/delete
- No debug logs in backend console
- Error toasts in frontend

---

## 🔍 Monitoring

### Backend Console
Watch for:
```
=== UPDATE EXPENSE DEBUG ===
=== DELETE EXPENSE DEBUG ===
=== GET USER EXPENSES DEBUG ===
✅ Authorization passed
✅ Expense saved successfully
```

### Frontend Console (F12)
Watch for:
```
Fetching expenses for user: <userId>
User object: { id: ..., name: ..., role: ... }
Updating expense data: { title, category, amount, date, description }
Expense updated: { _id: ..., title: ..., amount: ... }
```

### Network Tab (F12)
Watch for:
- PUT /api/expenses/:expenseId → 200 OK (not 403)
- DELETE /api/expenses/:expenseId → 200 OK (not 403)
- POST /api/expenses/upload-receipt → 201 Created

---

## 🛠️ Troubleshooting

### Issue: 403 Unauthorized on Update/Delete

**Check 1**: Backend console for debug logs
- If no logs appear, backend code might not have reloaded
- Solution: Restart backend (Ctrl+C, then npm start)

**Check 2**: Authorization check values
- `isOwner` should be `true`
- `isAdmin` should be `true` (for super_admin)
- `allowed` should be `true`

**Check 3**: Frontend console for errors
- Open DevTools (F12)
- Check Console tab for error messages
- Check Network tab for API response

### Issue: Expense not appearing after create

**Check**: Frontend console for errors
- Look for "Error submitting expense"
- Check Network tab for POST response

### Issue: Backend not showing debug logs

**Solution**: Restart backend
```bash
# In backend terminal:
Ctrl+C
npm start
```

---

## 📝 Next Steps

After successful testing:

1. **Verify all operations work**:
   - ✅ Create
   - ✅ Edit
   - ✅ Delete
   - ✅ Upload receipt
   - ✅ Download receipt

2. **Check console output**:
   - ✅ Backend shows debug logs
   - ✅ Frontend shows success messages
   - ✅ No 403 errors

3. **Commit changes**:
   ```bash
   git add .
   git commit -m "Fix: Expense CRUD operations - route ordering and API configuration"
   ```

4. **Push to GitHub**:
   ```bash
   git push origin main
   ```

5. **Deploy to production**:
   - Deploy backend to Render
   - Deploy frontend to Vercel

---

## 🚀 Server Status Summary

| Component | Status | Port | URL |
|-----------|--------|------|-----|
| Backend | ✅ Running | 5000 | http://localhost:5000 |
| Frontend | ✅ Running | 5173 | http://localhost:5173 |
| MongoDB | ✅ Connected | - | Atlas |
| API Proxy | ✅ Configured | - | /api → :5000 |

**Ready for testing!** 🎉
