# Logged In Employees KPI - Flow Diagrams

## Login Flow Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                    EMPLOYEE LOGIN FLOW                          │
└─────────────────────────────────────────────────────────────────┘

STEP 1: REST API Login
┌──────────────────┐
│  Employee Login  │
│  (REST API)      │
└────────┬─────────┘
         │
         ▼
┌──────────────────────────────────────┐
│ POST /api/auth/login                 │
│ - Validate credentials               │
│ - Generate tokens                    │
│ - Create Session record              │
│   {                                  │
│     userId: "...",                   │
│     orgId: "...",                    │
│     socketId: null,                  │
│     isActive: true,                  │
│     loginTime: now                   │
│   }                                  │
└────────┬─────────────────────────────┘
         │
         ▼
┌──────────────────────────────────────┐
│ Emit Dashboard Update Event          │
│ {                                    │
│   type: 'active_users_updated',      │
│   data: {                            │
│     activeUsers: 1,                  │
│     action: 'login'                  │
│   }                                  │
│ }                                    │
└────────┬─────────────────────────────┘
         │
         ▼
┌──────────────────────────────────────┐
│ Admin Dashboard Receives Event       │
│ Updates KPI: "Logged In Employees: 1"│
└──────────────────────────────────────┘


STEP 2: Socket.IO Connection (Within 1 second)
┌──────────────────┐
│ Socket.IO        │
│ Connection       │
└────────┬─────────┘
         │
         ▼
┌──────────────────────────────────────┐
│ Socket.IO Authenticate Event         │
│ - Find existing session              │
│   (created during login)             │
│ - Update with socketId               │
│   {                                  │
│     socketId: "socket_id",           │
│     connectTime: now                 │
│   }                                  │
└────────┬─────────────────────────────┘
         │
         ▼
┌──────────────────────────────────────┐
│ Session Fully Active                 │
│ - REST API tracked                   │
│ - WebSocket tracked                  │
│ - Ready for real-time updates        │
└──────────────────────────────────────┘
```

---

## Logout Flow Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                    EMPLOYEE LOGOUT FLOW                         │
└─────────────────────────────────────────────────────────────────┘

STEP 1: Logout Request
┌──────────────────┐
│  Employee Logout │
│  (Click Button)  │
└────────┬─────────┘
         │
         ▼
┌──────────────────────────────────────┐
│ POST /api/auth/logout                │
│ - Extract userId from token          │
│ - Mark all active sessions inactive  │
│   {                                  │
│     isActive: false,                 │
│     logoutTime: now                  │
│   }                                  │
└────────┬─────────────────────────────┘
         │
         ▼
┌──────────────────────────────────────┐
│ Emit Dashboard Update Event          │
│ {                                    │
│   type: 'active_users_updated',      │
│   data: {                            │
│     activeUsers: 0,                  │
│     action: 'logout'                 │
│   }                                  │
│ }                                    │
└────────┬─────────────────────────────┘
         │
         ▼
┌──────────────────────────────────────┐
│ Admin Dashboard Receives Event       │
│ Updates KPI: "Logged In Employees: 0"│
└──────────────────────────────────────┘


STEP 2: Socket.IO Disconnect (Automatic)
┌──────────────────┐
│ Socket.IO        │
│ Disconnect       │
└────────┬─────────┘
         │
         ▼
┌──────────────────────────────────────┐
│ Disconnect Handler                   │
│ - Mark session inactive (redundant)  │
│ - Emit dashboard update              │
└────────┬─────────────────────────────┘
         │
         ▼
┌──────────────────────────────────────┐
│ Session Fully Inactive               │
│ - Logged out via REST API            │
│ - Disconnected from WebSocket        │
│ - Audit trail recorded               │
└──────────────────────────────────────┘
```

---

## Real-Time Update Flow Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│              REAL-TIME KPI UPDATE FLOW                          │
└─────────────────────────────────────────────────────────────────┘

EMPLOYEE ACTION
┌──────────────────┐
│  Login/Logout    │
└────────┬─────────┘
         │
         ▼
┌──────────────────────────────────────┐
│ Backend Route Handler                │
│ - Create/Update/Delete Session       │
│ - Count active sessions              │
└────────┬─────────────────────────────┘
         │
         ▼
┌──────────────────────────────────────┐
│ Socket.IO Event Emission             │
│ global.io.to(`tenant_${orgId}`)      │
│   .emit('dashboard_update', {...})   │
└────────┬─────────────────────────────┘
         │
         ▼
┌──────────────────────────────────────┐
│ Socket.IO Broadcast                  │
│ - Send to all admins in org          │
│ - Send to all employees in org       │
│ - Tenant isolation maintained        │
└────────┬─────────────────────────────┘
         │
         ▼
┌──────────────────────────────────────┐
│ Frontend Socket Listener             │
│ realTimeSocket.on('dashboard_update')│
│ - Receive event                      │
│ - Parse data                         │
│ - Call handler                       │
└────────┬─────────────────────────────┘
         │
         ▼
┌──────────────────────────────────────┐
│ Dashboard Component Handler          │
│ handleDashboardUpdate()              │
│ - Update state                       │
│ - Trigger re-render                  │
└────────┬─────────────────────────────┘
         │
         ▼
┌──────────────────────────────────────┐
│ KPI Card Re-renders                  │
│ "Logged In Employees: 1"             │
│ (Updated value displayed)            │
└──────────────────────────────────────┘

⏱️  Total Time: < 2 seconds
```

---

## Session Lifecycle Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                  SESSION LIFECYCLE                              │
└─────────────────────────────────────────────────────────────────┘

CREATED
   │
   ├─ loginTime: 2026-05-06 10:00:00
   ├─ userId: "rinky_id"
   ├─ orgId: "org_123"
   ├─ socketId: null
   ├─ isActive: true
   │
   ▼
SOCKET.IO CONNECTED (within 1 second)
   │
   ├─ socketId: "socket_abc123"
   ├─ connectTime: 2026-05-06 10:00:01
   ├─ isActive: true
   │
   ▼
ACTIVE SESSION
   │
   ├─ Duration: 8 hours
   ├─ isActive: true
   ├─ Tracked by both REST API and WebSocket
   │
   ▼
LOGOUT (Option 1: Explicit Logout)
   │
   ├─ logoutTime: 2026-05-06 18:00:00
   ├─ isActive: false
   │
   ▼
INACTIVE SESSION
   │
   └─ Archived for audit trail


DISCONNECT (Option 2: Browser Close)
   │
   ├─ Socket.IO connection drops
   ├─ Disconnect handler marks inactive
   ├─ logoutTime: 2026-05-06 18:00:00
   ├─ isActive: false
   │
   ▼
INACTIVE SESSION
   │
   └─ Archived for audit trail
```

---

## Database Query Flow Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│              DATABASE QUERY FLOW                                │
└─────────────────────────────────────────────────────────────────┘

ADMIN DASHBOARD LOADS
   │
   ▼
GET /api/dashboard/stats
   │
   ├─ Query: Session.countDocuments({
   │    orgId: "org_123",
   │    isActive: true,
   │    role: 'employee'
   │  })
   │
   ▼
DATABASE RESPONSE
   │
   ├─ Count: 5 active employee sessions
   │
   ▼
KPI CARD DISPLAYS
   │
   ├─ "Logged In Employees: 5"
   │
   ▼
REAL-TIME UPDATE RECEIVED
   │
   ├─ Event: dashboard_update
   ├─ New activeUsers: 6
   │
   ▼
STATE UPDATED
   │
   ├─ setQuickStats({ activeUsers: 6 })
   │
   ▼
KPI CARD RE-RENDERS
   │
   └─ "Logged In Employees: 6"
```

---

## Multi-Employee Scenario Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│          MULTIPLE EMPLOYEES LOGIN SCENARIO                      │
└─────────────────────────────────────────────────────────────────┘

TIME    EMPLOYEE 1      EMPLOYEE 2      EMPLOYEE 3      KPI VALUE
────────────────────────────────────────────────────────────────────
00:00   Login           -               -               0
        ↓
00:01   Session Created -               -               1 ✓
        ↓
00:02   Socket.IO       Login           -               1
        Connected       ↓
        ↓               Session Created -               2 ✓
00:03   Active          ↓               Login           2
                        Socket.IO       ↓
                        Connected       Session Created 3 ✓
00:04   Active          Active          ↓               3
                                        Socket.IO
                                        Connected       3
00:05   Active          Active          Active          3 ✓

ADMIN DASHBOARD SHOWS: "Logged In Employees: 3"
```

---

## Error Handling Flow Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│              ERROR HANDLING FLOW                                │
└─────────────────────────────────────────────────────────────────┘

LOGIN ENDPOINT
   │
   ├─ Validate credentials
   │  ├─ ✓ Valid → Continue
   │  └─ ✗ Invalid → Return 401
   │
   ├─ Generate tokens
   │  ├─ ✓ Success → Continue
   │  └─ ✗ Error → Return 500
   │
   ├─ Create session
   │  ├─ ✓ Success → Continue
   │  └─ ✗ Error → Log warning, continue (don't fail login)
   │
   ├─ Emit dashboard update
   │  ├─ ✓ Success → Continue
   │  └─ ✗ Error → Log warning, continue (don't fail login)
   │
   └─ Return 200 with tokens


SOCKET.IO AUTHENTICATE
   │
   ├─ Verify JWT token
   │  ├─ ✓ Valid → Continue
   │  └─ ✗ Invalid → Disconnect
   │
   ├─ Find existing session
   │  ├─ ✓ Found → Update with socketId
   │  └─ ✗ Not found → Create new session
   │
   ├─ Join rooms
   │  ├─ ✓ Success → Continue
   │  └─ ✗ Error → Log warning, continue
   │
   └─ Emit authenticated event


LOGOUT ENDPOINT
   │
   ├─ Extract userId from token
   │  ├─ ✓ Valid → Continue
   │  └─ ✗ Invalid → Return 401
   │
   ├─ Mark sessions inactive
   │  ├─ ✓ Success → Continue
   │  └─ ✗ Error → Return 500
   │
   └─ Return 200 success
```

---

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                    SYSTEM ARCHITECTURE                          │
└─────────────────────────────────────────────────────────────────┘

FRONTEND (React)
┌──────────────────────────────────────────────────────────────┐
│                                                              │
│  Admin Dashboard                                             │
│  ┌────────────────────────────────────────────────────────┐ │
│  │ KPI Card: "Logged In Employees: 5"                    │ │
│  │                                                        │ │
│  │ Listens to: dashboard_update events                   │ │
│  │ Updates on: login, logout, disconnect                │ │
│  └────────────────────────────────────────────────────────┘ │
│                                                              │
│  Real-Time Socket                                            │
│  ┌────────────────────────────────────────────────────────┐ │
│  │ Socket.IO Connection                                  │ │
│  │ - Receives dashboard_update events                    │ │
│  │ - Calls handleDashboardUpdate()                       │ │
│  │ - Updates component state                             │ │
│  └────────────────────────────────────────────────────────┘ │
│                                                              │
└──────────────────────────────────────────────────────────────┘
                            ▲
                            │ Socket.IO Events
                            │
                            ▼
BACKEND (Node.js)
┌──────────────────────────────────────────────────────────────┐
│                                                              │
│  Socket.IO Server                                            │
│  ┌────────────────────────────────────────────────────────┐ │
│  │ - Receives authenticate events                        │ │
│  │ - Broadcasts dashboard_update events                  │ │
│  │ - Handles disconnect events                           │ │
│  └────────────────────────────────────────────────────────┘ │
│                                                              │
│  REST API Routes                                             │
│  ┌────────────────────────────────────────────────────────┐ │
│  │ POST /api/auth/login                                  │ │
│  │ - Create session                                      │ │
│  │ - Emit dashboard update                               │ │
│  │                                                        │ │
│  │ POST /api/auth/logout                                 │ │
│  │ - Mark sessions inactive                              │ │
│  │                                                        │ │
│  │ GET /api/dashboard/stats                              │ │
│  │ - Count active sessions                               │ │
│  └────────────────────────────────────────────────────────┘ │
│                                                              │
└──────────────────────────────────────────────────────────────┘
                            ▲
                            │ Database Queries
                            │
                            ▼
DATABASE (MongoDB)
┌──────────────────────────────────────────────────────────────┐
│                                                              │
│  Sessions Collection                                         │
│  ┌────────────────────────────────────────────────────────┐ │
│  │ {                                                      │ │
│  │   userId: "...",                                       │ │
│  │   orgId: "...",                                        │ │
│  │   socketId: "...",                                     │ │
│  │   isActive: true,                                      │ │
│  │   loginTime: Date,                                     │ │
│  │   connectTime: Date,                                   │ │
│  │   logoutTime: Date                                     │ │
│  │ }                                                      │ │
│  └────────────────────────────────────────────────────────┘ │
│                                                              │
│  Index: { orgId: 1, isActive: 1, role: 1 }                 │
│  (For fast counting of active employees)                    │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

---

## Timing Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                    TIMING DIAGRAM                              │
└─────────────────────────────────────────────────────────────────┘

EMPLOYEE LOGIN
│
├─ 00ms: Click login button
│
├─ 50ms: REST API request sent
│
├─ 100ms: Backend validates credentials
│
├─ 150ms: Session created in database
│
├─ 200ms: Dashboard update event emitted
│
├─ 250ms: Socket.IO event delivered to admin
│
├─ 300ms: Admin dashboard receives event
│
├─ 350ms: Component state updated
│
├─ 400ms: KPI card re-renders
│
├─ 450ms: User sees "Logged In Employees: 1"
│
├─ 500ms: REST API response sent to employee
│
├─ 550ms: Employee sees login success
│
├─ 600ms: Employee initiates Socket.IO connection
│
├─ 700ms: Socket.IO connection established
│
├─ 750ms: Authenticate event sent
│
├─ 800ms: Backend finds existing session
│
├─ 850ms: Session updated with socketId
│
├─ 900ms: Authenticated event sent to employee
│
└─ 1000ms: Employee fully logged in and connected

⏱️  Total Time: ~1 second from login to KPI update
```

---

## Summary

These diagrams show:
1. **Login Flow**: How sessions are created and updated
2. **Logout Flow**: How sessions are marked inactive
3. **Real-Time Updates**: How events flow from backend to frontend
4. **Session Lifecycle**: Complete session journey
5. **Database Queries**: How KPI counts are calculated
6. **Multi-Employee**: How multiple logins are handled
7. **Error Handling**: How errors are managed
8. **Architecture**: System components and interactions
9. **Timing**: Performance metrics and latency

All diagrams show the complete flow from employee action to KPI card update.
