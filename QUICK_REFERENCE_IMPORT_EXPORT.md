# Quick Reference - Import/Export & Employee Add Asset

## 🚀 Quick Start

### Export Assets (Admin/HR)
1. Go to **Admin Dashboard** → **Assets**
2. Click **"Export CSV"** or **"Export JSON"**
3. File downloads automatically

### Import Assets (Admin/HR)
1. Go to **Admin Dashboard** → **Assets**
2. Click **"Import"**
3. Select format (CSV or JSON)
4. Upload file
5. Click **"Import"**

### Add Asset (Employee)
1. Go to **Employee Dashboard** → **My Assets**
2. Click **"Add Asset"**
3. Fill in details
4. Click **"Add Asset"**

---

## 📋 CSV Format

### Headers (Copy & Paste)
```
Asset Name,Asset Type,Category,Model,Serial Number,Brand,Purchase Price,Current Value,Purchase Date,Status,Condition,Assigned To,Assignment Date,Location,Vendor,Invoice Number
```

### Example Row
```
Dell Laptop,laptop,IT_Equipment,XPS 13,SN123456,Dell,75000,75000,2026-05-03,available,excellent,,,,Dell,INV-001
```

### Valid Values
- **Asset Type**: laptop, desktop, monitor, keyboard, mouse, headset, mobile_phone, tablet, printer, scanner, projector, camera, software_license, access_card, vehicle, furniture, equipment, other
- **Category**: IT_Equipment, Office_Furniture, Vehicle, Software, Security, Other
- **Status**: available, assigned, in_use, maintenance, repair, retired, lost, stolen
- **Condition**: excellent, good, fair, poor, damaged

---

## 📄 JSON Format

### Template
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
        "purchasePrice": 75000,
        "currentValue": 75000,
        "purchaseDate": "2026-05-03",
        "vendor": "Dell",
        "invoiceNumber": "INV-001"
      },
      "status": "available",
      "condition": "excellent"
    }
  ]
}
```

---

## ✅ Required Fields

### CSV Import
- Asset Name ✓
- Asset Type ✓
- Category ✓

### JSON Import
- assetName ✓
- assetType ✓
- category ✓

### Employee Add Asset
- Asset Name ✓
- Asset Type ✓
- Category ✓

---

## 🔧 Troubleshooting

### Export Not Working
- Ensure you have Admin/HR role
- Check that assets exist in system
- Try refreshing page

### Import Fails
- Check CSV headers match exactly
- Verify required fields are present
- Check Asset Type and Category are valid
- Look at error messages for specific rows

### Employee Can't Add Asset
- Ensure you're logged in as employee
- Check that "Add Asset" button is visible
- Fill in all required fields
- Check for validation errors

---

## 📊 Bulk Operations

### Export All Assets
- **CSV**: Includes 16 columns of asset data
- **JSON**: Includes metadata and complete asset objects

### Import Multiple Assets
- **CSV**: One asset per row
- **JSON**: Array of asset objects
- **Limit**: No hard limit, but recommended < 1000 per import

### Error Handling
- Partial imports allowed (successful rows imported, failed rows reported)
- Error messages show which rows/assets failed
- Summary shows successful/failed counts

---

## 🎯 Common Tasks

### Task: Backup All Assets
```
1. Click "Export CSV" or "Export JSON"
2. Save file to backup location
3. Done!
```

### Task: Migrate Assets from Another System
```
1. Export from other system as CSV
2. Adjust headers to match our format
3. Click "Import" in Admin Assets
4. Select CSV file
5. Click "Import"
6. Review results
```

### Task: Add Single Asset as Employee
```
1. Click "Add Asset" in My Assets
2. Fill in details
3. Click "Add Asset"
4. Asset appears in list
```

### Task: Bulk Add Assets as Admin
```
1. Prepare CSV file with assets
2. Click "Import" in Admin Assets
3. Select CSV format
4. Upload file
5. Click "Import"
6. All assets created
```

---

## 📱 File Naming

### Exports
- **CSV**: `assets-2026-05-03.csv`
- **JSON**: `assets-2026-05-03.json`

### Imports
- Any filename works
- Recommended: Keep original name for tracking

---

## 🔐 Permissions

| Action | Admin | HR | Employee |
|--------|-------|----|----|
| Export CSV | ✅ | ✅ | ❌ |
| Export JSON | ✅ | ✅ | ❌ |
| Import CSV | ✅ | ✅ | ❌ |
| Import JSON | ✅ | ✅ | ❌ |
| Add Asset | ✅ | ✅ | ✅ |

---

## 💡 Tips

1. **Always backup** before bulk import
2. **Test with small file** first
3. **Check error messages** carefully
4. **Use CSV for spreadsheets**, JSON for APIs
5. **Validate data** before importing
6. **Keep export files** for audit trail

---

## 🆘 Support

### For Export Issues
- Check Admin/HR role
- Verify assets exist
- Try different format

### For Import Issues
- Check file format
- Verify headers/structure
- Check required fields
- Review error messages

### For Employee Add Asset Issues
- Check login status
- Verify required fields
- Check for validation errors
- Try refreshing page

---

**Last Updated**: May 3, 2026
**Version**: 1.0.0
