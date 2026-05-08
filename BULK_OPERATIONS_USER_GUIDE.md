# Bulk Operations & Password Reset User Guide

## Quick Start

### Accessing Bulk Operations
1. Log in as Admin
2. Navigate to **Admin Dashboard**
3. Click **Bulk Operations** in the left sidebar
4. Select the data type: **Employees**, **Expenses**, or **Assets**

### Accessing Password Reset
1. Log in as Admin
2. Navigate to **Admin → Employees**
3. Find the employee card
4. Click **Reset Password** button
5. Enter new password and confirm

---

## Bulk Operations Guide

### Export Data

#### Step 1: Select Data Type
- Click on the tab: **Employees**, **Expenses**, or **Assets**

#### Step 2: Choose Format
- **CSV**: For Excel, Google Sheets, or other spreadsheet applications
- **JSON**: For data integration, backups, or API usage

#### Step 3: Download
- Click the export button
- File will download automatically with timestamp

#### Example Filenames
- `employees-1714761600000.csv`
- `expenses-1714761600000.json`
- `assets-1714761600000.csv`

### Import Data

#### Step 1: Prepare File
- Use CSV or JSON format
- Ensure file matches the export format
- Maximum file size: 5MB

#### Step 2: Select File
- Click **Choose File to Import**
- Select format (CSV or JSON)
- Click file upload area or drag-and-drop

#### Step 3: Import
- Click **Import** button
- Wait for processing
- Review results

#### Step 4: Review Results
- **Success**: Shows number of records imported
- **Errors**: Lists failed records with reasons
- **Summary**: Total processed, successful, and failed counts

### CSV Format Examples

#### Employees CSV
```
Employee Code,Name,Email,Designation,Department,Joining Date,Phone,Status,Base Salary,HRA,Bonus
EMP001,John Doe,john@company.com,Software Engineer,Engineering,2024-01-15,+1-555-0001,active,50000,5000,2500
EMP002,Jane Smith,jane@company.com,Product Manager,Product,2024-02-20,+1-555-0002,active,60000,6000,3000
```

#### Expenses CSV
```
Date,Employee Code,Category,Description,Amount,Status,Submitted By,Submitted Date
2024-05-01,EMP001,Travel,Flight to NYC,500,approved,Admin,2024-05-02
2024-05-02,EMP002,Meals,Team lunch,150,pending,Admin,2024-05-03
```

#### Assets CSV
```
Asset Name,Asset Type,Category,Model,Serial Number,Brand,Purchase Price,Current Value,Purchase Date,Status,Condition,Assigned To,Assignment Date,Location
Laptop,Electronics,Computer,MacBook Pro,SN123456,Apple,1500,1200,2024-01-01,assigned,good,John Doe,2024-01-15,Office A
Monitor,Electronics,Display,Dell U2720Q,SN789012,Dell,400,300,2024-01-01,available,excellent,,
```

### JSON Format Example

```json
{
  "exportDate": "2024-05-03T10:30:00.000Z",
  "organizationId": "org_123",
  "totalEmployees": 2,
  "employees": [
    {
      "employeeCode": "EMP001",
      "name": "John Doe",
      "email": "john@company.com",
      "designation": "Software Engineer",
      "department": "Engineering",
      "joiningDate": "2024-01-15",
      "phone": "+1-555-0001",
      "status": "active",
      "baseSalary": 50000,
      "hra": 5000,
      "bonus": 2500
    }
  ]
}
```

---

## Password Reset Guide

### Step 1: Open Employee Card
- Go to **Admin → Employees**
- Find the employee whose password needs to be reset

### Step 2: Click Reset Password
- Click the **Reset Password** button on the employee card
- A modal will open showing employee details

### Step 3: Enter New Password
- Enter the new password (minimum 6 characters)
- Confirm the password by entering it again
- Passwords must match

### Step 4: Confirm Reset
- Click **Reset Password** button
- Wait for confirmation
- Success message will appear

### Step 5: Notify Employee
- Share the new password with the employee securely
- Employee can log in with the new password
- Employee should change password on first login

### Password Requirements
- ✅ Minimum 6 characters
- ✅ Can contain letters, numbers, and special characters
- ✅ Case-sensitive

### Example Passwords
- ✅ `NewPass123`
- ✅ `Secure@2024`
- ✅ `MyPassword!`
- ❌ `123` (too short)
- ❌ `pass` (too short)

---

## Common Tasks

### Export All Employees
1. Go to **Bulk Operations**
2. Select **Employees** tab
3. Click **Export as CSV** or **Export as JSON**
4. File downloads automatically

### Update Multiple Employees
1. Export employees as CSV
2. Edit the CSV file in Excel
3. Save the file
4. Go to **Bulk Operations**
5. Select **Employees** tab
6. Click **Choose File to Import**
7. Select the edited CSV file
8. Click **Import**

### Backup All Data
1. Go to **Bulk Operations**
2. Export **Employees** as JSON
3. Export **Expenses** as JSON
4. Export **Assets** as JSON
5. Store files in secure location

### Reset Employee Password
1. Go to **Admin → Employees**
2. Find employee
3. Click **Reset Password**
4. Enter new password
5. Click **Reset Password**
6. Notify employee of new password

---

## Troubleshooting

### Import Fails with "Invalid File Format"
- **Solution**: Ensure file is CSV or JSON
- **Solution**: Check file extension (.csv or .json)
- **Solution**: Verify file size is less than 5MB

### Import Shows "No Records Processed"
- **Solution**: Check if file is empty
- **Solution**: Verify file format matches export format
- **Solution**: Check column headers match expected format

### Password Reset Shows "Employee Not Found"
- **Solution**: Verify employee ID is correct
- **Solution**: Check employee hasn't been deleted
- **Solution**: Refresh page and try again

### Export Button Doesn't Work
- **Solution**: Check internet connection
- **Solution**: Verify you're logged in as admin
- **Solution**: Try different browser
- **Solution**: Clear browser cache

### Import Shows Partial Success
- **Solution**: Review error messages for failed records
- **Solution**: Fix errors in source file
- **Solution**: Re-import corrected file

---

## Best Practices

### For Exports
✅ Export regularly for backups
✅ Store exports in secure location
✅ Include timestamp in filename
✅ Verify data before sharing
✅ Use JSON for backups, CSV for spreadsheets

### For Imports
✅ Always backup before importing
✅ Test with small file first
✅ Verify data format before importing
✅ Review import results carefully
✅ Keep original file for reference

### For Password Resets
✅ Use strong passwords (8+ characters recommended)
✅ Include mix of letters, numbers, special characters
✅ Notify employee immediately
✅ Document password reset in audit log
✅ Ask employee to change password on first login

---

## Security Notes

⚠️ **Important**: 
- Only admins can access bulk operations
- Only admins can reset passwords
- All operations are logged for audit trail
- Exported data may contain sensitive information
- Store exports securely
- Don't share passwords via email
- Use secure channels for password communication

---

## Support

For issues or questions:
1. Check this guide first
2. Review error messages carefully
3. Contact system administrator
4. Check audit logs for details

---

**Last Updated**: May 3, 2026
**Version**: 1.0
