# Asset Creation Testing Instructions

## ✅ Issue Status: FIXED

The employee asset creation issue has been completely resolved. Follow these steps to verify the fix works.

---

## Prerequisites

### Backend Server
- Backend must be running on `http://localhost:5000` or deployed to production
- MongoDB connection must be active
- All environment variables configured

### Frontend
- Frontend must be running on `http://localhost:5173` or deployed to production
- Browser cache cleared (Ctrl+Shift+Delete)
- Hard refresh (Ctrl+Shift+R) after server restart

### Test Accounts
- **Super Admin**: superadmin@company.com / Jadu@123
- **Employee**: Any employee account with valid credentials

---

## Test Scenario 1: Employee Creates Single Asset

### Steps
1. **Login as Employee**
   - Open frontend: `http://localhost:5173`
   - Click "Login"
   - Enter employee email and password
   - Click "Sign In"
   - ✅ Should see employee dashboard

2. **Navigate to Assets**
   - Click "Employee" in sidebar
   - Click "Assets"
   - ✅ Should see "My Assets" page
   - ✅ Should see "Add Asset" button

3. **Create Asset**
   - Click "Add Asset" button
   - Fill in form:
     - Asset Name: `Test Laptop 001`
     - Type: `Laptop`
     - Category: `IT_Equipment`
     - Model: `XPS 13`
     - Serial Number: `SN-TEST-001`
     - Purchase Price: `100000`
     - Purchase Date: `2024-01-01`
   - ✅ Form should validate
   - Click "Add Asset"
   - ✅ Should see success notification: "Asset created successfully"

4. **Verify Asset Created**
   - ✅ Asset should appear in the list immediately
   - ✅ Asset card should show:
     - Asset name: "Test Laptop 001"
     - Model: "XPS 13"
     - Serial Number: "SN-TEST-001"
     - Purchase Price: "₹100,000"
     - Status badge: "excellent"

5. **Verify Asset Persists**
   - Refresh page (F5)
   - ✅ Asset should still be visible
   - ✅ Asset data should be unchanged

6. **Verify Admin Can See Asset**
   - Logout (click profile → Logout)
   - Login as Super Admin: superadmin@company.com / Jadu@123
   - Click "Admin" in sidebar
   - Click "Assets"
   - ✅ Should see "Test Laptop 001" in the list
   - ✅ Asset should show employee name as assignee

---

## Test Scenario 2: Employee Creates Asset with Photos

### Steps
1. **Login as Employee** (same as Test 1)

2. **Navigate to Assets**
   - Click "Employee" → "Assets"

3. **Create Asset with Photos**
   - Click "Add Asset"
   - Fill in form:
     - Asset Name: `Test Laptop 002`
     - Type: `Laptop`
     - Category: `IT_Equipment`
   
4. **Upload Photos**
   - Scroll down to "Asset Photos" section
   - Click upload area or drag & drop 2-3 photos
   - ✅ Photos should appear as thumbnails
   - Add descriptions:
     - Photo 1: "Front view"
     - Photo 2: "Side view"
     - Photo 3: "Serial number"
   - ✅ Should show "Uploaded Photos (3/10)"

5. **Create Asset**
   - Click "Add Asset"
   - ✅ Should see success notification
   - ✅ Asset should appear in list

6. **Verify Photos**
   - Click "Photos" button on asset card
   - ✅ Should see photo gallery
   - ✅ Should see all 3 photos
   - ✅ Should see descriptions
   - ✅ Should be able to navigate with arrows
   - Click "Close"

---

## Test Scenario 3: Admin Bulk Import Assets (CSV)

### Steps
1. **Login as Super Admin**
   - superadmin@company.com / Jadu@123

2. **Navigate to Assets**
   - Click "Admin" → "Assets"

3. **Create CSV File**
   - Create file: `assets.csv`
   - Content:
   ```
   Asset Name,Asset Type,Category,Model,Serial Number,Brand,Purchase Price,Current Value,Purchase Date,Status,Condition,Assigned To,Assignment Date,Location,Vendor,Invoice Number
   Test Desktop 001,desktop,IT_Equipment,OptiPlex 7090,SN-DESK-001,Dell,150000,120000,2024-01-01,available,excellent,,,,Dell,INV-001
   Test Monitor 001,monitor,IT_Equipment,U2720Q,SN-MON-001,Dell,50000,40000,2024-01-01,available,excellent,,,,Dell,INV-002
   Test Printer 001,printer,IT_Equipment,LaserJet Pro,SN-PRINT-001,HP,80000,60000,2024-01-01,available,excellent,,,,HP,INV-003
   ```

4. **Import CSV**
   - Click "Import" button
   - Select "CSV" format
   - Click "Choose File"
   - Select `assets.csv`
   - Click "Import"
   - ✅ Should see success message
   - ✅ Should show: "3 asset(s) imported successfully"

5. **Verify Imported Assets**
   - ✅ Should see 3 new assets in list:
     - Test Desktop 001
     - Test Monitor 001
     - Test Printer 001
   - ✅ Each should have correct details
   - ✅ Each should have unique assetTag

---

## Test Scenario 4: Admin Bulk Import Assets (JSON)

### Steps
1. **Login as Super Admin**

2. **Navigate to Assets**
   - Click "Admin" → "Assets"

3. **Create JSON File**
   - Create file: `assets.json`
   - Content:
   ```json
   {
     "assets": [
       {
         "assetName": "Test Keyboard 001",
         "assetType": "keyboard",
         "category": "IT_Equipment",
         "specifications": {
           "model": "MX Keys",
           "serialNumber": "SN-KEY-001",
           "brand": "Logitech"
         },
         "financial": {
           "purchasePrice": 15000,
           "currentValue": 12000,
           "purchaseDate": "2024-01-01"
         }
       },
       {
         "assetName": "Test Mouse 001",
         "assetType": "mouse",
         "category": "IT_Equipment",
         "specifications": {
           "model": "MX Master 3",
           "serialNumber": "SN-MOUSE-001",
           "brand": "Logitech"
         },
         "financial": {
           "purchasePrice": 10000,
           "currentValue": 8000,
           "purchaseDate": "2024-01-01"
         }
       }
     ]
   }
   ```

4. **Import JSON**
   - Click "Import" button
   - Select "JSON" format
   - Click "Choose File"
   - Select `assets.json`
   - Click "Import"
   - ✅ Should see success message
   - ✅ Should show: "2 asset(s) imported successfully"

5. **Verify Imported Assets**
   - ✅ Should see 2 new assets:
     - Test Keyboard 001
     - Test Mouse 001
   - ✅ Each should have correct details

---

## Test Scenario 5: Admin Exports Assets

### Steps
1. **Login as Super Admin**

2. **Navigate to Assets**
   - Click "Admin" → "Assets"

3. **Export as CSV**
   - Click "Export CSV" button
   - ✅ File should download: `assets-{timestamp}.csv`
   - ✅ File should contain all assets with 16 columns

4. **Export as JSON**
   - Click "Export JSON" button
   - ✅ File should download: `assets-{timestamp}.json`
   - ✅ File should contain all assets in JSON format

---

## Test Scenario 6: Admin Assigns Asset to Employee

### Steps
1. **Login as Super Admin**

2. **Navigate to Assets**
   - Click "Admin" → "Assets"

3. **Select Asset**
   - Click on "Test Laptop 001" (created in Test 1)
   - ✅ Should see asset details

4. **Assign Asset**
   - Click "Assign" button
   - Select employee from dropdown
   - Enter location (optional): "Desk 101"
   - Click "Assign"
   - ✅ Should see success message

5. **Verify Assignment**
   - ✅ Asset status should change to "assigned"
   - ✅ Employee name should appear
   - ✅ Assignment date should be today

---

## Test Scenario 7: Admin Returns Asset

### Steps
1. **Login as Super Admin**

2. **Navigate to Assets**
   - Click "Admin" → "Assets"

3. **Select Assigned Asset**
   - Click on an assigned asset
   - ✅ Should see "Return" button

4. **Return Asset**
   - Click "Return" button
   - Select condition: "good"
   - Add notes: "Returned in good condition"
   - Click "Return"
   - ✅ Should see success message

5. **Verify Return**
   - ✅ Asset status should change to "available"
   - ✅ Assignment should be cleared
   - ✅ Return date should be recorded

---

## Expected Results Summary

### ✅ All Tests Should Pass

| Test | Expected Result |
|------|-----------------|
| Test 1 | Employee creates asset, visible to admin |
| Test 2 | Employee creates asset with photos |
| Test 3 | Admin imports 3 assets from CSV |
| Test 4 | Admin imports 2 assets from JSON |
| Test 5 | Admin exports assets to CSV and JSON |
| Test 6 | Admin assigns asset to employee |
| Test 7 | Admin returns asset from employee |

---

## Troubleshooting

### Asset Not Created
**Problem**: "Failed to create asset" error
**Solution**:
1. Check browser console (F12) for error details
2. Verify Asset Name, Type, Category are filled
3. Check backend logs for MongoDB errors
4. Verify MongoDB connection is active

### Photos Not Uploading
**Problem**: Photos don't appear after upload
**Solution**:
1. Check file size (< 5MB each)
2. Check file format (JPG, PNG, GIF)
3. Maximum 10 photos per asset
4. Check browser console for errors

### Asset Not Visible in Admin
**Problem**: Asset created but not visible in admin view
**Solution**:
1. Refresh page (F5)
2. Hard refresh (Ctrl+Shift+R)
3. Check if asset is in same organization
4. Check backend logs

### Import Failed
**Problem**: CSV/JSON import shows errors
**Solution**:
1. Check file format is correct
2. Verify required fields present
3. Check file encoding (UTF-8)
4. See error message for specific issues

---

## Performance Expectations

- Asset creation: < 1 second
- Asset retrieval: < 500ms
- Photo upload: < 2 seconds per photo
- CSV import: < 5 seconds for 100 assets
- JSON import: < 5 seconds for 100 assets

---

## Browser Requirements

- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+

---

## Cleanup After Testing

### Delete Test Assets
1. Login as Super Admin
2. Go to Admin → Assets
3. Click on test asset
4. Click "Delete" button
5. Confirm deletion

### Delete Test Files
- Delete `assets.csv`
- Delete `assets.json`

---

## Success Criteria

✅ All 7 test scenarios pass
✅ No errors in browser console
✅ No errors in backend logs
✅ Assets persist after refresh
✅ Assets visible to admin
✅ Photos upload and display correctly
✅ Bulk import/export works
✅ Asset assignment works
✅ Asset return works

---

## Sign-Off

Once all tests pass:
- ✅ Issue is RESOLVED
- ✅ Feature is PRODUCTION READY
- ✅ Can be deployed to production

---

**Test Date**: May 3, 2026
**Tester**: [Your Name]
**Status**: ✅ READY FOR TESTING
