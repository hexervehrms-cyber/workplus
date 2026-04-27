# API Integration Quick Reference Guide

## Environment Setup

### Production (.env)
```env
VITE_API_URL=https://workplus-backend-sg3a.onrender.com
VITE_SOCKET_URL=https://workplus-backend-sg3a.onrender.com
VITE_APP_ENV=production
```

### Development (.env.local)
```env
VITE_API_URL=http://localhost:5000
VITE_SOCKET_URL=http://localhost:5000
VITE_APP_ENV=development
```

---

## API Client Usage

### Import Services
```typescript
import {
  AuthService,
  UserService,
  EmployeeService,
  ExpenseService,
  LeaveRequestService,
  PayrollService,
  AdvanceLoanService,
  DocumentService,
  HolidayService
} from '@/app/utils/api';
```

### Authentication

#### Login
```typescript
try {
  const result = await AuthService.login(email, password);
  // result: { success: true, user: {...}, token: "..." }
  localStorage.setItem('authToken', result.token);
} catch (error) {
  console.error(error.message);
}
```

#### Get Current User
```typescript
const user = await AuthService.getCurrentUser();
// user: { id, name, email, role, avatar, organization }
```

#### Logout
```typescript
await AuthService.logout();
// Token automatically cleared
```

---

## Service Methods

### Employee Service

#### Get All Employees
```typescript
const employees = await EmployeeService.getAllEmployees();
// Returns: Employee[]
```

#### Get Employee by ID
```typescript
const employee = await EmployeeService.getEmployeeById(employeeId);
// Returns: Employee
```

#### Create Employee
```typescript
const newEmployee = await EmployeeService.createEmployee({
  name: 'John Doe',
  email: 'john@example.com',
  password: 'secure_password',
  department: 'Engineering',
  designation: 'Senior Developer',
  baseSalary: 50000,
  phone: '+1234567890',
  joiningDate: '2024-01-15'
});
```

#### Update Employee
```typescript
const updated = await EmployeeService.updateEmployee(employeeId, {
  name: 'Jane Doe',
  department: 'HR'
});
```

#### Delete Employee
```typescript
await EmployeeService.deleteEmployee(employeeId);
```

---

### Expense Service

#### Get All Expenses
```typescript
const expenses = await ExpenseService.getAllExpenses();
```

#### Get User Expenses
```typescript
const userExpenses = await ExpenseService.getExpensesByUserId(userId);
```

#### Create Expense
```typescript
const expense = await ExpenseService.createExpense({
  amount: 150.00,
  category: 'Travel',
  description: 'Client meeting travel',
  date: '2024-04-27',
  receipt: 'url_to_receipt'
});
```

#### Approve Expense
```typescript
const approved = await ExpenseService.approveExpense(expenseId);
```

#### Reject Expense
```typescript
const rejected = await ExpenseService.rejectExpense(expenseId, 'Reason for rejection');
```

#### Bulk Approve
```typescript
const results = await ExpenseService.bulkApproveExpenses([id1, id2, id3]);
```

#### Bulk Reject
```typescript
const results = await ExpenseService.bulkRejectExpenses([id1, id2, id3], 'Bulk rejection reason');
```

---

### Leave Request Service

#### Get All Leave Requests
```typescript
const leaves = await LeaveRequestService.getAllLeaveRequests();
```

#### Get User Leave Requests
```typescript
const userLeaves = await LeaveRequestService.getLeaveRequestsByUserId(userId);
```

#### Create Leave Request
```typescript
const leaveRequest = await LeaveRequestService.createLeaveRequest({
  startDate: '2024-05-01',
  endDate: '2024-05-05',
  leaveType: 'Vacation',
  reason: 'Family vacation',
  numberOfDays: 5
});
```

#### Approve Leave
```typescript
const approved = await LeaveRequestService.approveLeaveRequest(requestId);
```

#### Reject Leave
```typescript
const rejected = await LeaveRequestService.rejectLeaveRequest(requestId, 'Reason');
```

---

### Payroll Service

#### Get All Payslips
```typescript
const payslips = await PayrollService.getAllPayslips();
```

#### Get Employee Payslips
```typescript
const empPayslips = await PayrollService.getEmployeePayslips(employeeId);
```

#### Get My Payslips
```typescript
const myPayslips = await PayrollService.getMyPayslips();
```

#### Create Payslip
```typescript
const payslip = await PayrollService.createPayslip({
  employeeId: 'emp_123',
  month: 'April',
  year: 2024
});
// Backend automatically calculates:
// - Basic salary, HRA, allowances
// - Deductions (PF, tax, insurance)
// - Attendance-based bonuses
// - Gross and net salary
```

#### Mark Payslip as Paid
```typescript
const paid = await PayrollService.markPayslipAsPaid(payslipId);
```

---

### Advance/Loan Service

#### Get All Advances/Loans
```typescript
const requests = await AdvanceLoanService.getAllAdvancesLoans();
```

#### Get Employee Requests
```typescript
const empRequests = await AdvanceLoanService.getEmployeeAdvancesLoans(employeeId);
```

#### Get My Requests
```typescript
const myRequests = await AdvanceLoanService.getMyAdvancesLoans();
```

#### Create Request
```typescript
const request = await AdvanceLoanService.createAdvanceLoan({
  employeeId: 'emp_123',
  type: 'advance', // or 'loan'
  amount: 5000,
  reason: 'Emergency medical expense',
  numberOfInstallments: 3
});
```

#### Approve Request
```typescript
const approved = await AdvanceLoanService.approveAdvanceLoan(requestId);
```

#### Reject Request
```typescript
const rejected = await AdvanceLoanService.rejectAdvanceLoan(requestId, 'Reason');
```

#### Record Installment Payment
```typescript
const updated = await AdvanceLoanService.payInstallment(requestId);
```

---

### Document Service

#### Get User Documents
```typescript
const docs = await DocumentService.getDocumentsByUserId(userId);
```

#### Upload Document
```typescript
const uploaded = await DocumentService.uploadDocument({
  userId: 'user_123',
  name: 'Resume',
  type: 'resume',
  file: fileObject // From file input
});
```

---

### Holiday Service

#### Get All Holidays
```typescript
const holidays = await HolidayService.getAllHolidays();
```

#### Get Organization Holidays
```typescript
const orgHolidays = await HolidayService.getHolidaysByOrganization(orgId);
```

#### Create Holiday
```typescript
const holiday = await HolidayService.createHoliday({
  name: 'Independence Day',
  date: '2024-07-04',
  type: 'National',
  organizationId: 'org_123'
});
```

---

## Error Handling

### Try-Catch Pattern
```typescript
try {
  const data = await EmployeeService.getAllEmployees();
  setEmployees(data);
} catch (error: any) {
  console.error('Error:', error.message);
  toast.error(error.message || 'Failed to load employees');
}
```

### Error Object Structure
```typescript
{
  name: 'ApiError',
  message: 'Error message',
  status: 400,
  details: { /* backend response */ }
}
```

### Common Error Messages
- `"Network error - unable to reach server"` - Backend unreachable
- `"Invalid credentials"` - Login failed
- `"Access denied"` - Insufficient permissions
- `"Failed to create employee"` - Validation or server error

---

## Response Handling

### Standard Response Format
```typescript
{
  success: boolean,
  data?: T,
  message?: string,
  error?: string
}
```

### Service Methods Return
All service methods return the `data` field directly:
```typescript
// Backend returns:
{ success: true, data: { id: 1, name: 'John' } }

// Service returns:
{ id: 1, name: 'John' }
```

---

## Token Management

### Automatic Token Handling
```typescript
// Token automatically added to all requests
// Authorization: Bearer {token}

// Token stored in localStorage
localStorage.getItem('authToken')

// Token cleared on logout
localStorage.removeItem('authToken')
```

### Manual Token Operations
```typescript
import { apiClient } from '@/app/utils/api';

// Set token
apiClient.setToken(token);

// Get token
const token = apiClient.getToken();

// Clear token
apiClient.clearToken();
```

---

## Common Patterns

### Loading State
```typescript
const [loading, setLoading] = useState(false);

const fetchData = async () => {
  try {
    setLoading(true);
    const data = await EmployeeService.getAllEmployees();
    setEmployees(data);
  } catch (error) {
    toast.error(error.message);
  } finally {
    setLoading(false);
  }
};
```

### Form Submission
```typescript
const handleSubmit = async (formData: any) => {
  try {
    setLoading(true);
    const result = await EmployeeService.createEmployee(formData);
    toast.success('Employee created successfully');
    // Refresh list or navigate
  } catch (error) {
    toast.error(error.message);
  } finally {
    setLoading(false);
  }
};
```

### Bulk Operations
```typescript
const handleBulkApprove = async (selectedIds: string[]) => {
  try {
    const results = await ExpenseService.bulkApproveExpenses(selectedIds);
    toast.success(`${results.length} expenses approved`);
    // Refresh list
  } catch (error) {
    toast.error(error.message);
  }
};
```

---

## Debugging

### Enable Debug Logging
```typescript
// In .env
VITE_ENABLE_DEBUG=true

// In code
if (import.meta.env.VITE_ENABLE_DEBUG) {
  console.log('API Call:', endpoint, data);
}
```

### Check Network Requests
1. Open DevTools (F12)
2. Go to Network tab
3. Filter by XHR/Fetch
4. Check request headers and response

### Common Issues

#### "Network error - unable to reach server"
- Check backend is running
- Check VITE_API_URL is correct
- Check CORS configuration

#### "Invalid token"
- Token may have expired
- Try logging out and back in
- Check localStorage for authToken

#### "Access denied"
- User role may not have permission
- Check user role in localStorage
- Verify backend authorization

---

## Best Practices

1. **Always use try-catch** for API calls
2. **Show loading states** during API calls
3. **Display error messages** to users
4. **Validate input** before sending
5. **Handle token expiration** gracefully
6. **Use proper TypeScript types**
7. **Log errors** for debugging
8. **Test with real backend** before deployment

---

## Useful Links

- Backend API: https://workplus-backend-sg3a.onrender.com
- API Documentation: See FRONTEND_BACKEND_INTEGRATION_AUDIT.md
- Error Handling: See error handling section above
- Environment Setup: See environment setup section above

---

**Last Updated:** April 27, 2026  
**Status:** Production Ready ✅
