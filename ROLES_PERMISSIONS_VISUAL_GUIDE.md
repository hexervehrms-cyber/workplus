# Roles & Permissions - Visual Guide

## 🎨 Page Layout

```
┌─────────────────────────────────────────────────────────────┐
│  Roles & Permissions                                        │
│  Manage roles, permissions, and employee assignments        │
│                                    [Create Custom Role] ▼   │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│  Available Roles                                            │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  🛡️ Recruiter                                    [13 perms] ▼ │
│     Handles recruitment and employee management            │
│                                                             │
│  🛡️ Accountant                                   [8 perms]  ▼ │
│     Handles accounting and financial operations           │
│                                                             │
│  🛡️ Manager                                      [10 perms] ▼ │
│     Manages team and approves requests                    │
│                                                             │
│  🛡️ Sales                                        [3 perms]  ▼ │
│     Sales team member                                      │
│                                                             │
│  🛡️ Team Lead                          [Custom] [5 perms]  ▼ │
│     Team leadership role                                   │
│                                                             │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│  Assign Roles to Employees                                  │
├─────────────────────────────────────────────────────────────┤
│  🔍 Search employees by name or email...                   │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│  Employees                                    (5 found)     │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  🛡️ John Doe                                               │
│     john.doe@company.com                                   │
│     Department: Sales                                      │
│                                                             │
│     Current Role: Recruiter                    [Edit] ✏️   │
│     13 permissions                                         │
│                                                             │
│  🛡️ Jane Smith                                             │
│     jane.smith@company.com                                 │
│     Department: Finance                                    │
│                                                             │
│     Current Role: Accountant                   [Edit] ✏️   │
│     8 permissions                                          │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

## 📋 Create Custom Role Dialog

```
┌──────────────────────────────────────────────────────────┐
│  Create Custom Role                                      │
│  Define a new role with specific permissions             │
├──────────────────────────────────────────────────────────┤
│                                                          │
│  Role Name *                                             │
│  [Team Lead                                            ] │
│                                                          │
│  Description                                             │
│  [Team leadership role                                 ] │
│                                                          │
│  Permissions *                                           │
│                                                          │
│  ┌─ Employee Management ─────────────────────────────┐  │
│  │ ☑ View Employees                                 │  │
│  │   View employee list and details                 │  │
│  │ ☑ Add Employees                                  │  │
│  │   Add new employees                              │  │
│  │ ☑ Edit Employees                                 │  │
│  │   Edit employee information                      │  │
│  │ ☐ Delete Employees                               │  │
│  │   Delete employees                               │  │
│  └────────────────────────────────────────────────────┘  │
│                                                          │
│  ┌─ Leave Management ────────────────────────────────┐  │
│  │ ☐ View Leaves                                    │  │
│  │   View leave requests                            │  │
│  │ ☐ Add Leaves                                     │  │
│  │   Add leave requests                             │  │
│  │ ☐ Edit Leaves                                    │  │
│  │   Edit leave requests                            │  │
│  │ ☑ Approve Leaves                                 │  │
│  │   Approve or reject leave requests               │  │
│  └────────────────────────────────────────────────────┘  │
│                                                          │
│  ┌─ Expense Management ──────────────────────────────┐  │
│  │ ☐ View Expenses                                  │  │
│  │   View expense reports                           │  │
│  │ ☐ Add Expenses                                   │  │
│  │   Submit expense reports                         │  │
│  │ ☐ Edit Expenses                                  │  │
│  │   Edit expense reports                           │  │
│  │ ☐ Delete Expenses                                │  │
│  │   Delete expense reports                         │  │
│  │ ☑ Approve Expenses                               │  │
│  │   Approve or reject expenses                     │  │
│  └────────────────────────────────────────────────────┘  │
│                                                          │
│  [Cancel]                          [Create Role]        │
│                                                          │
└──────────────────────────────────────────────────────────┘
```

## 🔄 Assign Role Dialog

```
┌──────────────────────────────────────────────────────────┐
│  Assign Role                                             │
│  Change the role for John Doe                            │
├──────────────────────────────────────────────────────────┤
│                                                          │
│  Employee                                                │
│  John Doe                                                │
│                                                          │
│  Select Role *                                           │
│  ┌─────────────────────────────────────────────────────┐ │
│  │ 🛡️ Recruiter                                    ▼ │ │
│  └─────────────────────────────────────────────────────┘ │
│                                                          │
│  ┌─ Role Details ────────────────────────────────────┐  │
│  │ Permissions: 13 permissions assigned             │  │
│  └────────────────────────────────────────────────────┘  │
│                                                          │
│  [Cancel]                          [Assign Role]        │
│                                                          │
└──────────────────────────────────────────────────────────┘
```

## 📊 Expanded Role Card

```
┌──────────────────────────────────────────────────────────┐
│  🛡️ Recruiter                                [13 perms] ▲ │
│     Handles recruitment and employee management          │
├──────────────────────────────────────────────────────────┤
│                                                          │
│  Permissions                                             │
│                                                          │
│  Employee Management          Salary Management         │
│  • View Employees             • View Salary             │
│  • Add Employees              • Edit Salary             │
│  • Edit Employees                                       │
│  • Delete Employees           Leave Management          │
│                               • View Leaves             │
│  Expense Management           • Add Leaves              │
│  • View Expenses              • Edit Leaves             │
│  • Add Expenses                                         │
│  • Edit Expenses              Attendance Management     │
│  • Delete Expenses            • View Attendance         │
│  • Approve Expenses           • Edit Attendance         │
│                                                          │
└──────────────────────────────────────────────────────────┘
```

## 🎯 Permission Categories

### Employee Management (4 permissions)
```
☑ View Employees      - View employee list and details
☑ Add Employees       - Add new employees
☑ Edit Employees      - Edit employee information
☑ Delete Employees    - Delete employees
```

### Salary Management (4 permissions)
```
☑ View Salary         - View salary information
☑ Edit Salary         - Edit salary information
☑ Manage Payroll      - Manage payroll processing
☑ Manage Taxes        - Manage tax calculations
```

### Leave Management (4 permissions)
```
☑ View Leaves         - View leave requests
☑ Add Leaves          - Add leave requests
☑ Edit Leaves         - Edit leave requests
☑ Approve Leaves      - Approve or reject leave requests
```

### Expense Management (5 permissions)
```
☑ View Expenses       - View expense reports
☑ Add Expenses        - Submit expense reports
☑ Edit Expenses       - Edit expense reports
☑ Delete Expenses     - Delete expense reports
☑ Approve Expenses    - Approve or reject expenses
```

### Attendance Management (4 permissions)
```
☑ View Attendance     - View attendance records
☑ Edit Attendance     - Edit attendance records
☑ Approve Attendance  - Approve attendance
☑ Delete Attendance   - Delete attendance records
```

## 🎨 Color Coding

- **Primary (Blue)**: Main actions and icons
- **Secondary (Purple)**: Secondary actions
- **Destructive (Red)**: Delete/remove actions
- **Success (Green)**: Approved/completed actions
- **Outline (Gray)**: Neutral/default actions

## 📱 Responsive Breakpoints

### Desktop (1024px+)
- Full layout with grid
- Side-by-side permission categories
- Expanded role cards

### Tablet (768px - 1023px)
- Optimized layout
- Stacked permission categories
- Responsive dialogs

### Mobile (< 768px)
- Single column layout
- Full-width inputs
- Stacked dialogs
- Scrollable permission list

## ✨ Interactive Elements

### Expandable Role Cards
- Click to expand/collapse
- Shows all permissions when expanded
- Chevron icon indicates state
- Smooth animation

### Permission Checkboxes
- Click to select/deselect
- Shows permission description
- Organized by category
- Easy to scan

### Search Bar
- Real-time filtering
- Search by name or email
- Shows result count
- Clear visual feedback

### Dialogs
- Modal overlay
- Scrollable content
- Clear actions
- Cancel and confirm buttons

## 🎯 User Flows

### Create Custom Role
1. Click "Create Custom Role" button
2. Enter role name and description
3. Select permissions by category
4. Click "Create Role"
5. See success toast
6. New role appears in list

### Assign Role to Employee
1. Search for employee
2. Click Edit button
3. Select role from dropdown
4. See permission count
5. Click "Assign Role"
6. See success toast
7. Employee list updates

### View Role Permissions
1. Click on role card
2. Card expands
3. See all permissions by category
4. Click again to collapse

---

**Visual Guide**: Complete UI/UX Layout
**Date**: May 2, 2026
**Status**: ✅ Ready for Implementation
