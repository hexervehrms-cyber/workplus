# Asset Management System - Integration Guide

## Quick Start

### Step 1: Backend Setup ✅ (Already Done)

The backend is fully configured:
- ✅ Routes created: `backend/routes/assets.js`
- ✅ Server updated: `backend/server.js` (route registered)
- ✅ FNF integration: `backend/utils/fnfCalculationEngine.js` (asset deduction added)
- ✅ Model exists: `backend/models/AssetAssigned.js` (comprehensive)

### Step 2: Frontend Setup ✅ (Already Done)

All frontend pages created:
- ✅ Admin Assets Page: `frontend/src/app/pages/admin/Assets.tsx`
- ✅ Employee Assets Page: `frontend/src/app/pages/employee/Assets.tsx`
- ✅ Asset Section Component: `frontend/src/app/components/EmployeeAssetsSection.tsx`

### Step 3: Add Navigation Links

#### Add to Admin Navigation
**File:** `frontend/src/app/layouts/AdminLayout.tsx` or similar

```typescript
// Add to navigation menu
{
  label: 'Assets',
  icon: Package,
  href: '/admin/assets'
}
```

#### Add to Employee Navigation
**File:** `frontend/src/app/layouts/EmployeeLayout.tsx` or similar

```typescript
// Add to navigation menu
{
  label: 'My Assets',
  icon: Package,
  href: '/employee/assets'
}
```

### Step 4: Add Routes

#### Add to Admin Routes
**File:** `frontend/src/app/routes/admin.tsx` or similar

```typescript
import Assets from '../pages/admin/Assets';

// Add to routes array
{
  path: '/admin/assets',
  element: <Assets />
}
```

#### Add to Employee Routes
**File:** `frontend/src/app/routes/employee.tsx` or similar

```typescript
import Assets from '../pages/employee/Assets';

// Add to routes array
{
  path: '/employee/assets',
  element: <Assets />
}
```

### Step 5: Add Asset Section to Employee Profile

**File:** `frontend/src/app/pages/employee/Profile.tsx` or similar

```typescript
import EmployeeAssetsSection from '../../components/EmployeeAssetsSection';

// In the profile component, add:
<EmployeeAssetsSection 
  employeeId={employeeId}
  isAdmin={false}
/>
```

### Step 6: Add Asset Management to Admin Employee View

**File:** `frontend/src/app/pages/admin/Employees.tsx` or similar

```typescript
import EmployeeAssetsSection from '../../components/EmployeeAssetsSection';

// In employee details modal/page, add:
<EmployeeAssetsSection 
  employeeId={selectedEmployee._id}
  isAdmin={true}
  onAssignClick={() => {
    // Open assign asset modal
    setShowAssignAssetModal(true);
  }}
/>
```

---

## API Endpoints Reference

### Asset Management Endpoints

#### Create Asset
```
POST /api/assets
Headers: Authorization: Bearer {token}
Body: {
  assetName: "Dell Laptop",
  assetType: "laptop",
  category: "IT_Equipment",
  specifications: {
    model: "XPS 13",
    serialNumber: "SN123456",
    brand: "Dell"
  },
  financial: {
    purchasePrice: 100000,
    currentValue: 85000,
    purchaseDate: "2024-01-15"
  }
}
```

#### Get All Assets
```
GET /api/assets?status=assigned&search=laptop&page=1&limit=20
Headers: Authorization: Bearer {token}
```

#### Assign Asset
```
PUT /api/assets/{assetId}/assign
Headers: Authorization: Bearer {token}
Body: {
  assignedToId: "{employeeId}",
  location: "Desk 5, Floor 2",
  reason: "new_hire"
}
```

#### Return Asset
```
PUT /api/assets/{assetId}/return
Headers: Authorization: Bearer {token}
Body: {
  condition: "good",
  notes: "Asset returned in good condition",
  returnedDate: "2024-05-03"
}
```

#### Get Employee Assets
```
GET /api/assets/employee/{employeeId}
Headers: Authorization: Bearer {token}
```

#### Get Employee Asset Value (for FNF)
```
GET /api/assets/employee/{employeeId}/total-value
Headers: Authorization: Bearer {token}
```

---

## Component Usage Examples

### Using EmployeeAssetsSection in Profile

```typescript
import EmployeeAssetsSection from '../../components/EmployeeAssetsSection';

export default function EmployeeProfile() {
  const [employeeId, setEmployeeId] = useState('');

  return (
    <div className="space-y-6">
      {/* Other profile sections */}
      
      <EmployeeAssetsSection 
        employeeId={employeeId}
        isAdmin={false}
      />
    </div>
  );
}
```

### Using EmployeeAssetsSection in Admin View

```typescript
import EmployeeAssetsSection from '../../components/EmployeeAssetsSection';

export default function AdminEmployeeView() {
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [showAssignModal, setShowAssignModal] = useState(false);

  return (
    <div className="space-y-6">
      {/* Other employee details */}
      
      <EmployeeAssetsSection 
        employeeId={selectedEmployee?._id}
        isAdmin={true}
        onAssignClick={() => setShowAssignModal(true)}
      />
      
      {/* Assign Asset Modal */}
      {showAssignModal && (
        <AssignAssetModal 
          employeeId={selectedEmployee?._id}
          onClose={() => setShowAssignModal(false)}
        />
      )}
    </div>
  );
}
```

---

## FNF Integration

### Automatic Asset Deduction in FNF

When calculating FNF for an employee:

1. System fetches all assigned assets
2. Calculates total current value
3. Adds to deductions breakdown
4. Deducts from final settlement

**Example FNF Deduction Breakdown:**
```javascript
{
  type: "Asset Deduction",
  amount: 215000,
  description: "Deduction for 3 assigned asset(s)",
  assets: [
    {
      assetName: "Dell Laptop XPS 13",
      serialNumber: "SN123456",
      value: 85000
    },
    {
      assetName: "Dell Monitor 27\"",
      serialNumber: "SN789012",
      value: 30000
    },
    {
      assetName: "Mechanical Keyboard",
      serialNumber: "SN345678",
      value: 100000
    }
  ]
}
```

---

## Testing the System

### Test Scenario 1: Create and Assign Asset

1. Login as Admin
2. Go to Admin → Assets
3. Click "Add Asset"
4. Fill in details:
   - Asset Name: "Dell Laptop"
   - Type: "laptop"
   - Category: "IT_Equipment"
   - Model: "XPS 13"
   - Serial: "SN123456"
   - Purchase Price: 100000
5. Click "Add Asset"
6. Asset appears in list with "Available" status
7. Click "Assign" button
8. Select an employee
9. Enter location: "Desk 5"
10. Click "Assign"
11. Asset status changes to "Assigned"

### Test Scenario 2: View Employee Assets

1. Login as Employee
2. Go to Employee → My Assets
3. See all assigned assets
4. View asset details
5. See total asset value

### Test Scenario 3: Return Asset

1. Login as Admin
2. Go to Admin → Assets
3. Find assigned asset
4. Click "Return" button
5. Select return date
6. Select condition: "good"
7. Add notes: "Returned in good condition"
8. Click "Return Asset"
9. Asset status changes to "Available"
10. Assignment added to history

### Test Scenario 4: FNF with Asset Deduction

1. Login as Admin
2. Go to Admin → FNF
3. Create new FNF settlement for employee with assets
4. View deductions section
5. See "Asset Deduction" line item
6. Verify asset values are deducted from final settlement

---

## Troubleshooting

### Issue: Assets not showing in employee view

**Solution:**
1. Verify employee ID is correct
2. Check that assets are assigned to correct employee
3. Verify asset status is "assigned" or "in_use"
4. Check browser console for API errors

### Issue: Asset assignment fails

**Solution:**
1. Verify employee exists
2. Check that user has Admin/HR role
3. Verify asset exists and is available
4. Check network tab for API response

### Issue: FNF not showing asset deduction

**Solution:**
1. Verify assets are assigned to employee
2. Check that asset financial values are set
3. Verify FNF calculation includes asset deduction
4. Check backend logs for errors

---

## Performance Considerations

### Optimization Tips

1. **Asset List Pagination**
   - Default limit: 20 assets per page
   - Adjust in Assets.tsx if needed

2. **Employee Asset Queries**
   - Uses indexed queries for performance
   - Indexes on: assignedTo, status, orgId

3. **FNF Calculation**
   - Asset query is efficient with indexes
   - Runs only when FNF is calculated

### Database Indexes

Already defined in AssetAssigned model:
```javascript
assetAssignedSchema.index({ orgId: 1, status: 1 });
assetAssignedSchema.index({ 'assignment.assignedTo': 1, status: 1 });
assetAssignedSchema.index({ assetType: 1, category: 1 });
assetAssignedSchema.index({ 'financial.purchaseDate': -1 });
assetAssignedSchema.index({ 'maintenance.nextServiceDate': 1 });
assetAssignedSchema.index({ 'specifications.warranty.endDate': 1 });
assetAssignedSchema.index({ departmentId: 1, status: 1 });
```

---

## Security Considerations

### Access Control
- ✅ Only Admin/HR can create assets
- ✅ Only Admin/HR can assign/return assets
- ✅ Employees can only view their own assets
- ✅ All endpoints require authentication

### Data Protection
- ✅ Soft delete (assets not permanently deleted)
- ✅ Complete audit trail (assignment history)
- ✅ User tracking (who assigned/returned)
- ✅ Timestamp tracking (all dates recorded)

---

## Deployment Checklist

- [ ] Backend routes tested
- [ ] Frontend pages created
- [ ] Navigation links added
- [ ] Routes configured
- [ ] Asset section added to employee profile
- [ ] Asset management added to admin employee view
- [ ] FNF integration tested
- [ ] All endpoints tested
- [ ] Error handling verified
- [ ] Permissions verified
- [ ] Database indexes verified
- [ ] Deployment to production

---

## Support

For issues or questions:
1. Check the troubleshooting section
2. Review API endpoint documentation
3. Check browser console for errors
4. Check backend logs for errors
5. Verify database connection

---

**Last Updated:** May 3, 2026
**Version:** 1.0.0
**Status:** Ready for Integration
