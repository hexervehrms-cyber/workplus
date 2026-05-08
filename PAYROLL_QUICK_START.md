# Payroll System - Quick Start Guide

## 🚀 Getting Started

### Access the Payroll System
1. Login to WorkPlus as Admin
2. Click **"Payroll"** in the left sidebar (under Admin section)
3. You'll see the Payroll Management dashboard

## 📊 Main Features

### 1. Calculate Payroll
**Purpose**: Calculate salary for an employee for a specific period

**Steps**:
1. Click **"Calculate Payroll"** button (top right)
2. Fill in the form:
   - **Employee**: Select from dropdown
   - **From Date**: Start date of payroll period
   - **To Date**: End date of payroll period
   - **Base Salary**: Auto-populated from employee record (can edit)
   - **Bonus**: Optional bonus amount
   - **Incentive**: Optional incentive amount
   - **Advance Salary**: Deduct advance if any
   - **Loan Deduction**: Deduct loan if any
   - **Notes**: Add any notes
3. Click **"Calculate"**
4. Payroll is created with "calculated" status

**What Happens Automatically**:
- Working days are calculated (excluding Sundays, holidays, leaves)
- Per-day salary is calculated (Base Salary / 30)
- Gross salary = (Per-day salary × Working days) + Components
- Net salary = Gross salary - Deductions

### 2. Approve Payroll
**Purpose**: Approve calculated payroll before payment

**Steps**:
1. Find the payroll with **"calculated"** status in the table
2. Click the **green checkmark icon** in the Actions column
3. Status changes to **"approved"**

### 3. Mark as Paid
**Purpose**: Mark approved payroll as paid

**Steps**:
1. Find the payroll with **"approved"** status in the table
2. Click the **blue clock icon** in the Actions column
3. Status changes to **"paid"**

### 4. Calculate FNF (Full and Final Settlement)
**Purpose**: Calculate final settlement amount when employee leaves

**Steps**:
1. Click **"FNF Calculator"** button (top right)
2. Select the employee from dropdown
3. Click **"Calculate FNF"**
4. View the settlement details:
   - **Total Earnings**: All earnings till date
   - **Total Deductions**: All deductions till date
   - **Net Salary**: Earnings - Deductions
   - **Pending Leaves**: Number of unused leaves
   - **Leave Encashment**: Value of pending leaves
   - **Total FNF Amount**: Final amount to be paid
5. Click **"Generate FNF Letter"** to create PDF (if implemented)

## 🔍 Search and Filter

### Search
- Use the search box to find payroll by:
  - Employee name
  - Employee code

### Filter by Status
- **All Status**: Show all payrolls
- **Draft**: Payrolls not yet calculated
- **Calculated**: Ready for approval
- **Approved**: Approved, ready for payment
- **Paid**: Already paid

## 📋 Payroll Table Columns

| Column | Description |
|--------|-------------|
| Employee | Employee name and code |
| Period | From date to To date |
| Working Days | Calculated working days |
| Gross Salary | Total earnings |
| Deductions | Total deductions |
| Net Salary | Final amount to pay |
| Status | Current status |
| Actions | View, Approve, Mark Paid buttons |

## 💡 Key Calculations

### Working Days
```
Working Days = Total Days - Sundays - Holidays - Leaves - Sandwich Leaves
```

### Per-Day Salary
```
Per-Day Salary = Base Salary / 30
```

### Gross Salary
```
Gross Salary = (Per-Day Salary × Working Days) + Components
```

### Net Salary
```
Net Salary = Gross Salary - Deductions
```

### FNF Amount
```
FNF Amount = Total Net Salary + Leave Encashment - Adjustments
```

## ⚙️ Supported Salary Types

- **Salary**: Fixed monthly salary
- **Stipend**: Fixed stipend amount
- **Commission**: Commission-based salary
- **Bonus**: Bonus-based salary
- **Mixed**: Combination of above

## 📝 Salary Components

### Earnings
- Basic Salary
- HRA (House Rent Allowance)
- Dearness Allowance
- Conveyance Allowance
- Medical Allowance
- Other Allowances
- Bonus
- Incentive
- Commission

### Deductions
- PF (Provident Fund)
- ESI (Employee State Insurance)
- Income Tax
- Advance Salary
- Loan
- Bond
- Other Deductions

## 🔐 Permissions

Only users with these roles can access Payroll:
- **Admin**
- **HR**
- **Super Admin**

## ❓ Common Questions

### Q: How are working days calculated?
A: Working days = Total days in period - Sundays - Holidays - Approved leaves - Sandwich leaves

### Q: Can I edit a payroll after calculating?
A: Currently, you need to create a new payroll. Editing is not yet implemented.

### Q: What if an employee joined mid-month?
A: The system calculates based on the date range you provide. It automatically adjusts working days.

### Q: How is FNF calculated?
A: FNF = Total earnings till date + Leave encashment - Deductions

### Q: Can I calculate payroll for multiple employees at once?
A: Currently, you need to calculate individually. Bulk calculation is planned for future.

### Q: Where are payslips?
A: Payslip generation is planned for future implementation.

## 🆘 Troubleshooting

### Issue: Employee not showing in dropdown
- **Solution**: Ensure employee is created and active in the system

### Issue: Working days showing as 0
- **Solution**: Check if date range is valid and employee has no leaves/holidays

### Issue: Cannot approve payroll
- **Solution**: Ensure payroll status is "calculated" before approving

### Issue: FNF calculation shows 0
- **Solution**: Ensure employee has payroll records in the system

## 📞 Support

For issues or questions:
1. Check the troubleshooting section above
2. Verify employee data is correct
3. Check browser console for errors
4. Contact system administrator

---

**Version**: 1.0
**Last Updated**: May 3, 2026
**Status**: ✅ Ready to Use
