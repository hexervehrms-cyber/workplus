# WorkPlus Pro - HRMS Platform Upgrade Design

**Project:** Full-Stack HRMS Platform Stabilization & Security Hardening  
**Date:** April 24, 2026

---

## 🏗️ SYSTEM ARCHITECTURE

### High-Level Architecture
```
┌─────────────────────────────────────────────────────────────┐
│                     Frontend (React)                         │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  Pages: Admin, Employee, Super Admin Dashboards     │   │
│  │  Components: Forms, Tables, Charts, Cards           │   │
│  │  Services: API calls (NO mock data)                 │   │
│  │  Context: Auth, Currency, Theme                     │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
                            ↓ HTTP/WebSocket
┌─────────────────────────────────────────────────────────────┐
│                  Backend (Express.js)                        │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  Routes: Auth, Employees, Expenses, Leave, etc.    │   │
│  │  Middleware: JWT, Role Check, Error Handler        │   │
│  │  Controllers: Business Logic                        │   │
│  │  Models: Database Schema                            │   │
│  │  Socket.IO: Real-time Events                        │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
                            ↓ Mongoose ODM
┌─────────────────────────────────────────────────────────────┐
│                  MongoDB (Database)                          │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  Collections: Users, Employees, Expenses, etc.      │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

---

## 🔐 SECURITY ARCHITECTURE

### Authentication Flow
```
1. User Login
   ↓
2. Verify Credentials (bcrypt)
   ↓
3. Generate JWT Token (24h expiry)
   ↓
4. Store Token in localStorage
   ↓
5. Include Token in API Requests
   ↓
6. Backend Verifies Token
   ↓
7. Check User Role
   ↓
8. Execute Request or Deny Access
```

### Role-Based Access Control
```
Super Admin
├── View all data
├── Manage admins
├── Manage organizations
└── System settings

Admin
├── Manage employees
├── Manage expenses
├── Manage leaves
├── Manage attendance
├── Manage documents
└── View organization data

Employee
├── View own data
├── Submit expenses
├── Request leaves
├── Mark attendance
└── View own documents
```

### Middleware Stack
```
Request
  ↓
CORS Middleware
  ↓
Body Parser
  ↓
JWT Verification (verifyToken)
  ↓
Role Check (requireRole)
  ↓
Input Validation
  ↓
Route Handler
  ↓
Error Handler
  ↓
Response
```

---

## 📊 DATABASE SCHEMA

### User Collection
```javascript
{
  _id: ObjectId,
  name: String (required),
  email: String (unique, required),
  password: String (hashed, required),
  role: Enum ['super_admin', 'admin', 'employee'],
  isActive: Boolean (default: true),
  avatar: String,
  organization: String,
  orgId: String,
  tenantId: String,
  lastLogin: Date,
  passwordChangedAt: Date,
  createdAt: Date,
  updatedAt: Date
}
```

### Employee Collection
```javascript
{
  _id: ObjectId,
  userId: ObjectId (ref: User),
  name: String (required),
  email: String (required),
  phone: String,
  address: String,
  gender: Enum ['male', 'female', 'other'],
  dateOfBirth: Date,
  maritalStatus: String,
  nationality: String,
  employeeCode: String (unique),
  designation: String,
  department: String (ref: Department),
  baseSalary: Number,
  joiningDate: Date,
  status: Enum ['active', 'inactive', 'terminated'],
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
  date: Date,
  checkIn: Date,
  checkOut: Date,
  lateBy: Number (minutes),
  earlyCheckOut: Number (minutes),
  status: Enum ['present', 'absent', 'on-leave', 'half-day', 'late'],
  hoursWorked: Number,
  breaks: [{
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

### Department Collection (NEW)
```javascript
{
  _id: ObjectId,
  name: String (required, unique),
  description: String,
  manager: ObjectId (ref: User),
  employees: [ObjectId] (ref: Employee),
  budget: Number,
  orgId: String,
  createdAt: Date,
  updatedAt: Date
}
```

### Announcement Collection (NEW)
```javascript
{
  _id: ObjectId,
  title: String (required),
  content: String (required),
  author: ObjectId (ref: User),
  priority: Enum ['low', 'medium', 'high'],
  visibility: Enum ['all', 'admin', 'department'],
  department: ObjectId (ref: Department),
  startDate: Date,
  endDate: Date,
  isActive: Boolean (default: true),
  orgId: String,
  createdAt: Date,
  updatedAt: Date
}
```

---

## 🔌 API ENDPOINTS DESIGN

### Authentication Endpoints
```
POST   /api/auth/login              - Login user
POST   /api/auth/register           - Register new user
GET    /api/auth/me                 - Get current user
POST   /api/auth/logout             - Logout user
POST   /api/auth/refresh-token      - Refresh JWT token
POST   /api/auth/create-admin       - Create admin (super_admin only)
```

### Employee Endpoints
```
GET    /api/employees               - Get all employees (admin only)
GET    /api/employees/:id           - Get employee by ID
GET    /api/employees/user/:userId  - Get employee by user ID
GET    /api/employees/search        - Search employees
POST   /api/employees               - Create employee (admin only)
PUT    /api/employees/:id           - Update employee (admin only)
DELETE /api/employees/:id           - Delete employee (admin only)
```

### Attendance Endpoints
```
GET    /api/attendance              - Get all attendance (admin only)
GET    /api/attendance/user/:userId - Get user attendance
GET    /api/attendance/check-in     - Check-in endpoint
POST   /api/attendance/check-out    - Check-out endpoint
POST   /api/attendance              - Create attendance record
PUT    /api/attendance/:id          - Update attendance
```

### Holiday Endpoints
```
GET    /api/holidays                - Get all holidays
GET    /api/holidays/organization/:orgId - Get org holidays
POST   /api/holidays                - Create holiday (admin only)
PUT    /api/holidays/:id            - Update holiday (admin only)
DELETE /api/holidays/:id            - Delete holiday (admin only)
```

### Document Endpoints
```
GET    /api/documents               - Get all documents
GET    /api/documents/templates     - Get document templates
GET    /api/documents/organization/:orgId - Get org documents
POST   /api/documents/upload        - Upload document (admin only)
DELETE /api/documents/:id           - Delete document (admin only)
POST   /api/company-documents/digital-generate - Generate digital doc
```

### Department Endpoints (NEW)
```
GET    /api/departments             - Get all departments
GET    /api/departments/:id         - Get department by ID
POST   /api/departments             - Create department (admin only)
PUT    /api/departments/:id         - Update department (admin only)
DELETE /api/departments/:id         - Delete department (admin only)
```

### Announcement Endpoints (NEW)
```
GET    /api/announcements           - Get all announcements
GET    /api/announcements/:id       - Get announcement by ID
POST   /api/announcements           - Create announcement (admin only)
PUT    /api/announcements/:id       - Update announcement (admin only)
DELETE /api/announcements/:id       - Delete announcement (admin only)
```

---

## 🛠️ MIDDLEWARE DESIGN

### verifyToken Middleware
```javascript
// Verify JWT token and attach user info to request
// Checks: Token exists, valid signature, not expired
// Attaches: req.user, req.userId, req.userRole, req.tenantId
```

### requireRole Middleware
```javascript
// Check if user has required role
// Usage: app.get('/api/admin', requireRole('admin'), handler)
// Roles: 'super_admin', 'admin', 'employee'
```

### errorHandler Middleware
```javascript
// Centralized error handling
// Logs errors to Winston logger
// Returns standardized error response
```

### fileUploadValidator Middleware
```javascript
// Validate file type and size
// Allowed types: pdf, doc, docx, xls, xlsx, jpg, png
// Max size: 5MB
```

### rateLimiter Middleware
```javascript
// Rate limit auth endpoints
// Limit: 5 requests per 15 minutes per IP
// Prevents brute force attacks
```

---

## 📁 FOLDER STRUCTURE

### Backend Structure
```
backend/
├── config/
│   └── db.js                    # Database connection
├── middleware/
│   ├── auth.js                  # JWT verification
│   ├── roleCheck.js             # Role-based access
│   ├── errorHandler.js          # Error handling
│   ├── fileValidator.js         # File validation
│   └── rateLimiter.js           # Rate limiting
├── models/
│   ├── User.js
│   ├── Employee.js
│   ├── Attendance.js
│   ├── Department.js            # NEW
│   ├── Announcement.js          # NEW
│   ├── Expense.js
│   ├── LeaveRequest.js
│   ├── Holiday.js
│   ├── Document.js
│   └── ... (other models)
├── controllers/
│   ├── authController.js
│   ├── employeeController.js
│   ├── attendanceController.js
│   ├── departmentController.js  # NEW
│   ├── announcementController.js # NEW
│   └── ... (other controllers)
├── routes/
│   ├── auth.js
│   ├── employees.js
│   ├── attendance.js
│   ├── departments.js           # NEW
│   ├── announcements.js         # NEW
│   └── ... (other routes)
├── services/
│   ├── emailService.js
│   ├── fileService.js
│   └── ... (other services)
├── utils/
│   ├── logger.js                # Winston logger
│   ├── validators.js            # Input validation
│   └── helpers.js
├── server.js                    # Main entry point
└── package.json
```

### Frontend Structure
```
frontend/
├── src/
│   ├── app/
│   │   ├── pages/
│   │   │   ├── admin/
│   │   │   ├── employee/
│   │   │   ├── super-admin/
│   │   │   └── public/
│   │   ├── components/
│   │   │   ├── ui/
│   │   │   ├── DocumentGenerator.tsx    # Consolidated
│   │   │   ├── HolidayCalendar.tsx      # Consolidated
│   │   │   └── ... (other components)
│   │   ├── services/
│   │   │   ├── api.ts                   # API client
│   │   │   ├── employeeService.ts
│   │   │   ├── attendanceService.ts
│   │   │   └── ... (other services)
│   │   ├── hooks/
│   │   │   ├── useAuth.ts
│   │   │   ├── useApi.ts
│   │   │   └── ... (other hooks)
│   │   ├── context/
│   │   │   ├── AuthContext.tsx
│   │   │   ├── CurrencyContext.tsx
│   │   │   └── ThemeContext.tsx
│   │   ├── layouts/
│   │   │   ├── MainLayout.tsx
│   │   │   └── ... (other layouts)
│   │   ├── App.tsx
│   │   └── routes.tsx
│   └── index.css
└── package.json
```

---

## 🔄 DATA FLOW EXAMPLES

### Create Expense Flow
```
Frontend Form
    ↓
Validate Input
    ↓
POST /api/expenses
    ↓
Backend: verifyToken
    ↓
Backend: requireRole('employee')
    ↓
Backend: Validate Input
    ↓
Backend: Save to MongoDB
    ↓
Backend: Emit Socket.IO event
    ↓
Return Response
    ↓
Frontend: Update UI
    ↓
All Clients: Receive Real-time Update
```

### Approve Expense Flow
```
Admin Dashboard
    ↓
Click "Approve" Button
    ↓
PATCH /api/expenses/:id/approve
    ↓
Backend: verifyToken
    ↓
Backend: requireRole('admin')
    ↓
Backend: Update Status
    ↓
Backend: Record Approver & Timestamp
    ↓
Backend: Emit Socket.IO event
    ↓
Return Response
    ↓
Frontend: Update UI
    ↓
All Clients: Receive Real-time Update
```

---

## 🧪 TESTING STRATEGY

### Unit Tests
- Test each controller function
- Test middleware functions
- Test validation functions

### Integration Tests
- Test API endpoints
- Test database operations
- Test authentication flow

### E2E Tests
- Test complete workflows
- Test role-based access
- Test real-time updates

---

## 📈 PERFORMANCE CONSIDERATIONS

### Database Optimization
- Indexes on frequently queried fields
- Aggregation pipelines for statistics
- Projection to limit returned fields

### API Optimization
- Pagination for large datasets
- Caching for static data
- Compression for responses

### Frontend Optimization
- Code splitting with Vite
- Lazy loading of components
- Memoization of expensive computations

---

## 🔒 SECURITY CONSIDERATIONS

### Authentication
- JWT tokens with 24-hour expiry
- Token refresh mechanism
- Secure password hashing (bcrypt)

### Authorization
- Role-based access control
- Endpoint-level permission checks
- Data-level access control

### Data Protection
- HTTPS for all communications
- Input validation and sanitization
- File upload validation
- Rate limiting on auth endpoints

### Monitoring
- Error logging with Winston
- Request logging with Morgan
- Security audit logs

---

## 📝 IMPLEMENTATION NOTES

1. **No Mock Data**: All components must use real API calls
2. **Role Enforcement**: Every protected endpoint must check role
3. **Error Handling**: All API calls must have error handling
4. **Loading States**: Show loading indicators during API calls
5. **Real-time Updates**: Use Socket.IO for live data updates
6. **Backward Compatibility**: Don't break existing features
7. **Code Quality**: Follow existing code patterns and conventions

