# Import/Export Examples

## CSV Export Example

### File: assets-2026-05-03.csv

```csv
Asset Name,Asset Type,Category,Model,Serial Number,Brand,Purchase Price,Current Value,Purchase Date,Status,Condition,Assigned To,Assignment Date,Location,Vendor,Invoice Number
Dell Laptop,laptop,IT_Equipment,XPS 13,SN123456,Dell,75000,75000,2026-05-03,available,excellent,,,,Dell,INV-001
HP Monitor,monitor,IT_Equipment,24 inch,SN789012,HP,15000,15000,2026-05-03,available,excellent,,,,HP,INV-002
Lenovo Desktop,desktop,IT_Equipment,ThinkCentre,SN345678,Lenovo,50000,50000,2026-05-03,assigned,good,John Doe,2026-05-03,Desk 5,Lenovo,INV-003
Apple iPad,tablet,IT_Equipment,iPad Pro,SN901234,Apple,60000,60000,2026-05-03,assigned,excellent,Jane Smith,2026-05-03,Conference Room,Apple,INV-004
Samsung Phone,mobile_phone,IT_Equipment,Galaxy S21,SN567890,Samsung,40000,40000,2026-05-03,available,excellent,,,,Samsung,INV-005
Canon Printer,printer,IT_Equipment,imagePRESS,SN234567,Canon,200000,200000,2026-05-03,available,good,,,,Canon,INV-006
Cisco Router,equipment,IT_Equipment,Catalyst 9300,SN678901,Cisco,150000,150000,2026-05-03,available,excellent,,,,Cisco,INV-007
Office Chair,furniture,Office_Furniture,Ergonomic,SN012345,Herman Miller,25000,25000,2026-05-03,assigned,good,Bob Johnson,2026-05-03,Office 1,Herman Miller,INV-008
Standing Desk,furniture,Office_Furniture,Electric,SN345678,Flexispot,35000,35000,2026-05-03,available,excellent,,,,Flexispot,INV-009
Toyota Camry,vehicle,Vehicle,2023,SN789012,Toyota,2500000,2500000,2026-05-03,assigned,excellent,Alice Brown,2026-05-03,Parking Lot,Toyota,INV-010
```

## JSON Export Example

### File: assets-2026-05-03.json

```json
{
  "exportDate": "2026-05-03T10:30:00.000Z",
  "organizationId": "org-123456",
  "totalAssets": 10,
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
        "purchaseDate": "2026-05-03T00:00:00.000Z",
        "vendor": "Dell",
        "invoiceNumber": "INV-001"
      },
      "status": "available",
      "condition": "excellent",
      "assignment": {
        "assignedTo": null,
        "assignmentDate": null,
        "location": null
      }
    },
    {
      "assetName": "HP Monitor",
      "assetType": "monitor",
      "category": "IT_Equipment",
      "specifications": {
        "model": "24 inch",
        "serialNumber": "SN789012",
        "brand": "HP"
      },
      "financial": {
        "purchasePrice": 15000,
        "currentValue": 15000,
        "purchaseDate": "2026-05-03T00:00:00.000Z",
        "vendor": "HP",
        "invoiceNumber": "INV-002"
      },
      "status": "available",
      "condition": "excellent",
      "assignment": {
        "assignedTo": null,
        "assignmentDate": null,
        "location": null
      }
    },
    {
      "assetName": "Lenovo Desktop",
      "assetType": "desktop",
      "category": "IT_Equipment",
      "specifications": {
        "model": "ThinkCentre",
        "serialNumber": "SN345678",
        "brand": "Lenovo"
      },
      "financial": {
        "purchasePrice": 50000,
        "currentValue": 50000,
        "purchaseDate": "2026-05-03T00:00:00.000Z",
        "vendor": "Lenovo",
        "invoiceNumber": "INV-003"
      },
      "status": "assigned",
      "condition": "good",
      "assignment": {
        "assignedTo": "John Doe",
        "assignmentDate": "2026-05-03T00:00:00.000Z",
        "location": "Desk 5"
      }
    },
    {
      "assetName": "Apple iPad",
      "assetType": "tablet",
      "category": "IT_Equipment",
      "specifications": {
        "model": "iPad Pro",
        "serialNumber": "SN901234",
        "brand": "Apple"
      },
      "financial": {
        "purchasePrice": 60000,
        "currentValue": 60000,
        "purchaseDate": "2026-05-03T00:00:00.000Z",
        "vendor": "Apple",
        "invoiceNumber": "INV-004"
      },
      "status": "assigned",
      "condition": "excellent",
      "assignment": {
        "assignedTo": "Jane Smith",
        "assignmentDate": "2026-05-03T00:00:00.000Z",
        "location": "Conference Room"
      }
    },
    {
      "assetName": "Samsung Phone",
      "assetType": "mobile_phone",
      "category": "IT_Equipment",
      "specifications": {
        "model": "Galaxy S21",
        "serialNumber": "SN567890",
        "brand": "Samsung"
      },
      "financial": {
        "purchasePrice": 40000,
        "currentValue": 40000,
        "purchaseDate": "2026-05-03T00:00:00.000Z",
        "vendor": "Samsung",
        "invoiceNumber": "INV-005"
      },
      "status": "available",
      "condition": "excellent",
      "assignment": {
        "assignedTo": null,
        "assignmentDate": null,
        "location": null
      }
    },
    {
      "assetName": "Canon Printer",
      "assetType": "printer",
      "category": "IT_Equipment",
      "specifications": {
        "model": "imagePRESS",
        "serialNumber": "SN234567",
        "brand": "Canon"
      },
      "financial": {
        "purchasePrice": 200000,
        "currentValue": 200000,
        "purchaseDate": "2026-05-03T00:00:00.000Z",
        "vendor": "Canon",
        "invoiceNumber": "INV-006"
      },
      "status": "available",
      "condition": "good",
      "assignment": {
        "assignedTo": null,
        "assignmentDate": null,
        "location": null
      }
    },
    {
      "assetName": "Cisco Router",
      "assetType": "equipment",
      "category": "IT_Equipment",
      "specifications": {
        "model": "Catalyst 9300",
        "serialNumber": "SN678901",
        "brand": "Cisco"
      },
      "financial": {
        "purchasePrice": 150000,
        "currentValue": 150000,
        "purchaseDate": "2026-05-03T00:00:00.000Z",
        "vendor": "Cisco",
        "invoiceNumber": "INV-007"
      },
      "status": "available",
      "condition": "excellent",
      "assignment": {
        "assignedTo": null,
        "assignmentDate": null,
        "location": null
      }
    },
    {
      "assetName": "Office Chair",
      "assetType": "furniture",
      "category": "Office_Furniture",
      "specifications": {
        "model": "Ergonomic",
        "serialNumber": "SN012345",
        "brand": "Herman Miller"
      },
      "financial": {
        "purchasePrice": 25000,
        "currentValue": 25000,
        "purchaseDate": "2026-05-03T00:00:00.000Z",
        "vendor": "Herman Miller",
        "invoiceNumber": "INV-008"
      },
      "status": "assigned",
      "condition": "good",
      "assignment": {
        "assignedTo": "Bob Johnson",
        "assignmentDate": "2026-05-03T00:00:00.000Z",
        "location": "Office 1"
      }
    },
    {
      "assetName": "Standing Desk",
      "assetType": "furniture",
      "category": "Office_Furniture",
      "specifications": {
        "model": "Electric",
        "serialNumber": "SN345678",
        "brand": "Flexispot"
      },
      "financial": {
        "purchasePrice": 35000,
        "currentValue": 35000,
        "purchaseDate": "2026-05-03T00:00:00.000Z",
        "vendor": "Flexispot",
        "invoiceNumber": "INV-009"
      },
      "status": "available",
      "condition": "excellent",
      "assignment": {
        "assignedTo": null,
        "assignmentDate": null,
        "location": null
      }
    },
    {
      "assetName": "Toyota Camry",
      "assetType": "vehicle",
      "category": "Vehicle",
      "specifications": {
        "model": "2023",
        "serialNumber": "SN789012",
        "brand": "Toyota"
      },
      "financial": {
        "purchasePrice": 2500000,
        "currentValue": 2500000,
        "purchaseDate": "2026-05-03T00:00:00.000Z",
        "vendor": "Toyota",
        "invoiceNumber": "INV-010"
      },
      "status": "assigned",
      "condition": "excellent",
      "assignment": {
        "assignedTo": "Alice Brown",
        "assignmentDate": "2026-05-03T00:00:00.000Z",
        "location": "Parking Lot"
      }
    }
  ]
}
```

## CSV Import Example

### Minimal CSV (Only Required Fields)

```csv
Asset Name,Asset Type,Category,Model,Serial Number,Brand,Purchase Price,Current Value,Purchase Date,Status,Condition,Assigned To,Assignment Date,Location,Vendor,Invoice Number
Dell Laptop,laptop,IT_Equipment,,,,,,,,,,,,,
HP Monitor,monitor,IT_Equipment,,,,,,,,,,,,,
Lenovo Desktop,desktop,IT_Equipment,,,,,,,,,,,,,
```

### Complete CSV (All Fields)

```csv
Asset Name,Asset Type,Category,Model,Serial Number,Brand,Purchase Price,Current Value,Purchase Date,Status,Condition,Assigned To,Assignment Date,Location,Vendor,Invoice Number
Dell Laptop,laptop,IT_Equipment,XPS 13,SN123456,Dell,75000,75000,2026-05-03,available,excellent,,,,Dell,INV-001
HP Monitor,monitor,IT_Equipment,24 inch,SN789012,HP,15000,15000,2026-05-03,available,excellent,,,,HP,INV-002
Lenovo Desktop,desktop,IT_Equipment,ThinkCentre,SN345678,Lenovo,50000,50000,2026-05-03,assigned,good,John Doe,2026-05-03,Desk 5,Lenovo,INV-003
```

## JSON Import Example

### Minimal JSON (Only Required Fields)

```json
{
  "assets": [
    {
      "assetName": "Dell Laptop",
      "assetType": "laptop",
      "category": "IT_Equipment"
    },
    {
      "assetName": "HP Monitor",
      "assetType": "monitor",
      "category": "IT_Equipment"
    },
    {
      "assetName": "Lenovo Desktop",
      "assetType": "desktop",
      "category": "IT_Equipment"
    }
  ]
}
```

### Complete JSON (All Fields)

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
    },
    {
      "assetName": "HP Monitor",
      "assetType": "monitor",
      "category": "IT_Equipment",
      "specifications": {
        "model": "24 inch",
        "serialNumber": "SN789012",
        "brand": "HP"
      },
      "financial": {
        "purchasePrice": 15000,
        "currentValue": 15000,
        "purchaseDate": "2026-05-03",
        "vendor": "HP",
        "invoiceNumber": "INV-002"
      },
      "status": "available",
      "condition": "excellent"
    },
    {
      "assetName": "Lenovo Desktop",
      "assetType": "desktop",
      "category": "IT_Equipment",
      "specifications": {
        "model": "ThinkCentre",
        "serialNumber": "SN345678",
        "brand": "Lenovo"
      },
      "financial": {
        "purchasePrice": 50000,
        "currentValue": 50000,
        "purchaseDate": "2026-05-03",
        "vendor": "Lenovo",
        "invoiceNumber": "INV-003"
      },
      "status": "assigned",
      "condition": "good"
    }
  ]
}
```

## Error Response Examples

### CSV Import Error

```json
{
  "success": true,
  "message": "2 asset(s) imported successfully",
  "data": {
    "createdAssets": [
      {
        "_id": "507f1f77bcf86cd799439011",
        "assetName": "Dell Laptop",
        "assetType": "laptop",
        "category": "IT_Equipment"
      }
    ],
    "errors": [
      "Row 2: Missing required fields (Asset Name, Asset Type, Category)",
      "Row 3: Invalid Asset Type 'invalid_type'"
    ],
    "summary": {
      "total": 3,
      "successful": 1,
      "failed": 2
    }
  }
}
```

### JSON Import Error

```json
{
  "success": true,
  "message": "1 asset(s) imported successfully",
  "data": {
    "createdAssets": [
      {
        "_id": "507f1f77bcf86cd799439011",
        "assetName": "Dell Laptop",
        "assetType": "laptop",
        "category": "IT_Equipment"
      }
    ],
    "errors": [
      "Asset 2: Missing required fields (assetName, assetType, category)",
      "Asset 3: Invalid Category 'invalid_category'"
    ],
    "summary": {
      "total": 3,
      "successful": 1,
      "failed": 2
    }
  }
}
```

## Valid Values Reference

### Asset Types
```
laptop, desktop, monitor, keyboard, mouse, headset, mobile_phone, tablet, 
printer, scanner, projector, camera, software_license, access_card, vehicle, 
furniture, equipment, other
```

### Categories
```
IT_Equipment, Office_Furniture, Vehicle, Software, Security, Other
```

### Status Values
```
available, assigned, in_use, maintenance, repair, retired, lost, stolen
```

### Condition Values
```
excellent, good, fair, poor, damaged
```

---

**Last Updated**: May 3, 2026
**Version**: 1.0.0
