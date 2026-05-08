# Leave Allocation API - Usage Examples

## Authentication
All endpoints require authentication. Include the JWT token in the Authorization header:
```
Authorization: Bearer <your_jwt_token>
```

## 1. Create/Update Leave Allocation

### Request
```bash
POST /api/leave-allocation
Content-Type: application/json

{
  "employeeId": "emp_123",
  "userId": "user_456",
  "orgId": "org_789",
  "year": 2025,
  "month": 1,
  "allocations": {
    "vacation": 2,
    "sickLeave": 1,
    "casualLeave": 1,
    "maternityLeave": 0,
    "paternityLeave": 0,
    "compensatoryOff": 0,
    "personal": 1,
    "emergency": 0,
    "ncns": 0,
    "sandwichLeave": 0
  },
  "notes": "January allocation"
}
```

### Response (Success)
```json
{
  "success": true,
  "message": "Leave allocation created successfully",
  "data": {
    "_id": "alloc_123",
    "employeeId": "emp_123",
    "userId": "user_456",
    "orgId": "org_789",
    "year": 2025,
    "month": 1,
    "allocations": {
      "vacation": 2,
      "sickLeave": 1,
      "casualLeave": 1,
      "maternityLeave": 0,
      "paternityLeave": 0,
      "compensatoryOff": 0,
      "personal": 1,
      "emergency": 0,
      "ncns": 0,
      "sandwichLeave": 0
    },
    "used": {
      "vacation": 0,
      "sickLeave": 0,
      "casualLeave": 0,
      "maternityLeave": 0,
      "paternityLeave": 0,
      "compensatoryOff": 0,
      "personal": 0,
      "emergency": 0,
      "ncns": 0,
      "sandwichLeave": 0
    },
    "pending": {
      "vacation": 0,
      "sickLeave": 0,
      "casualLeave": 0,
      "maternityLeave": 0,
      "paternityLeave": 0,
      "compensatoryOff": 0,
      "personal": 0,
      "emergency": 0,
      "ncns": 0,
      "sandwichLeave": 0
    },
    "carriedForward": {
      "vacation": 0,
      "sickLeave": 0,
      "casualLeave": 0,
      "maternityLeave": 0,
      "paternityLeave": 0,
      "compensatoryOff": 0,
      "personal": 0,
      "emergency": 0,
      "ncns": 0,
      "sandwichLeave": 0
    },
    "status": "allocated",
    "allocatedBy": "user_456",
    "allocatedDate": "2025-01-01T10:00:00Z",
    "createdAt": "2025-01-01T10:00:00Z",
    "updatedAt": "2025-01-01T10:00:00Z"
  }
}
```

## 2. Get Employee Allocations

### Request
```bash
GET /api/leave-allocation/employee/emp_123?year=2025&month=1
```

### Response
```json
{
  "success": true,
  "data": [
    {
      "_id": "alloc_123",
      "employeeId": {
        "_id": "emp_123",
        "employeeCode": "EMP001",
        "name": "John Doe"
      },
      "year": 2025,
      "month": 1,
      "allocations": {
        "vacation": 2,
        "sickLeave": 1,
        "casualLeave": 1,
        "maternityLeave": 0,
        "paternityLeave": 0,
        "compensatoryOff": 0,
        "personal": 1,
        "emergency": 0,
        "ncns": 0,
        "sandwichLeave": 0
      },
      "status": "allocated"
    }
  ]
}
```

## 3. Get Organization Allocations

### Request
```bash
GET /api/leave-allocation/organization/org_789?year=2025&month=1&page=1&limit=10
```

### Response
```json
{
  "success": true,
  "data": [
    {
      "_id": "alloc_123",
      "employeeId": {
        "_id": "emp_123",
        "employeeCode": "EMP001",
        "name": "John Doe",
        "department": "Engineering"
      },
      "year": 2025,
      "month": 1,
      "allocations": {
        "vacation": 2,
        "sickLeave": 1,
        "casualLeave": 1,
        "maternityLeave": 0,
        "paternityLeave": 0,
        "compensatoryOff": 0,
        "personal": 1,
        "emergency": 0,
        "ncns": 0,
        "sandwichLeave": 0
      },
      "status": "allocated",
      "allocatedDate": "2025-01-01T10:00:00Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 10,
    "total": 50,
    "pages": 5
  }
}
```

## 4. Get Employee Leave Balance

### Request
```bash
GET /api/leave-allocation/balance/emp_123
```

### Response
```json
{
  "success": true,
  "data": {
    "vacation": {
      "allocated": 2,
      "used": 0,
      "pending": 1,
      "available": 1
    },
    "sickLeave": {
      "allocated": 1,
      "used": 0,
      "pending": 0,
      "available": 1
    },
    "casualLeave": {
      "allocated": 1,
      "used": 0,
      "pending": 0,
      "available": 1
    },
    "maternityLeave": {
      "allocated": 0,
      "used": 0,
      "pending": 0,
      "available": 0
    },
    "paternityLeave": {
      "allocated": 0,
      "used": 0,
      "pending": 0,
      "available": 0
    },
    "compensatoryOff": {
      "allocated": 0,
      "used": 0,
      "pending": 0,
      "available": 0
    },
    "personal": {
      "allocated": 1,
      "used": 0,
      "pending": 0,
      "available": 1
    },
    "emergency": {
      "allocated": 0,
      "used": 0,
      "pending": 0,
      "available": 0
    },
    "ncns": {
      "allocated": 0,
      "used": 0,
      "pending": 0,
      "available": 0
    },
    "sandwichLeave": {
      "allocated": 0,
      "used": 0,
      "pending": 0,
      "available": 0
    }
  },
  "allocation": {
    "_id": "alloc_123",
    "year": 2025,
    "month": 1,
    "status": "allocated"
  }
}
```

## 5. Deduct Leaves

### Request
```bash
POST /api/leave-allocation/deduct
Content-Type: application/json

{
  "employeeId": "emp_123",
  "leaveType": "Vacation",
  "days": 1,
  "leaveRequestId": "leave_req_123"
}
```

### Response (Success)
```json
{
  "success": true,
  "message": "Leaves deducted successfully",
  "data": {
    "_id": "alloc_123",
    "used": {
      "vacation": 1,
      "sickLeave": 0,
      "casualLeave": 0,
      "maternityLeave": 0,
      "paternityLeave": 0,
      "compensatoryOff": 0,
      "personal": 0,
      "emergency": 0,
      "ncns": 0,
      "sandwichLeave": 0
    }
  }
}
```

### Response (Insufficient Balance)
```json
{
  "success": false,
  "message": "Insufficient Vacation balance. Available: 0 days",
  "available": 0
}
```

## 6. Restore Leaves

### Request
```bash
POST /api/leave-allocation/restore
Content-Type: application/json

{
  "employeeId": "emp_123",
  "leaveType": "Vacation",
  "days": 1,
  "leaveRequestId": "leave_req_123"
}
```

### Response
```json
{
  "success": true,
  "message": "Leaves restored successfully",
  "data": {
    "_id": "alloc_123",
    "used": {
      "vacation": 0,
      "sickLeave": 0,
      "casualLeave": 0,
      "maternityLeave": 0,
      "paternityLeave": 0,
      "compensatoryOff": 0,
      "personal": 0,
      "emergency": 0,
      "ncns": 0,
      "sandwichLeave": 0
    }
  }
}
```

## 7. Bulk Allocate

### Request
```bash
POST /api/leave-allocation/bulk-allocate
Content-Type: application/json

{
  "orgId": "org_789",
  "year": 2025,
  "month": 1,
  "employees": ["emp_123", "emp_124", "emp_125"],
  "allocations": {
    "vacation": 2,
    "sickLeave": 1,
    "casualLeave": 1,
    "maternityLeave": 0,
    "paternityLeave": 0,
    "compensatoryOff": 0,
    "personal": 1,
    "emergency": 0,
    "ncns": 0,
    "sandwichLeave": 0
  },
  "allocatedBy": "user_456"
}
```

### Response
```json
{
  "success": true,
  "message": "Allocated leaves to 3 employees",
  "data": {
    "results": [
      {
        "employeeId": "emp_123",
        "success": true,
        "allocationId": "alloc_123"
      },
      {
        "employeeId": "emp_124",
        "success": true,
        "allocationId": "alloc_124"
      },
      {
        "employeeId": "emp_125",
        "success": true,
        "allocationId": "alloc_125"
      }
    ],
    "errors": []
  }
}
```

## 8. Update Allocation

### Request
```bash
PATCH /api/leave-allocation/alloc_123
Content-Type: application/json

{
  "allocations": {
    "vacation": 3,
    "sickLeave": 1,
    "casualLeave": 1,
    "maternityLeave": 0,
    "paternityLeave": 0,
    "compensatoryOff": 0,
    "personal": 1,
    "emergency": 0,
    "ncns": 0,
    "sandwichLeave": 0
  },
  "notes": "Updated allocation"
}
```

### Response
```json
{
  "success": true,
  "message": "Leave allocation updated successfully",
  "data": {
    "_id": "alloc_123",
    "allocations": {
      "vacation": 3,
      "sickLeave": 1,
      "casualLeave": 1,
      "maternityLeave": 0,
      "paternityLeave": 0,
      "compensatoryOff": 0,
      "personal": 1,
      "emergency": 0,
      "ncns": 0,
      "sandwichLeave": 0
    }
  }
}
```

## 9. Delete Allocation

### Request
```bash
DELETE /api/leave-allocation/alloc_123
```

### Response
```json
{
  "success": true,
  "message": "Leave allocation deleted successfully",
  "data": {
    "_id": "alloc_123"
  }
}
```

## 10. Get Single Allocation

### Request
```bash
GET /api/leave-allocation/alloc_123
```

### Response
```json
{
  "success": true,
  "data": {
    "_id": "alloc_123",
    "employeeId": {
      "_id": "emp_123",
      "employeeCode": "EMP001",
      "name": "John Doe",
      "department": "Engineering"
    },
    "userId": {
      "_id": "user_456",
      "name": "Admin User",
      "email": "admin@example.com"
    },
    "year": 2025,
    "month": 1,
    "allocations": {
      "vacation": 2,
      "sickLeave": 1,
      "casualLeave": 1,
      "maternityLeave": 0,
      "paternityLeave": 0,
      "compensatoryOff": 0,
      "personal": 1,
      "emergency": 0,
      "ncns": 0,
      "sandwichLeave": 0
    },
    "used": {
      "vacation": 0,
      "sickLeave": 0,
      "casualLeave": 0,
      "maternityLeave": 0,
      "paternityLeave": 0,
      "compensatoryOff": 0,
      "personal": 0,
      "emergency": 0,
      "ncns": 0,
      "sandwichLeave": 0
    },
    "pending": {
      "vacation": 0,
      "sickLeave": 0,
      "casualLeave": 0,
      "maternityLeave": 0,
      "paternityLeave": 0,
      "compensatoryOff": 0,
      "personal": 0,
      "emergency": 0,
      "ncns": 0,
      "sandwichLeave": 0
    },
    "status": "allocated",
    "allocatedBy": {
      "_id": "user_456",
      "name": "Admin User",
      "email": "admin@example.com"
    },
    "allocatedDate": "2025-01-01T10:00:00Z",
    "createdAt": "2025-01-01T10:00:00Z",
    "updatedAt": "2025-01-01T10:00:00Z"
  }
}
```

## Error Responses

### 400 Bad Request
```json
{
  "success": false,
  "message": "All fields are required"
}
```

### 404 Not Found
```json
{
  "success": false,
  "message": "Leave allocation not found"
}
```

### 409 Conflict (Insufficient Balance)
```json
{
  "success": false,
  "message": "Insufficient Vacation balance. Available: 0 days",
  "available": 0
}
```

## cURL Examples

### Create Allocation
```bash
curl -X POST http://localhost:5000/api/leave-allocation \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "employeeId": "emp_123",
    "userId": "user_456",
    "orgId": "org_789",
    "year": 2025,
    "month": 1,
    "allocations": {
      "vacation": 2,
      "sickLeave": 1,
      "casualLeave": 1,
      "maternityLeave": 0,
      "paternityLeave": 0,
      "compensatoryOff": 0,
      "personal": 1,
      "emergency": 0,
      "ncns": 0,
      "sandwichLeave": 0
    }
  }'
```

### Get Balance
```bash
curl -X GET http://localhost:5000/api/leave-allocation/balance/emp_123 \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### Deduct Leaves
```bash
curl -X POST http://localhost:5000/api/leave-allocation/deduct \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "employeeId": "emp_123",
    "leaveType": "Vacation",
    "days": 1,
    "leaveRequestId": "leave_req_123"
  }'
```

## JavaScript/TypeScript Examples

### Using LeaveAllocationService

```typescript
import { LeaveAllocationService } from './utils/api';

// Create allocation
const allocation = await LeaveAllocationService.createAllocation({
  employeeId: 'emp_123',
  userId: 'user_456',
  orgId: 'org_789',
  year: 2025,
  month: 1,
  allocations: {
    vacation: 2,
    sickLeave: 1,
    casualLeave: 1,
    maternityLeave: 0,
    paternityLeave: 0,
    compensatoryOff: 0,
    personal: 1,
    emergency: 0,
    ncns: 0,
    sandwichLeave: 0
  }
});

// Get balance
const balance = await LeaveAllocationService.getEmployeeBalance('emp_123');

// Deduct leaves
const deducted = await LeaveAllocationService.deductLeaves(
  'emp_123',
  'Vacation',
  1,
  'leave_req_123'
);

// Restore leaves
const restored = await LeaveAllocationService.restoreLeaves(
  'emp_123',
  'Vacation',
  1,
  'leave_req_123'
);

// Bulk allocate
const bulk = await LeaveAllocationService.bulkAllocate(
  'org_789',
  2025,
  1,
  ['emp_123', 'emp_124', 'emp_125'],
  {
    vacation: 2,
    sickLeave: 1,
    casualLeave: 1,
    maternityLeave: 0,
    paternityLeave: 0,
    compensatoryOff: 0,
    personal: 1,
    emergency: 0,
    ncns: 0,
    sandwichLeave: 0
  },
  'user_456'
);
```
