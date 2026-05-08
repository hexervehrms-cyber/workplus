# Asset Creation - Quick Start Guide ✅

## Status: FIXED AND WORKING

The employee asset creation issue has been **completely resolved**. Employees can now create assets successfully.

---

## How to Create an Asset (Employee)

### Step 1: Login as Employee
- Email: Use any employee account
- Password: Employee password

### Step 2: Navigate to Assets
- Click on **Employee** in the sidebar
- Click on **Assets**

### Step 3: Click "Add Asset" Button
- Located in the top-right corner
- Opens the "Add New Asset" modal

### Step 4: Fill in Asset Details
**Required Fields:**
- **Asset Name**: e.g., "Dell Laptop XPS 13"
- **Type**: Select from dropdown (Laptop, Desktop, Monitor, etc.)
- **Category**: Select from dropdown (IT_Equipment, Office_Furniture, etc.)

**Optional Fields:**
- Model: e.g., "XPS 13"
- Serial Number: e.g., "SN123456"
- Purchase Price: e.g., "100000"
- Purchase Date: Select date

### Step 5: Add Photos (Optional)
- Click on the upload area or drag & drop photos
- Add descriptions to each photo
- Maximum 10 photos per asset

### Step 6: Click "Add Asset"
- Asset is created immediately
- Photos are uploaded automatically
- Success notification appears

### Step 7: Verify Asset
- Asset appears in your assets list
- Refresh page - asset persists
- Login as admin - asset visible in Admin → Assets

---

## How to View Assets (Employee)

### View Your Assets
1. Go to **Employee → Assets**
2. See all assets assigned to you
3. View total count and total value

### View Asset Details
1. Click on any asset card
2. See all specifications and financial info
3. Click "Photos" button to view all photos

### View Asset Photos
1. Click "Photos" button on asset card
2. See full-screen gallery
3. Navigate with arrow buttons
4. View photo descriptions

---

## How to Create Assets (Admin)

### Create Single Asset
1. Go to **Admin → Assets**
2. Click "Add Asset" button
3. Fill in all details
4. Upload photos
5. Click "Add Asset"

### Bulk Import Assets

#### Import from CSV
1. Go to **Admin → Assets**
2. Click "Import" button
3. Select "CSV" format
4. Upload CSV file
5. Click "Import"

**CSV Format** (16 columns):
```
Asset Name,Asset Type,Category,Model,Serial Number,Brand,Purchase Price,Current Value,Purchase Date,Status,Condition,Assigned To,Assignment Date,Location,Vendor,Invoice Number
Dell Laptop,laptop,IT_Equipment,XPS 13,SN123456,Dell,100000,80000,2024-01-01,available,excellent,,,,Dell,INV-001
```

#### Import from JSON
1. Go to **Admin → Assets**
2. Click "Import" button
3. Select "JSON" format
4. Upload JSON file
5. Click "Import"

**JSON Format**:
```json
{
  "assets": [
    {
      "assetName": "Dell Laptop",
      "assetType": "laptop",
      "category": "IT_Equipment",
      "specifications": {
        "model": "XPS 13",
        "serialNumber": "SN123456",
        "brand": "Dell"
      },
      "financial": {
        "purchasePrice": 100000,
        "currentValue": 80000,
        "purchaseDate": "2024-01-01"
      }
    }
  ]
}
```

### Export Assets

#### Export as CSV
1. Go to **Admin → Assets**
2. Click "Export CSV" button
3. File downloads automatically

#### Export as JSON
1. Go to **Admin → Assets**
2. Click "Export JSON" button
3. File downloads automatically

---

## Assign Assets to Employees (Admin)

1. Go to **Admin → Assets**
2. Click on an asset
3. Click "Assign" button
4. Select employee
5. Enter location (optional)
6. Click "Assign"

---

## Return Assets (Admin)

1. Go to **Admin → Assets**
2. Click on an assigned asset
3. Click "Return" button
4. Select condition
5. Add notes (optional)
6. Click "Return"

---

## Asset Status Meanings

| Status | Meaning |
|--------|---------|
| **available** | Not assigned to anyone |
| **assigned** | Assigned to an employee |
| **in_use** | Currently being used |
| **maintenance** | Under maintenance |
| **repair** | Being repaired |
| **retired** | No longer in use |
| **lost** | Lost or missing |
| **stolen** | Stolen |

---

## Asset Condition Meanings

| Condition | Meaning |
|-----------|---------|
| **excellent** | Like new, no issues |
| **good** | Minor wear, fully functional |
| **fair** | Noticeable wear, functional |
| **poor** | Significant wear, limited function |
| **damaged** | Broken or severely damaged |

---

## Troubleshooting

### Asset Not Created
- ✅ Check that Asset Name, Type, and Category are filled
- ✅ Check browser console for errors (F12)
- ✅ Verify you're logged in
- ✅ Try refreshing the page

### Photos Not Uploading
- ✅ Check file size (should be < 5MB each)
- ✅ Check file format (JPG, PNG, GIF supported)
- ✅ Maximum 10 photos per asset
- ✅ Try uploading one photo at a time

### Asset Not Visible in Admin View
- ✅ Refresh the page
- ✅ Check if asset is in the same organization
- ✅ Check if asset is marked as active

### Import Failed
- ✅ Check CSV/JSON format is correct
- ✅ Verify required fields are present
- ✅ Check file encoding (UTF-8)
- ✅ See error message for specific issues

---

## Key Features

✅ **Employee Asset Creation**: Employees can create their own assets
✅ **Photo Upload**: Up to 10 photos per asset with descriptions
✅ **Bulk Import**: Import multiple assets from CSV or JSON
✅ **Bulk Export**: Export all assets to CSV or JSON
✅ **Asset Assignment**: Assign assets to employees
✅ **Asset Return**: Track asset returns and conditions
✅ **Asset History**: View complete assignment history
✅ **FNF Integration**: Assets automatically deducted from FNF settlement

---

## API Endpoints (For Developers)

### Create Asset
```
POST /api/assets
Authorization: Bearer {token}
Content-Type: application/json

{
  "assetName": "Dell Laptop",
  "assetType": "laptop",
  "category": "IT_Equipment",
  "specifications": { ... },
  "financial": { ... }
}
```

### Get All Assets
```
GET /api/assets
Authorization: Bearer {token}
```

### Get Employee Assets
```
GET /api/assets/employee/{employeeId}
Authorization: Bearer {token}
```

### Upload Photos
```
POST /api/assets/{assetId}/photos
Authorization: Bearer {token}
Content-Type: application/json

{
  "photos": [
    {
      "photoData": "data:image/jpeg;base64,...",
      "fileName": "photo.jpg",
      "description": "Front view"
    }
  ]
}
```

### Import CSV
```
POST /api/assets/import/csv
Authorization: Bearer {token}
Content-Type: application/json

{
  "csvData": "Asset Name,Asset Type,..."
}
```

### Export CSV
```
GET /api/assets/export/csv
Authorization: Bearer {token}
```

---

## Support

For issues or questions:
1. Check the troubleshooting section above
2. Review browser console (F12) for error messages
3. Check backend logs for detailed errors
4. Contact system administrator

---

**Last Updated**: May 3, 2026
**Status**: ✅ Production Ready
**Version**: 1.0.0
