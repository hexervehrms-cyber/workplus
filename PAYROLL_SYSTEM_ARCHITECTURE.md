# Payroll System Architecture

## System Overview

The WorkPlus Payroll System is a comprehensive solution for calculating, managing, and tracking employee payroll with support for multiple salary types, automatic working days calculation, and FNF (Full and Final) settlement.

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                     FRONTEND (React + TypeScript)               │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │         PayrollCalculation Component                     │  │
│  │  ┌────────────────────────────────────────────────────┐  │  │
│  │  │ • Payroll Calculation Form                         │  │  │
│  │  │ • Employee Selection                               │  │  │
│  │  │ • Date Range Picker                                │  │  │
│  │  │ • Salary Components Input                          │  │  │
│  │  │ • Deductions Input                                 │  │  │
│  │  └────────────────────────────────────────────────────┘  │  │
│  │  ┌────────────────────────────────────────────────────┐  │  │
│  │  │ • Payroll Table View                               │  │  │
│  │  │ • Search & Filter                                  │  │  │
│  │  │ • Status Tracking                                  │  │  │
│  │  │ • Action Buttons                                   │  │  │
│  │  └────────────────────────────────────────────────────┘  │  │
│  │  ┌────────────────────────────────────────────────────┐  │  │
│  │  │ • FNF Calculator Modal                             │  │  │
│  │  │ • Settlement Details Display                       │  │  │
│  │  │ • Leave Encashment Calculation                     │  │  │
│  │  └────────────────────────────────────────────────────┘  │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                 │
│  Route: /admin/payroll                                          │
│  Protected: Admin role required                                 │
│  Layout: MainLayout with Sidebar                               │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
                              ↓
                    API Calls with Auth Token
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                    BACKEND (Node.js + Express)                  │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │         Payroll Routes (/api/payroll)                   │  │
│  │  ┌────────────────────────────────────────────────────┐  │  │
│  │  │ GET /api/payroll                                   │  │  │
│  │  │ • Fetch all payrolls for organization              │  │  │
│  │  │ • Requires: Authentication                         │  │  │
│  │  └────────────────────────────────────────────────────┘  │  │
│  │  ┌────────────────────────────────────────────────────┐  │  │
│  │  │ POST /api/payroll/calculate                        │  │  │
│  │  │ • Calculate payroll for employee                   │  │  │
│  │  │ • Calls: calculateWorkingDays()                    │  │  │
│  │  │ • Requires: Admin/HR role                          │  │  │
│  │  └────────────────────────────────────────────────────┘  │  │
│  │  ┌────────────────────────────────────────────────────┐  │  │
│  │  │ GET /api/payroll/:id                               │  │  │
│  │  │ • Get payroll details                              │  │  │
│  │  │ • Requires: Authentication                         │  │  │
│  │  └────────────────────────────────────────────────────┘  │  │
│  │  ┌────────────────────────────────────────────────────┐  │  │
│  │  │ GET /api/payroll/employee/:employeeId              │  │  │
│  │  │ • Get employee payroll history                     │  │  │
│  │  │ • Requires: Authentication                         │  │  │
│  │  └────────────────────────────────────────────────────┘  │  │
│  │  ┌────────────────────────────────────────────────────┐  │  │
│  │  │ PUT /api/payroll/:id/approve                       │  │  │
│  │  │ • Approve payroll                                  │  │  │
│  │  │ • Requires: Admin/HR role                          │  │  │
│  │  └────────────────────────────────────────────────────┘  │  │
│  │  ┌────────────────────────────────────────────────────┐  │  │
│  │  │ PUT /api/payroll/:id/mark-paid                     │  │  │
│  │  │ • Mark payroll as paid                             │  │  │
│  │  │ • Requires: Admin/HR role                          │  │  │
│  │  └────────────────────────────────────────────────────┘  │  │
│  │  ┌────────────────────────────────────────────────────┐  │  │
│  │  │ GET /api/payroll/fnf/calculate/:employeeId         │  │  │
│  │  │ • Calculate FNF settlement                         │  │  │
│  │  │ • Requires: Admin/HR role                          │  │  │
│  │  └────────────────────────────────────────────────────┘  │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │         Calculation Engine                              │  │
│  │  ┌────────────────────────────────────────────────────┐  │  │
│  │  │ calculateWorkingDays()                             │  │  │
│  │  │ • Count total days in range                        │  │  │
│  │  │ • Deduct Sundays (week-offs)                       │  │  │
│  │  │ • Deduct holidays from Holiday model               │  │  │
│  │  │ • Deduct approved leaves from LeaveRequest         │  │  │
│  │  │ • Track sandwich leaves separately                 │  │  │
│  │  │ • Return: workingDays, weekOffs, holidays, etc.    │  │  │
│  │  └────────────────────────────────────────────────────┘  │  │
│  │  ┌────────────────────────────────────────────────────┐  │  │
│  │  │ Salary Calculations                                │  │  │
│  │  │ • Per-day salary = Base Salary / 30                │  │  │
│  │  │ • Gross = (Per-day × Working Days) + Components    │  │  │
│  │  │ • Net = Gross - Deductions                         │  │  │
│  │  │ • FNF = Total Earnings + Leave Encashment          │  │  │
│  │  └────────────────────────────────────────────────────┘  │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
                              ↓
                    Database Queries
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                    DATABASE (MongoDB)                           │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ PayrollCalculation Collection                           │  │
│  │ • employeeId (ref: Employee)                            │  │
│  │ • userId (ref: User)                                    │  │
│  │ • orgId (ref: Organization)                             │  │
│  │ • baseSalary, perDaySalary                              │  │
│  │ • fromDate, toDate                                      │  │
│  │ • workingDays, weekOffs, holidays, leaves               │  │
│  │ • components (basic, HRA, dearness, etc.)               │  │
│  │ • deductions (PF, ESI, tax, advance, loan, bond)        │  │
│  │ • earnings (bonus, incentive, commission)               │  │
│  │ • totalEarnings, totalDeductions, netSalary             │  │
│  │ • status (draft, calculated, approved, paid)            │  │
│  │ • approvedBy, approvedDate, paidDate                    │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ Related Collections (Read-Only)                         │  │
│  │ • Employee (for salary data)                            │  │
│  │ • Holiday (for holiday dates)                           │  │
│  │ • LeaveRequest (for leave data)                         │  │
│  │ • Attendance (for present days - future)                │  │
│  │ • SalaryCycle (for cycle management - future)           │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

## Data Flow

### 1. Payroll Calculation Flow

```
User Input (Form)
    ↓
Employee Selection + Date Range + Salary Components
    ↓
Frontend Validation
    ↓
POST /api/payroll/calculate
    ↓
Backend Validation
    ↓
calculateWorkingDays()
    ├─ Query Holiday collection
    ├─ Query LeaveRequest collection
    └─ Calculate: Total - Sundays - Holidays - Leaves
    ↓
Calculate Salaries
    ├─ Per-day = Base / 30
    ├─ Gross = (Per-day × Working Days) + Components
    └─ Net = Gross - Deductions
    ↓
Create PayrollCalculation Record
    ├─ Status: "calculated"
    └─ Save to MongoDB
    ↓
Return to Frontend
    ↓
Display in Table
    ↓
User can Approve or Mark as Paid
```

### 2. FNF Calculation Flow

```
User Selects Employee
    ↓
GET /api/payroll/fnf/calculate/:employeeId
    ↓
Query PayrollCalculation (all records for employee)
    ↓
Calculate Totals
    ├─ Total Earnings = Sum of all earnings
    ├─ Total Deductions = Sum of all deductions
    └─ Total Net = Earnings - Deductions
    ↓
Query LeaveRequest (pending leaves)
    ↓
Calculate Leave Encashment
    └─ Pending Leaves × (Base Salary / 30)
    ↓
Calculate FNF Amount
    └─ Total Net + Leave Encashment - Adjustments
    ↓
Return to Frontend
    ↓
Display Settlement Details
    ↓
User can Generate FNF Letter (future)
```

## Component Structure

### Frontend Components

```
PayrollCalculation.tsx
├── State Management
│   ├── payrolls (array)
│   ├── employees (array)
│   ├── loading (boolean)
│   ├── submitting (boolean)
│   ├── showCalculateForm (boolean)
│   ├── showFNFCalculator (boolean)
│   ├── searchTerm (string)
│   ├── filterStatus (string)
│   ├── formData (object)
│   └── fnfData (object)
│
├── Effects
│   ├── useEffect (fetch payrolls and employees)
│   └── useEffect (handle form submission)
│
├── Handlers
│   ├── fetchPayrolls()
│   ├── fetchEmployees()
│   ├── handleCalculatePayroll()
│   ├── handleCalculateFNF()
│   ├── handleApprovePayroll()
│   ├── handleMarkPaid()
│   └── filteredPayrolls (computed)
│
└── UI Sections
    ├── Header (title + buttons)
    ├── Search & Filter
    ├── Payroll Table
    ├── Calculate Payroll Modal
    └── FNF Calculator Modal
```

### Backend Routes

```
payroll-calculation.js
├── Middleware
│   ├── authenticate (verify token)
│   ├── authorize (check roles)
│   └── asyncHandler (error handling)
│
├── Utilities
│   └── calculateWorkingDays()
│       ├── Count total days
│       ├── Query holidays
│       ├── Query leaves
│       ├── Count Sundays
│       └── Return breakdown
│
├── Routes
│   ├── GET / (fetch all payrolls)
│   ├── POST /calculate (create payroll)
│   ├── GET /:id (get payroll)
│   ├── GET /employee/:employeeId (get employee payrolls)
│   ├── PUT /:id/approve (approve payroll)
│   ├── PUT /:id/mark-paid (mark as paid)
│   └── GET /fnf/calculate/:employeeId (calculate FNF)
│
└── Database Operations
    ├── PayrollCalculation.find()
    ├── PayrollCalculation.create()
    ├── PayrollCalculation.updateOne()
    ├── Holiday.find()
    ├── LeaveRequest.find()
    └── Employee.findById()
```

## Database Schema

### PayrollCalculation Collection

```javascript
{
  _id: ObjectId,
  
  // References
  employeeId: ObjectId (ref: Employee),
  userId: ObjectId (ref: User),
  orgId: ObjectId (ref: Organization),
  
  // Salary Type
  salaryType: String (enum: salary, stipend, commission, bonus, mixed),
  baseSalary: Number,
  perDaySalary: Number,
  
  // Date Range
  fromDate: Date,
  toDate: Date,
  
  // Working Days Breakdown
  totalDays: Number,
  weekOffs: Number,
  holidays: Number,
  leaves: Number,
  sandwichLeaves: Number,
  workingDays: Number,
  presentDays: Number,
  
  // Salary Components
  components: {
    basic: Number,
    hra: Number,
    dearness: Number,
    conveyance: Number,
    medical: Number,
    other: Number
  },
  
  // Deductions
  deductions: {
    pf: Number,
    esi: Number,
    tax: Number,
    advance: Number,
    loan: Number,
    bond: Number,
    other: Number
  },
  
  // Earnings
  earnings: {
    grossSalary: Number,
    bonus: Number,
    incentive: Number,
    commission: Number,
    other: Number
  },
  
  // Calculations
  totalEarnings: Number,
  totalDeductions: Number,
  netSalary: Number,
  
  // Salary Cycle
  salaryCycleId: ObjectId (ref: SalaryCycle),
  salaryCycleName: String,
  cycleStartDate: Date,
  cycleEndDate: Date,
  paymentDate: Date,
  
  // Status
  status: String (enum: draft, calculated, approved, paid, cancelled),
  
  // Approval
  approvedBy: ObjectId (ref: User),
  approvedDate: Date,
  paidDate: Date,
  
  // Notes
  notes: String,
  
  // Metadata
  createdAt: Date,
  updatedAt: Date
}
```

## Security Architecture

### Authentication
- Bearer token in Authorization header
- Token fallback: `localStorage.getItem('authToken') || localStorage.getItem('token')`
- Verified on every API call

### Authorization
- Role-based access control (RBAC)
- Allowed roles: admin, hr, super_admin
- Organization-level data isolation
- User can only access their organization's data

### Data Protection
- All sensitive data stored in database
- No sensitive data in frontend state
- HTTPS for all API calls (in production)
- Input validation on both frontend and backend

## Performance Considerations

### Database Queries
- Indexed queries on employeeId, orgId, status
- Populate references efficiently
- Limit result sets with pagination (future)

### Frontend Optimization
- Lazy loading of components
- Memoization of expensive calculations
- Efficient state management
- Debounced search

### Caching
- Employee list cached in state
- Payroll list cached in state
- Refresh on demand

## Error Handling

### Frontend
- Try-catch blocks in async functions
- Toast notifications for user feedback
- Graceful error messages
- Fallback UI states

### Backend
- asyncHandler middleware for error catching
- Proper HTTP status codes
- Detailed error logging
- User-friendly error messages

## Logging

### Backend Logging
- Info logs for successful operations
- Error logs for failures
- Audit logs for sensitive operations
- Structured logging with context

### Frontend Logging
- Console errors for debugging
- Toast notifications for user feedback
- Error tracking (future)

## Scalability

### Current Capacity
- Supports unlimited employees
- Supports unlimited payroll records
- Supports unlimited organizations

### Future Improvements
- Pagination for large datasets
- Caching layer (Redis)
- Batch processing for bulk operations
- Async job queue for heavy calculations

## Deployment

### Frontend
- Built with Vite
- Deployed to CDN or static hosting
- Environment variables for API endpoints

### Backend
- Node.js with Express
- Deployed to cloud platform
- Environment variables for database and secrets
- Horizontal scaling ready

### Database
- MongoDB Atlas or self-hosted
- Proper indexing
- Backup and recovery procedures
- Replication for high availability

---

**Architecture Version**: 1.0
**Last Updated**: May 3, 2026
**Status**: ✅ Production Ready
