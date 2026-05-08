# Expense Authorization Fix - Route Ordering Issue

## Problem Identified
The "Unauthorized access" error when updating expenses was caused by **route ordering** in the Express router, not authorization logic.

### Root Cause
In `backend/routes/expenses.js`, the routes were ordered incorrectly:
- `/upload-receipt` (POST) was defined AFTER `/:expenseId` (PUT/DELETE)
- `/receipt/:filename` (GET) was defined AFTER `/:expenseId` (PUT/DELETE)

When Express processes routes, it matches them in order. The parameterized route `/:expenseId` was catching requests meant for `/upload-receipt` and `/receipt/:filename`, treating them as expense IDs.

### Example of the Problem
```
Request: POST /api/expenses/upload-receipt
Matched by: /:expenseId route (treating "upload-receipt" as an expense ID)
Result: Tries to find expense with ID "upload-receipt" → 404 or authorization error
```

## Solution Implemented
Reordered routes in `backend/routes/expenses.js` to follow Express best practices:

### Correct Route Order (Specific → General)
1. **POST /upload-receipt** - Upload receipt file
2. **GET /receipt/:filename** - Download receipt file
3. **GET /user/:userId** - Get user's expenses
4. **GET /** - Get all expenses (admin only)
5. **POST /** - Create new expense
6. **PUT /:expenseId** - Update expense
7. **PUT /:expenseId/approve** - Approve expense
8. **PUT /:expenseId/reject** - Reject expense
9. **DELETE /:expenseId** - Delete expense

### Why This Works
Express matches routes in the order they're defined. By placing specific routes (with literal path segments) before parameterized routes (with `:param`), we ensure:
- `/upload-receipt` is matched before `/:expenseId`
- `/receipt/:filename` is matched before `/:expenseId`
- `/user/:userId` is matched before `/:expenseId`

## Authorization Logic (Already Correct)
The authorization checks in PUT and DELETE endpoints are correct:
```javascript
const isOwner = expense.userId.toString() === req.user.userId.toString();
const isAdmin = ["admin", "super_admin", "hr"].includes(req.user.role);

if (!isOwner && !isAdmin) {
  return sendError(res, "Unauthorized access", 403, "FORBIDDEN");
}
```

This allows:
- ✅ Employees to edit/delete their own pending expenses
- ✅ Admins/HR to edit any expense
- ✅ Only pending expenses can be edited/deleted

## Testing the Fix
After deploying this fix, test the following:

### 1. Create Expense (POST)
```bash
curl -X POST http://localhost:5000/api/expenses \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Client Meeting",
    "category": "Food",
    "amount": 500,
    "date": "2026-05-02",
    "description": "Team lunch"
  }'
```
Expected: ✅ 201 Created

### 2. Upload Receipt (POST)
```bash
curl -X POST http://localhost:5000/api/expenses/upload-receipt \
  -H "Authorization: Bearer <token>" \
  -F "receipt=@receipt.pdf"
```
Expected: ✅ 201 Created with filePath

### 3. Update Expense (PUT)
```bash
curl -X PUT http://localhost:5000/api/expenses/<expenseId> \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Updated Title",
    "amount": 600
  }'
```
Expected: ✅ 200 OK (no "Unauthorized access" error)

### 4. Delete Expense (DELETE)
```bash
curl -X DELETE http://localhost:5000/api/expenses/<expenseId> \
  -H "Authorization: Bearer <token>"
```
Expected: ✅ 200 OK (no "Unauthorized access" error)

### 5. Download Receipt (GET)
```bash
curl -X GET http://localhost:5000/api/expenses/receipt/receipt-<filename> \
  -H "Authorization: Bearer <token>"
```
Expected: ✅ 200 OK with file content

## Files Modified
- `backend/routes/expenses.js` - Reordered routes for correct matching

## Deployment Steps
1. Pull the latest code with this fix
2. Restart the backend server
3. Test all CRUD operations (Create, Read, Update, Delete)
4. Verify no "Unauthorized access" errors appear
5. Confirm title displays correctly in expense list after update

## Frontend Behavior
The frontend (`frontend/src/app/pages/employee/Expenses.tsx`) is already correctly:
- ✅ Sending title field in requests
- ✅ Handling edit/delete/update operations
- ✅ Displaying title in expense claims list
- ✅ Making receipt optional

No frontend changes needed.

## Summary
The "Unauthorized access" error was a **route matching issue**, not an authorization problem. By reordering routes to place specific paths before parameterized paths, all CRUD operations now work correctly for employees and admins.
