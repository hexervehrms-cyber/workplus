# Leave Allocation System - Quick Start Guide

## For Admins

### Step 1: Access Leave Allocation
1. Login to Admin Panel
2. Navigate to **Leave Management** → **Leave Allocation**
3. You'll see a list of all allocations for the current month

### Step 2: Filter by Month/Year
1. Use the **Year** dropdown to select the year
2. Use the **Month** dropdown to select the month
3. The table will automatically update

### Step 3: Add New Allocation
1. Click **"Add Allocation"** button
2. Select an **Employee** from the dropdown
3. Enter the number of days for each leave type:
   - Vacation
   - Sick Leave
   - Casual Leave
   - Maternity Leave
   - Paternity Leave
   - Compensatory Off
   - Personal
   - Emergency
   - NCNS (No Call No Show)
   - Sandwich Leave
4. Click **"Save Allocation"**

### Step 4: Edit Allocation
1. Click the **Edit** button (pencil icon) on any row
2. Modify the leave days as needed
3. Click **"Save Allocation"**

### Step 5: Delete Allocation
1. Click the **Delete** button (trash icon) on any row
2. Confirm the deletion

### Step 6: Bulk Allocate (API)
Use the bulk allocation endpoint to allocate leaves to multiple employees at once:
```bash
POST /api/leave-allocation/bulk-allocate
{
  "orgId": "org123",
  "year": 2025,
  "month": 1,
  "employees": ["emp1", "emp2", "emp3"],
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
  "allocatedBy": "admin123"
}
```

## For Employees

### Step 1: View Leave Balance
1. Login to Employee Portal
2. Navigate to **Leave** from the sidebar
3. You'll see **Leave Balance KPI Cards** showing:
   - **Total**: Total days allocated for the month
   - **Used**: Days already used (approved leaves)
   - **Pending**: Days pending approval
   - **Remaining**: Available days to apply

### Step 2: Apply for Leave
1. Click **"Request Leave"** button
2. Select **Leave Type** from dropdown
3. Select **From Date** and **To Date**
4. Enter **Reason** for leave
5. System will automatically calculate days and check balance
6. If balance is insufficient, you'll see an error message
7. Click **"Submit Request"** to apply

### Step 3: View Leave History
1. Scroll down to see **Leave History** section
2. View all your leave requests with status:
   - **Approved** (green) - Leaves deducted from balance
   - **Pending** (yellow) - Awaiting approval
   - **Rejected** (red) - Request denied

### Step 4: Monitor Balance
- Balance updates automatically when:
  - Admin allocates new leaves
  - You submit a leave request
  - Admin approves/rejects your request
  - Leaves are deducted/restored

## Leave Types Explained

| Leave Type | Purpose | Typical Usage |
|-----------|---------|---------------|
| **Vacation** | Planned time off | Holidays, trips |
| **Sick Leave** | Medical reasons | Illness, doctor visits |
| **Casual Leave** | General purpose | Personal work |
| **Maternity Leave** | Post-pregnancy | New mothers |
| **Paternity Leave** | Post-birth support | New fathers |
| **Compensatory Off** | Comp Off | Worked on holiday |
| **Personal** | Personal matters | Urgent personal work |
| **Emergency** | Emergency situations | Unexpected events |
| **NCNS** | No Call No Show | Unplanned absence |
| **Sandwich Leave** | Between holidays | Extended breaks |

## Balance Calculation

```
Available = (Allocated + Carried Forward) - Used - Pending
```

**Example:**
- Allocated: 2 days
- Carried Forward: 0 days
- Used: 0 days
- Pending: 1 day
- **Available: 1 day**

## Common Scenarios

### Scenario 1: Employee Applies for Leave
1. Admin allocates 2 vacation days for January
2. Employee applies for 1 day vacation
3. System deducts 1 day (Pending: 1, Available: 1)
4. Admin approves the request
5. System marks as Used (Used: 1, Available: 1)

### Scenario 2: Insufficient Balance
1. Admin allocates 1 sick leave day
2. Employee tries to apply for 2 days
3. System shows error: "Insufficient Sick Leave balance. Available: 1 days"
4. Employee cannot submit request

### Scenario 3: Request Rejected
1. Employee applies for 1 day personal leave
2. Admin rejects the request
3. System restores the day to available balance
4. Employee can apply again

## Tips & Best Practices

1. **Monthly Allocation**: Allocate leaves at the beginning of each month
2. **Bulk Allocation**: Use bulk allocation for consistent leave policies
3. **Carry Forward**: Plan for carry forward leaves from previous month
4. **Balance Monitoring**: Check employee balances regularly
5. **Leave Policies**: Define clear leave policies before allocation
6. **Documentation**: Keep notes on special allocations

## Troubleshooting

### Issue: "No leave allocation found for this month"
**Solution**: Admin needs to create allocation for the employee for that month

### Issue: "Insufficient balance" error
**Solution**: 
- Check if allocation was created
- Verify the allocated days
- Check if leaves were already used

### Issue: Balance not updating
**Solution**:
- Refresh the page
- Check if request was submitted successfully
- Verify admin approved/rejected the request

### Issue: Cannot see Leave Allocation menu
**Solution**:
- Ensure you're logged in as Admin
- Check if you have admin role permissions
- Try logging out and logging back in

## Support

For issues or questions:
1. Contact your HR/Admin team
2. Check the system logs
3. Verify all required fields are filled
4. Ensure dates are in correct format (YYYY-MM-DD)
