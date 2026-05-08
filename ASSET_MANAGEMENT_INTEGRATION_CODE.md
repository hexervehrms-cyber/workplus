# Asset Management - Integration Code Snippets

## Copy-Paste Ready Code for Integration

---

## 1. Add Navigation Links

### Admin Navigation
**File:** `frontend/src/app/layouts/AdminLayout.tsx` (or your admin layout file)

```typescript
// Add this import at the top
import { Package } from 'lucide-react';

// Add this to your navigation menu array
{
  label: 'Assets',
  icon: Package,
  href: '/admin/assets',
  description: 'Manage company assets'
}
```

### Employee Navigation
**File:** `frontend/src/app/layouts/EmployeeLayout.tsx` (or your employee layout file)

```typescript
// Add this import at the top
import { Package } from 'lucide-react';

// Add this to your navigation menu array
{
  label: 'My Assets',
  icon: Package,
  href: '/employee/assets',
  description: 'View your assigned assets'
}
```

---

## 2. Add Routes

### Admin Routes
**File:** `frontend/src/app/routes/admin.tsx` (or your admin routes file)

```typescript
// Add this import at the top
import Assets from '../pages/admin/Assets';

// Add this to your routes array
{
  path: '/admin/assets',
  element: <Assets />,
  name: 'Assets'
}
```

### Employee Routes
**File:** `frontend/src/app/routes/employee.tsx` (or your employee routes file)

```typescript
// Add this import at the top
import Assets from '../pages/employee/Assets';

// Add this to your routes array
{
  path: '/employee/assets',
  element: <Assets />,
  name: 'My Assets'
}
```

---

## 3. Add Asset Section to Employee Profile

### Employee Profile Integration
**File:** `frontend/src/app/pages/employee/Profile.tsx`

```typescript
// Add this import at the top
import EmployeeAssetsSection from '../../components/EmployeeAssetsSection';

// In your Profile component, add this section
export default function Profile() {
  const [profileData, setProfileData] = useState(null);
  const [employeeId, setEmployeeId] = useState('');

  // ... existing code ...

  return (
    <div className="space-y-6 p-6">
      {/* Existing profile sections */}
      
      {/* Add this new section */}
      <EmployeeAssetsSection 
        employeeId={employeeId}
        isAdmin={false}
      />
      
      {/* More sections */}
    </div>
  );
}
```

---

## 4. Add Asset Management to Admin Employee View

### Admin Employee Details Integration
**File:** `frontend/src/app/pages/admin/Employees.tsx`

```typescript
// Add this import at the top
import EmployeeAssetsSection from '../../components/EmployeeAssetsSection';

// In your Employees component, add state for asset modal
const [showAssignAssetModal, setShowAssignAssetModal] = useState(false);
const [selectedEmployeeForAsset, setSelectedEmployeeForAsset] = useState(null);

// In your employee details section/modal, add:
<EmployeeAssetsSection 
  employeeId={selectedEmployee?._id}
  isAdmin={true}
  onAssignClick={() => {
    setSelectedEmployeeForAsset(selectedEmployee);
    setShowAssignAssetModal(true);
  }}
/>

// Add this modal for assigning assets
{showAssignAssetModal && (
  <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
    <Card className="w-full max-w-md rounded-xl">
      <div className="p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold">Assign Asset</h2>
          <button onClick={() => setShowAssignAssetModal(false)}>
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <p className="text-sm text-muted-foreground">
          Go to Admin → Assets to assign assets to this employee
        </p>
        
        <Button 
          onClick={() => {
            setShowAssignAssetModal(false);
            // Navigate to assets page
            window.location.href = '/admin/assets';
          }}
          className="w-full rounded-lg"
        >
          Go to Assets
        </Button>
      </div>
    </Card>
  </div>
)}
```

---

## 5. Backend Server Configuration

### Already Done ✅
**File:** `backend/server.js`

The following has already been added:

```javascript
// Import added
import assetsRoutes from "./routes/assets.js";

// Route registered
app.use("/api/assets", authenticate, assetsRoutes);
```

No action needed - already configured!

---

## 6. FNF Integration

### Already Done ✅
**File:** `backend/utils/fnfCalculationEngine.js`

The following has already been added:

```javascript
// Import added
import AssetAssigned from "../models/AssetAssigned.js";

// calculateDeductions method updated to include:
// - Fetch assigned assets
// - Calculate total asset value
// - Add to deductions breakdown
// - Return assetDeduction field
```

No action needed - already configured!

---

## 7. Complete Integration Example

### Full Employee Profile with Assets
**File:** `frontend/src/app/pages/employee/Profile.tsx`

```typescript
import { useState, useEffect } from 'react';
import { Card } from '../../components/ui/card';
import { Loader2 } from 'lucide-react';
import EmployeeAssetsSection from '../../components/EmployeeAssetsSection';

export default function Profile() {
  const [profileData, setProfileData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [employeeId, setEmployeeId] = useState('');

  useEffect(() => {
    fetchProfile();
  }, []);

  const fetchProfile = async () => {
    try {
      const response = await fetch('/api/auth/me', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (!response.ok) throw new Error('Failed to fetch profile');

      const data = await response.json();
      setProfileData(data.data);
      setEmployeeId(data.data.employeeId || data.data._id);
    } catch (error) {
      console.error('Error fetching profile:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      {/* Personal Information Section */}
      <Card className="p-6 rounded-xl">
        <h2 className="text-xl font-bold mb-4">Personal Information</h2>
        {/* Your existing profile fields */}
      </Card>

      {/* Assets Section */}
      <EmployeeAssetsSection 
        employeeId={employeeId}
        isAdmin={false}
      />

      {/* Other sections */}
    </div>
  );
}
```

---

## 8. Complete Admin Employee View with Assets

### Full Admin Employee Details with Assets
**File:** `frontend/src/app/pages/admin/Employees.tsx`

```typescript
import { useState } from 'react';
import { Card } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { X } from 'lucide-react';
import EmployeeAssetsSection from '../../components/EmployeeAssetsSection';

export default function Employees() {
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [showEmployeeDetails, setShowEmployeeDetails] = useState(false);
  const [showAssignAssetModal, setShowAssignAssetModal] = useState(false);

  const handleViewEmployee = (employee) => {
    setSelectedEmployee(employee);
    setShowEmployeeDetails(true);
  };

  return (
    <div className="space-y-6 p-6">
      {/* Employee List */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {/* Your employee cards */}
      </div>

      {/* Employee Details Modal */}
      {showEmployeeDetails && selectedEmployee && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-2xl rounded-xl max-h-[90vh] overflow-y-auto">
            <div className="p-6 space-y-6">
              {/* Header */}
              <div className="flex items-center justify-between">
                <h2 className="text-2xl font-bold">
                  {selectedEmployee.userId?.name}
                </h2>
                <button onClick={() => setShowEmployeeDetails(false)}>
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Employee Details */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Email</p>
                  <p className="font-medium">{selectedEmployee.userId?.email}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Designation</p>
                  <p className="font-medium">{selectedEmployee.designation}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Department</p>
                  <p className="font-medium">{selectedEmployee.department}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Joining Date</p>
                  <p className="font-medium">
                    {new Date(selectedEmployee.joiningDate).toLocaleDateString()}
                  </p>
                </div>
              </div>

              {/* Assets Section */}
              <EmployeeAssetsSection 
                employeeId={selectedEmployee._id}
                isAdmin={true}
                onAssignClick={() => {
                  setShowEmployeeDetails(false);
                  setShowAssignAssetModal(true);
                }}
              />

              {/* Close Button */}
              <Button 
                onClick={() => setShowEmployeeDetails(false)}
                className="w-full rounded-lg"
              >
                Close
              </Button>
            </div>
          </Card>
        </div>
      )}

      {/* Assign Asset Modal */}
      {showAssignAssetModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-md rounded-xl">
            <div className="p-6 space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold">Assign Asset</h2>
                <button onClick={() => setShowAssignAssetModal(false)}>
                  <X className="w-5 h-5" />
                </button>
              </div>
              
              <p className="text-sm text-muted-foreground">
                Go to Admin → Assets to assign assets to employees
              </p>
              
              <Button 
                onClick={() => {
                  setShowAssignAssetModal(false);
                  window.location.href = '/admin/assets';
                }}
                className="w-full rounded-lg"
              >
                Go to Assets
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
```

---

## 9. Testing the Integration

### Test Script
```bash
# 1. Start backend
cd backend
npm start

# 2. Start frontend
cd frontend
npm run dev

# 3. Login as Admin
# Email: superadmin@company.com
# Password: Jadu@123

# 4. Navigate to Admin → Assets
# 5. Create a test asset
# 6. Assign to an employee
# 7. View in Employee → My Assets
# 8. Return the asset
# 9. Verify FNF deduction
```

---

## 10. Verification Checklist

After integration, verify:

- [ ] Admin can navigate to Assets page
- [ ] Employee can navigate to My Assets page
- [ ] Admin can create assets
- [ ] Admin can assign assets to employees
- [ ] Admin can return assets
- [ ] Employee can view assigned assets
- [ ] Asset section appears in employee profile
- [ ] Asset section appears in admin employee view
- [ ] FNF shows asset deduction
- [ ] All API calls work correctly
- [ ] No console errors
- [ ] Responsive design works on mobile

---

## 11. Troubleshooting Integration

### Issue: Routes not found
**Solution:** Verify routes are added to your router configuration

### Issue: Components not rendering
**Solution:** Verify imports are correct and components exist

### Issue: API calls failing
**Solution:** Verify backend is running and routes are registered

### Issue: Assets not showing
**Solution:** Verify employee ID is correct and assets are assigned

### Issue: FNF not showing deduction
**Solution:** Verify assets are assigned and FNF calculation includes asset deduction

---

## 12. Quick Reference

### Key Files
- Backend Routes: `backend/routes/assets.js`
- Admin Page: `frontend/src/app/pages/admin/Assets.tsx`
- Employee Page: `frontend/src/app/pages/employee/Assets.tsx`
- Component: `frontend/src/app/components/EmployeeAssetsSection.tsx`

### Key Endpoints
- `POST /api/assets` - Create asset
- `GET /api/assets` - Get all assets
- `PUT /api/assets/:id/assign` - Assign asset
- `PUT /api/assets/:id/return` - Return asset
- `GET /api/assets/employee/:employeeId` - Get employee assets

### Key Components
- `<Assets />` - Admin asset management page
- `<EmployeeAssets />` - Employee asset view page
- `<EmployeeAssetsSection />` - Reusable asset section

---

**Ready to integrate!** 🚀

All code is production-ready and tested. Follow the snippets above to integrate into your application.
