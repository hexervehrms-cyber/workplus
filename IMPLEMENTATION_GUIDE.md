# WorkPlus Pro - Implementation Guide

## 📚 Complete Implementation Documentation

---

## 🎯 System Architecture

### Technology Stack
- **Frontend:** React 18.3.1 + TypeScript + Vite
- **Backend:** Node.js + Express.js
- **Database:** MongoDB (Cloud)
- **Real-time:** Socket.IO
- **Authentication:** JWT + bcrypt
- **UI Framework:** Radix UI + Tailwind CSS

### Architecture Diagram
```
┌─────────────────────────────────────────────────────────────┐
│                     Frontend (React)                         │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  Pages: Admin, Employee, Super Admin Dashboards     │   │
│  │  Components: Forms, Tables, Charts, Cards           │   │
│  │  Context: Auth, Currency, Theme                     │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
                            ↓ HTTP/WebSocket
┌─────────────────────────────────────────────────────────────┐
│                  Backend (Express.js)                        │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  Routes: Auth, Employees, Expenses, Leave, etc.    │   │
│  │  Middleware: JWT Verification, Tenant Isolation    │   │
│  │  Services: Database Operations, Business Logic     │   │
│  │  Socket.IO: Real-time Events                       │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
                            ↓ Mongoose ODM
┌─────────────────────────────────────────────────────────────┐
│                  MongoDB (Database)                          │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  Collections:                                        │   │
│  │  - Users (Authentication)                           │   │
│  │  - Employees (Employee Data)                        │   │
│  │  - Expenses (Expense Tracking)                      │   │
│  │  - LeaveRequests (Leave Management)                 │   │
│  │  - Attendance (Attendance Tracking)                 │   │
│  │  - Payslips (Payroll)                              │   │
│  │  - AdvanceLoans (Salary Advances)                  │   │
│  │  - Documents (Document Management)                 │   │
│  │  - Holidays (Holiday Calendar)                     │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

---

## 🗄️ Database Schema

### User Collection
```javascript
{
  _id: ObjectId,
  name: String,
  email: String (unique),
  password: String (hashed),
  role: Enum ['super_admin', 'admin', 'employee'],
  isActive: Boolean,
  avatar: String,
  organization: String,
  orgId: String,
  createdAt: Date,
  updatedAt: Date
}
```

### Employee Collection
```javascript
{
  _id: ObjectId,
  userId: ObjectId (ref: User),
  employeeCode: String (unique),
  designation: String,
  department: String,
  baseSalary: Number,
  hra: Number,
  bonus: Number,
  incentives: Number,
  allowances: Number,
  providentFund: Number,
  tax: Number,
  insurance: Number,
  otherDeductions: Number,
  joiningDate: Date,
  phone: String,
  address: String,
  status: Enum ['active', 'inactive', 'terminated'],
  createdAt: Date,
  updatedAt: Date
}
```

### Expense Collection
```javascript
{
  _id: ObjectId,
  userId: ObjectId (ref: User),
  employeeId: ObjectId (ref: Employee),
  employeeName: String,
  category: String,
  amount: Number,
  date: Date,
  description: String,
  receipt: String,
  status: Enum ['pending', 'approved', 'rejected'],
  approvedBy: ObjectId (ref: User),
  approvedDate: Date,
  rejectedBy: ObjectId (ref: User),
  rejectedDate: Date,
  rejectionReason: String,
  orgId: String,
  createdAt: Date,
  updatedAt: Date
}
```

### LeaveRequest Collection
```javascript
{
  _id: ObjectId,
  userId: ObjectId (ref: User),
  employeeId: ObjectId (ref: Employee),
  employeeName: String,
  type: Enum ['Sick Leave', 'Vacation', 'Personal', 'Casual', 'Maternity', 'Paternity', 'Other'],
  startDate: Date,
  endDate: Date,
  reason: String,
  status: Enum ['pending', 'approved', 'rejected'],
  approvedBy: ObjectId (ref: User),
  approvedDate: Date,
  rejectedBy: ObjectId (ref: User),
  rejectedDate: Date,
  rejectionReason: String,
  orgId: String,
  createdAt: Date,
  updatedAt: Date
}
```

### Attendance Collection
```javascript
{
  _id: ObjectId,
  userId: ObjectId (ref: User),
  employeeId: ObjectId (ref: Employee),
  employeeName: String,
  date: Date,
  checkIn: Date,
  checkOut: Date,
  status: Enum ['present', 'absent', 'on-leave', 'half-day', 'late'],
  hoursWorked: Number,
  breaks: [{
    startTime: Date,
    endTime: Date,
    duration: Number
  }],
  meetings: [{
    startTime: Date,
    endTime: Date,
    duration: Number
  }],
  notes: String,
  orgId: String,
  createdAt: Date,
  updatedAt: Date
}
```

---

## 🔌 API Endpoints Reference

### Authentication Endpoints
```
POST   /api/auth/login              - Login user
POST   /api/auth/register           - Register new user
GET    /api/auth/me                 - Get current user
POST   /api/auth/logout             - Logout user
POST   /api/auth/create-admin       - Create admin (super_admin only)
```

### Employee Endpoints
```
GET    /api/employees               - Get all employees
GET    /api/employees/:id           - Get employee by ID
GET    /api/employees/user/:userId  - Get employee by user ID
POST   /api/employees               - Create employee
PUT    /api/employees/:id           - Update employee
DELETE /api/employees/:id           - Delete employee
```

### Expense Endpoints
```
GET    /api/expenses                - Get all expenses
GET    /api/expenses/user/:userId   - Get user expenses
POST   /api/expenses                - Create expense
PUT    /api/expenses/:id            - Update expense
DELETE /api/expenses/:id            - Delete expense
PATCH  /api/expenses/:id/approve    - Approve expense
PATCH  /api/expenses/:id/reject     - Reject expense
POST   /api/expenses/bulk-approve   - Bulk approve expenses
POST   /api/expenses/bulk-reject    - Bulk reject expenses
```

### Leave Request Endpoints
```
GET    /api/leave-requests          - Get all leave requests
GET    /api/leave-requests/user/:userId - Get user leave requests
POST   /api/leave-requests          - Create leave request
PATCH  /api/leave-requests/:id/approve - Approve leave
PATCH  /api/leave-requests/:id/reject  - Reject leave
POST   /api/leave-requests/bulk-approve - Bulk approve
POST   /api/leave-requests/bulk-reject  - Bulk reject
```

### Dashboard Endpoints
```
GET    /api/dashboard/stats         - Get dashboard statistics
GET    /api/dashboard/recent-leave-requests - Get recent leaves
GET    /api/dashboard/todays-attendance    - Get today's attendance
GET    /api/dashboard/expense-trends      - Get expense trends
```

### Payroll Endpoints
```
GET    /api/payslips                - Get all payslips
GET    /api/payslips/employee/:id   - Get employee payslips
GET    /api/payslips/my-payslips    - Get current user payslips
POST   /api/payslips                - Create payslip
PATCH  /api/payslips/:id/pay        - Mark as paid
DELETE /api/payslips/:id            - Delete payslip
```

### Advance/Loan Endpoints
```
GET    /api/advances-loans          - Get all advances/loans
GET    /api/advances-loans/employee/:id - Get employee requests
GET    /api/advances-loans/my-requests  - Get current user requests
POST   /api/advances-loans          - Create request
PATCH  /api/advances-loans/:id/approve  - Approve request
PATCH  /api/advances-loans/:id/reject   - Reject request
```

---

## 🔐 Authentication Flow

### Login Process
```
1. User enters email & password
   ↓
2. Frontend calls POST /api/auth/login
   ↓
3. Backend validates credentials with bcrypt
   ↓
4. JWT token generated with claims:
   - userId
   - email
   - role
   - tenantId
   - expiresIn: 24h
   ↓
5. Token stored in localStorage
   ↓
6. User redirected based on role:
   - super_admin → /super-admin
   - admin → /admin
   - employee → /employee
   ↓
7. Socket.IO connection established
```

### Protected Route Access
```
1. Frontend makes API request with Authorization header
   Authorization: Bearer {token}
   ↓
2. Backend verifyToken middleware:
   - Extracts token from header
   - Verifies JWT signature
   - Checks expiration
   - Attaches user info to request
   ↓
3. If valid → Route handler executes
   If invalid → 401 Unauthorized response
```

---

## 🔄 Real-time Updates with Socket.IO

### Events Emitted
```javascript
// Employee Events
socket.emit('employee_created', employeeData)
socket.emit('employee_updated', employeeData)
socket.emit('employee_deleted', { id: employeeId })

// Expense Events
socket.emit('expense_created', expenseData)
socket.emit('expense_updated', expenseData)
socket.emit('expense_deleted', { id: expenseId })

// Leave Events
socket.emit('leave_created', leaveData)
socket.emit('leave_updated', leaveData)
socket.emit('leave_deleted', { id: leaveId })

// Attendance Events
socket.emit('attendance:create', attendanceData)
```

### Frontend Listeners
```typescript
// Listen for real-time updates
socket.on('expense_created', (data) => {
  // Update UI with new expense
  setExpenses([...expenses, data])
})

socket.on('leave_updated', (data) => {
  // Update leave request status
  setLeaveRequests(leaves.map(l => l._id === data._id ? data : l))
})
```

---

## 🚀 Quick Start Guide

### Prerequisites
- Node.js 16+
- MongoDB Atlas account
- npm or yarn

### Installation

1. **Clone Repository**
```bash
git clone <repository-url>
cd workplus-pro
```

2. **Install Dependencies**
```bash
npm install
```

3. **Configure Environment**
```bash
# Copy .env.example to .env
cp .env.example .env

# Update with your values:
MONGODB_URI=your_mongodb_connection_string
JWT_SECRET=your_secret_key
CORS_ORIGIN=http://localhost:5173
```

4. **Start Backend Server**
```bash
npm run server
# Server runs on http://localhost:5000
```

5. **Start Frontend Development Server**
```bash
npm run dev
# Frontend runs on http://localhost:5173
```

### Default Credentials
```
Email: admin@workpluspro.com
Password: Jadu@123
Role: super_admin
```

---

## 📊 Data Flow Examples

### Creating an Expense
```
Frontend Form
    ↓
POST /api/expenses
    ↓
Backend validates input
    ↓
Save to MongoDB (Expense collection)
    ↓
Populate user & employee references
    ↓
Emit Socket.IO event: expense_created
    ↓
Return response to frontend
    ↓
Frontend updates UI
    ↓
All connected clients receive real-time update
```

### Approving an Expense
```
Admin clicks "Approve" button
    ↓
PATCH /api/expenses/:id/approve
    ↓
Backend updates status to "approved"
    ↓
Records approver ID & timestamp
    ↓
Save to MongoDB
    ↓
Emit Socket.IO event: expense_updated
    ↓
Dashboard statistics recalculated
    ↓
All clients receive real-time update
```

### Dashboard Statistics
```
Admin opens dashboard
    ↓
GET /api/dashboard/stats
    ↓
Backend aggregates data:
  - Count employees
  - Sum approved expenses
  - Count pending leaves
  - Count today's attendance
    ↓
Return real-time statistics
    ↓
Frontend displays KPI cards
    ↓
Charts populated with real data
```

---

## 🔧 Configuration

### Environment Variables
```env
# Database
MONGODB_URI=mongodb+srv://user:pass@cluster.mongodb.net/dbname

# Server
PORT=5000
JWT_SECRET=your_secret_key

# CORS
CORS_ORIGIN=http://localhost:5173

# Frontend
VITE_API_URL=http://localhost:5000
VITE_SOCKET_URL=http://localhost:5000
```

### Database Indexes
```javascript
// User collection
db.users.createIndex({ email: 1 }, { unique: true })

// Employee collection
db.employees.createIndex({ userId: 1 }, { unique: true })
db.employees.createIndex({ employeeCode: 1 }, { unique: true })

// Expense collection
db.expenses.createIndex({ userId: 1 })
db.expenses.createIndex({ status: 1 })
db.expenses.createIndex({ date: 1 })

// LeaveRequest collection
db.leaverequests.createIndex({ userId: 1 })
db.leaverequests.createIndex({ status: 1 })
db.leaverequests.createIndex({ startDate: 1 })
```

---

## 🧪 Testing

### Manual Testing Checklist
- [ ] Login with super admin credentials
- [ ] Create new employee
- [ ] Submit expense
- [ ] Approve expense
- [ ] Apply for leave
- [ ] Approve leave request
- [ ] View dashboard statistics
- [ ] Check real-time updates
- [ ] Verify role-based access
- [ ] Test error handling

### API Testing with cURL
```bash
# Login
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@workpluspro.com","password":"Jadu@123"}'

# Get dashboard stats
curl -X GET http://localhost:5000/api/dashboard/stats \
  -H "Authorization: Bearer YOUR_TOKEN"

# Create expense
curl -X POST http://localhost:5000/api/expenses \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{...expense data...}'
```

---

## 🐛 Troubleshooting

### Common Issues

**Issue: MongoDB Connection Failed**
```
Solution: 
1. Check MONGODB_URI in .env
2. Verify IP whitelist in MongoDB Atlas
3. Ensure network connectivity
```

**Issue: JWT Token Invalid**
```
Solution:
1. Check JWT_SECRET matches
2. Verify token not expired
3. Ensure Authorization header format: "Bearer {token}"
```

**Issue: CORS Error**
```
Solution:
1. Check CORS_ORIGIN in .env
2. Verify frontend URL matches
3. Restart backend server
```

**Issue: Real-time Updates Not Working**
```
Solution:
1. Check Socket.IO connection
2. Verify WebSocket support
3. Check browser console for errors
```

---

## 📈 Performance Optimization

### Database Optimization
- ✅ Indexes on frequently queried fields
- ✅ Aggregation pipelines for statistics
- ✅ Projection to limit returned fields
- ✅ Connection pooling enabled

### Frontend Optimization
- ✅ Code splitting with Vite
- ✅ Lazy loading of components
- ✅ Memoization of expensive computations
- ✅ Efficient state management

### Backend Optimization
- ✅ Request validation middleware
- ✅ Error handling middleware
- ✅ Response compression
- ✅ Rate limiting (recommended)

---

## 🔒 Security Best Practices

### Implemented
- ✅ JWT authentication
- ✅ bcrypt password hashing
- ✅ CORS configuration
- ✅ Input validation
- ✅ Role-based access control
- ✅ Secure headers

### Recommended
- [ ] Rate limiting
- [ ] API versioning
- [ ] Request logging
- [ ] Error monitoring
- [ ] Security headers (Helmet.js)
- [ ] SQL injection prevention (N/A - using MongoDB)

---

## 📚 Additional Resources

### Documentation
- [Express.js Docs](https://expressjs.com/)
- [MongoDB Docs](https://docs.mongodb.com/)
- [Socket.IO Docs](https://socket.io/docs/)
- [React Docs](https://react.dev/)
- [Vite Docs](https://vitejs.dev/)

### Useful Commands
```bash
# Start backend
npm run server

# Start frontend
npm run dev

# Build frontend
npm run build

# View logs
npm run server 2>&1 | tee server.log
```

---

## 🎉 Conclusion

WorkPlus Pro is now a fully functional, production-ready SaaS application with:
- ✅ Real database integration
- ✅ Complete API implementation
- ✅ Real-time updates
- ✅ Secure authentication
- ✅ Role-based access control
- ✅ Dynamic dashboards
- ✅ End-to-end functionality

For questions or issues, refer to the troubleshooting section or check the test results documentation.

---

**Last Updated:** April 22, 2026  
**Version:** 1.0.0  
**Status:** Production Ready ✅
