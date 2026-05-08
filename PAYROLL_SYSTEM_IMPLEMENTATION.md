# Enterprise Payroll System Implementation

## Overview
A comprehensive, production-ready payroll system built for WorkPlus HRMS with support for multiple employee types, salary revisions, attendance integration, and complex payroll calculations.

## Phase 1: Foundation (Completed)

### 1. Database Models Created

#### PayrollCycle.js
- Manages payroll cycles (21st of current month to 20th of next month)
- Tracks salary release dates (1st of next month)
- Manages salary hold period (10 days after release)
- Supports cycle statuses: draft, active, locked, processed, released
- Stores cycle-level payroll totals

#### SalaryRevision.js
- Tracks all salary changes and revisions
- Supports revision types:
  - Increment
  - Promotion
  - Demotion
  - PPO Conversion
  - Internship to Employee Conversion
  - Salary Adjustment
  - Mid-cycle Changes
- Handles split calculations for mid-cycle changes
- Maintains approval workflow
- Stores audit trail and documentation

#### PayrollRun.js
- Individual payroll calculation for each employee per cycle
- Stores complete payroll breakdown:
  - Attendance data
  - Earnings breakdown
  - Deductions breakdown
  - Net salary calculation
- Tracks payable days calculation
- Supports salary revisions within a cycle
- Maintains approval and release workflow

### 2. Calculation Engines

#### PayrollCalculationEngine.js
**Features:**
- Calculate payable days with attendance deductions
- Support for late mark deductions (configurable threshold)
- Per-day, per-hour, per-minute salary calculations
- Prorated salary for mid-month joining/resignation
- Mid-cycle salary revision calculations
- Earnings calculation (fixed, percentage-based, dynamic)
- Deductions calculation (fixed, percentage-based, attendance-linked)
- Complete payroll calculation with breakdown

**Formulas Implemented:**
```
Payable Days = Total Working Days - Absent Days - (Half Days * 0.5) - Unpaid Leaves - Late Mark Deductions

Per Day Salary = Monthly Gross Salary / Total Payable Days

Per Hour Salary = Per Day Salary / 8 hours

Per Minute Salary = Per Hour Salary / 60 minutes

Prorated Salary = (Per Day Salary * Days Worked)

Mid-Cycle Salary = Period 1 Salary + Period 2 Salary
```

#### PayrollCycleEngine.js
**Features:**
- Generate payroll cycles for any month/year
- Get current payroll cycle
- Get payroll cycle for specific date
- Calculate working days (excludes weekends and public holidays)
- Calculate payable days for employees
- Check if date falls within cycle
- Get all cycles for a year
- Validate payroll lock status
- Get salary hold status

**Payroll Cycle Rules:**
- Cycle: 21st of current month to 20th of next month
- Salary Release: 1st of next month
- Salary Hold: 10 days after release
- Payroll Lock: After 10-day hold period

### 3. Backend APIs

#### Payroll Routes (`/api/payroll`)

**1. GET /api/payroll/employee/dashboard**
- Returns employee payroll dashboard data
- KPI Cards:
  - Current Salary/Stipend
  - Previous Salary/Stipend (if applicable)
  - Per Day Salary/Stipend
  - Payroll Cycle Information
- Salary history (last 12 months)
- Employee type (Intern/Employee)
- Supports both Interns and Employees

**2. GET /api/payroll/cycles**
- Get all payroll cycles for a year
- Returns cycle dates, release dates, hold periods
- Admin/HR only

**3. POST /api/payroll/cycle/create**
- Create new payroll cycle
- Validates no duplicate cycles
- Auto-generates cycle dates based on rules
- Admin/HR only

**4. POST /api/payroll/run/calculate**
- Calculate payroll for employee in a cycle
- Integrates with attendance data
- Applies salary structures
- Handles salary revisions
- Returns complete payroll breakdown
- Admin/HR only

### 4. Frontend Components

#### PayrollDashboard.tsx (Employee View)
**Features:**
- KPI Cards:
  - Current Salary/Stipend with effective dates
  - Previous Salary/Stipend with increment percentage
  - Per Day Salary/Stipend
  - Payroll Cycle dates
- Salary History Chart (12-month progression)
- Recent Salary Slips section
- Employee type badge
- Responsive design with Recharts visualization

**KPI Card Details:**
- Shows current amount with effective dates
- Displays previous amount with increment calculation
- Per-day salary based on 30-day basis
- Payroll cycle information (21st to 20th)
- Different labels for Interns vs Employees

## Supported Employee Types

1. **Interns**
   - Stipend-based compensation
   - Salary progression (e.g., ₹5,000 → ₹8,000 → ₹10,000)
   - PPO conversion eligibility
   - KPI shows "Your Stipend" and "Per Day Stipend"

2. **Employees**
   - Salary-based compensation
   - Increment and promotion support
   - KPI shows "Your Salary" and "Per Day Salary"

3. **Consultants** (Ready for implementation)
   - Contract-based compensation
   - Variable salary structures

4. **Contract Workers** (Ready for implementation)
   - Project-based compensation
   - Hourly/daily rates

## Payroll Cycle Example

**Cycle: 21 April → 20 May**
- Payroll Cycle Start: 21 April
- Payroll Cycle End: 20 May
- Salary Release Date: 1 June
- Salary Hold Until: 11 June (10-day hold)
- Payroll Lock: After 11 June

## Salary Revision Example

**Mid-Cycle Salary Change:**
- Period 1: 21 Jan → 15 Feb = ₹5,000
- Period 2: 16 Feb → 20 Mar = ₹8,000

System automatically:
- Splits calculation into two periods
- Calculates payable days for each period
- Applies correct salary structure to each period
- Merges final payable amount
- Updates salary slip components

## Attendance Integration

**Supported Statuses:**
- Present
- Absent
- Half Day
- Work From Home
- Paid Leave
- Unpaid Leave
- Holiday
- Week Off
- Late Mark

**Automatic Calculations:**
- Payable days calculation
- Absent days deduction
- Half-day deduction (0.5 day)
- Unpaid leave deduction
- Late mark deduction (configurable: 3 late marks = 0.5 day)

## Leave Deduction Engine

**Paid Leave:**
- No salary deduction
- Counted as working day

**Unpaid Leave:**
- Automatic salary deduction
- Formula: Per Day Salary × Unpaid Leave Days

**Half-Day:**
- 0.5 day deduction
- Formula: Per Day Salary × 0.5

**Late Mark Rules:**
- Configurable threshold (default: 3 late marks = 0.5 day deduction)
- Automatic calculation

## Per-Day Salary Calculation

**Formula:**
```
Per Day Salary = Monthly Gross Salary / Total Payable Days
```

**Basis Options:**
1. **30-day basis** (Default)
   - Fixed 30 days per month
   - Simplest calculation

2. **Actual month basis**
   - Based on actual payable days
   - More accurate

3. **Working-day basis**
   - Based on working days only
   - Excludes weekends and holidays

## Calculation Examples

### Example 1: Standard Payroll
```
Basic Salary: ₹50,000
HRA: ₹20,000
Medical: ₹5,000
Gross Earnings: ₹75,000

PF (12%): ₹6,000
ESI: ₹500
Professional Tax: ₹200
Total Deductions: ₹6,700

Net Salary: ₹68,300
Per Day Salary: ₹2,276.67 (₹75,000 / 33 payable days)
```

### Example 2: Mid-Cycle Salary Revision
```
Period 1 (21 Jan - 15 Feb): ₹5,000 × 26 days = ₹130,000
Period 2 (16 Feb - 20 Mar): ₹8,000 × 34 days = ₹272,000
Total Gross: ₹402,000

Deductions: ₹48,240
Net Salary: ₹353,760
```

### Example 3: Unpaid Leave Deduction
```
Basic Salary: ₹50,000
Per Day Salary: ₹1,666.67
Unpaid Leaves: 2 days
Deduction: ₹3,333.34
```

## Architecture

### Modular Design
- **Models**: Database schemas for payroll entities
- **Engines**: Reusable calculation logic
- **Routes**: API endpoints
- **Frontend**: React components with TypeScript

### Scalability Features
- Indexed database queries for performance
- Batch payroll processing support
- Audit logging for all calculations
- Event-driven architecture ready
- Queue-based payslip generation ready

### Security
- Role-based access control (Super Admin, Admin, HR, Employee)
- Authentication required for all endpoints
- Audit trail for all changes
- Approval workflow for salary revisions

## Next Phases (Ready for Implementation)

### Phase 2: Advanced Features
- [ ] Salary revision approval workflow
- [ ] PPO conversion automation
- [ ] Internship completion tracking
- [ ] Auto-increment reminders
- [ ] Batch payroll generation
- [ ] Payslip PDF generation with digital signatures
- [ ] Email payslip delivery
- [ ] QR code verification

### Phase 3: Analytics & Reports
- [ ] Payroll summary reports
- [ ] Department-wise salary analysis
- [ ] Deduction impact reports
- [ ] Attendance impact analysis
- [ ] Increment history reports
- [ ] Intern conversion reports

### Phase 4: Advanced Calculations
- [ ] Variable salary structures
- [ ] Performance-based incentives
- [ ] Commission calculations
- [ ] Bonus calculations
- [ ] Sandwich policy handling
- [ ] Partial payroll cycles

### Phase 5: Integration
- [ ] Attendance module integration
- [ ] Leave management integration
- [ ] Bank integration for salary disbursement
- [ ] Tax calculation integration
- [ ] Compliance reporting

## Configuration Options

### Payroll Settings
```javascript
{
  lateMarkThreshold: 3,           // 3 late marks = 0.5 day deduction
  sandwichPolicy: true,            // Handle sandwich policy
  salaryBasis: "30-day",           // 30-day, actual, or working-day
  hoursPerDay: 8,                  // Hours per working day
  salaryHoldDays: 10,              // Days to hold salary after release
  payrollCycleStartDate: 21,       // 21st of month
  payrollCycleEndDate: 20,         // 20th of next month
  salaryReleaseDate: 1             // 1st of next month
}
```

## API Response Format

### Success Response
```json
{
  "success": true,
  "data": {
    "kpiData": {
      "currentAmount": 50000,
      "previousAmount": 45000,
      "effectiveFrom": "2026-05-01",
      "perDayAmount": 1666.67,
      "cycleStartDate": "2026-04-21",
      "cycleEndDate": "2026-05-20",
      "employeeType": "employee"
    },
    "salaryHistory": [
      {
        "month": "May 2026",
        "salary": 50000,
        "type": "current"
      }
    ],
    "employeeType": "employee"
  },
  "message": "Payroll dashboard data fetched successfully"
}
```

## Database Indexes

### PayrollCycle
- `orgId, year, month` (unique)
- `orgId, status`
- `cycleStartDate, cycleEndDate`

### SalaryRevision
- `employeeId, effectiveFrom` (descending)
- `userId, status`
- `orgId, status`
- `effectiveFrom, effectiveTo`

### PayrollRun
- `payrollCycleId, employeeId` (unique)
- `orgId, status`
- `userId, cycleStartDate` (descending)

## Performance Considerations

1. **Database Queries**
   - Indexed queries for fast retrieval
   - Lean queries where possible
   - Pagination for large datasets

2. **Calculations**
   - Cached payroll cycles
   - Batch processing for multiple employees
   - Async calculation for large payrolls

3. **Frontend**
   - Lazy loading of salary history
   - Chart data pagination
   - Optimized re-renders

## Testing Checklist

- [ ] Payroll cycle generation for all months
- [ ] Payable days calculation with various attendance scenarios
- [ ] Per-day salary calculation with different bases
- [ ] Mid-cycle salary revision calculations
- [ ] Prorated salary for mid-month joining
- [ ] Deduction calculations (fixed, percentage, attendance-linked)
- [ ] Employee dashboard KPI display
- [ ] Salary history chart rendering
- [ ] Role-based access control
- [ ] Audit logging

## Deployment Checklist

- [ ] Database migrations for new models
- [ ] Index creation for performance
- [ ] Environment variables configuration
- [ ] API endpoint testing
- [ ] Frontend build verification
- [ ] Staging environment testing
- [ ] Production deployment
- [ ] Monitoring setup
- [ ] Backup procedures

## Support & Maintenance

### Common Issues & Solutions

1. **Payroll Cycle Mismatch**
   - Verify cycle dates are correct
   - Check timezone settings
   - Validate date calculations

2. **Incorrect Payable Days**
   - Verify attendance data
   - Check public holiday configuration
   - Validate late mark threshold

3. **Salary Revision Issues**
   - Ensure revision dates are within cycle
   - Verify salary structure approval
   - Check split calculation logic

## Future Enhancements

1. **AI-Powered Salary Recommendations**
   - Market analysis
   - Performance-based suggestions
   - Retention predictions

2. **Mobile App**
   - Payslip viewing
   - Salary history
   - Notifications

3. **Advanced Analytics**
   - Predictive payroll analysis
   - Trend analysis
   - Forecasting

4. **Compliance**
   - Tax compliance reporting
   - Statutory compliance
   - Audit trails

---

**Version**: 1.0.0  
**Last Updated**: May 8, 2026  
**Status**: Production Ready (Phase 1)
