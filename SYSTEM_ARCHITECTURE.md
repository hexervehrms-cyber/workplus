# Workplus - System Architecture & Data Flow

## 1. LOGIN FLOW DIAGRAM

```
┌─────────────────────────────────────────────────────────────────┐
│                        USER LOGIN                               │
└─────────────────────────────────────────────────────────────────┘

FRONTEND (React)                    BACKEND (Node.js)
┌──────────────────┐               ┌──────────────────┐
│ Login Page       │               │ Auth Routes      │
│ - Email input    │               │ - POST /login    │
│ - Password input │               │                  │
└────────┬─────────┘               └──────────────────┘
         │                                 ▲
         │ POST /api/auth/login            │
         │ {email, password}               │
         ├────────────────────────────────>│
         │                                 │
         │                          ┌──────┴──────────┐
         │                          │ Validate        │
         │                          │ - Check email   │
         │                          │ - Hash password │
         │                          │ - Compare       │
         │                          └──────┬──────────┘
         │                                 │
         │                          ┌──────┴──────────────────┐
         │                          │ Generate Tokens         │
         │                          │ - JWT (15m)             │
         │                          │ - Refresh (7d)          │
         │                          │ - Session ID            │
         │                          └──────┬──────────────────┘
         │                                 │
         │                          ┌──────┴──────────────────┐
         │                          │ Store Data              │
         │                          │ - Redis: Session        │
         │                          │ - DB: Refresh Token     │
         │                          │ - Cookies: Tokens       │
         │                          └──────┬──────────────────┘
         │                                 │
         │ {token, user, refreshToken}     │
         │<────────────────────────────────┤
         │                                 │
    ┌────┴──────────────────┐
    │ Store Token            │
    │ - IndexedDB mirror     │
    │ - Memory state         │
    │ - Set user context     │
    └────┬──────────────────┘
         │
    ┌────┴──────────────────┐
    │ Connect Socket.IO      │
    │ - User ID              │
    │ - Role                 │
    │ - Org ID               │
    └────┬──────────────────┘
         │
    ┌────┴──────────────────┐
    │ Redirect to Dashboard  │
    │ - Role-based routing   │
    │ - Load attendance data │
    └────────────────────────┘
```

---

## 2. LOGOUT FLOW DIAGRAM

```
┌─────────────────────────────────────────────────────────────────┐
│                        USER LOGOUT                              │
└─────────────────────────────────────────────────────────────────┘

FRONTEND (React)                    BACKEND (Node.js)
┌──────────────────┐               ┌──────────────────┐
│ Dashboard        │               │ Auth Routes      │
│ - Logout button  │               │ - POST /logout   │
└────────┬─────────┘               └──────────────────┘
         │                                 ▲
         │ POST /api/auth/logout           │
         │ {refreshToken}                  │
         ├────────────────────────────────>│
         │                                 │
         │                          ┌──────┴──────────┐
         │                          │ Revoke Token    │
         │                          │ - Mark revoked  │
         │                          │ - DB update     │
         │                          └──────┬──────────┘
         │                                 │
         │                          ┌──────┴──────────┐
         │                          │ Invalidate      │
         │                          │ - Redis session │
         │                          │ - Clear cookies │
         │                          └──────┬──────────┘
         │                                 │
         │ {success: true}                 │
         │<────────────────────────────────┤
         │                                 │
    ┌────┴──────────────────┐
    │ Clear Frontend State   │
    │ - localStorage         │
    │ - IndexedDB            │
    │ - Memory               │
    │ - Socket.IO            │
    └────┬──────────────────┘
         │
    ┌────┴──────────────────┐
    │ Redirect to Login      │
    │ - Clear all data       │
    │ - Reset context        │
    └────────────────────────┘
```

---

## 3. BREAK START FLOW DIAGRAM

```
┌─────────────────────────────────────────────────────────────────┐
│                      START BREAK                                │
└─────────────────────────────────────────────────────────────────┘

FRONTEND (React)                    BACKEND (Node.js)
┌──────────────────┐               ┌──────────────────┐
│ Dashboard        │               │ Attendance       │
│ - Break button   │               │ - POST /break-   │
│                  │               │   start          │
└────────┬─────────┘               └──────────────────┘
         │                                 ▲
    ┌────┴──────────────────┐
    │ Validate              │
    │ - Checked in? ✓       │
    │ - Not on break? ✓     │
    └────┬──────────────────┘
         │
    ┌────┴──────────────────┐
    │ Optimistic Update      │
    │ - isOnBreak = true     │
    │ - Show UI change       │
    │ - Instant feedback     │
    └────┬──────────────────┘
         │
         │ POST /attendance/break-start
         │ {breakType, idempotencyKey}
         ├────────────────────────────────>│
         │                                 │
         │                          ┌──────┴──────────┐
         │                          │ Validate        │
         │                          │ - Checked in?   │
         │                          │ - No break?     │
         │                          └──────┬──────────┘
         │                                 │
         │                          ┌──────┴──────────┐
         │                          │ Atomic Update   │
         │                          │ - MongoDB $push │
         │                          │ - Add break     │
         │                          │ - Prevent race  │
         │                          └──────┬──────────┘
         │                                 │
         │                          ┌──────┴──────────┐
         │                          │ Emit Socket     │
         │                          │ - break:started │
         │                          │ - All clients   │
         │                          └──────┬──────────┘
         │                                 │
         │ {success, liveStatus}           │
         │<────────────────────────────────┤
         │                                 │
    ┌────┴──────────────────┐
    │ Confirm Update         │
    │ - Match server state   │
    │ - Update UI            │
    │ - Log activity         │
    └────┬──────────────────┘
         │
    ┌────┴──────────────────┐
    │ Trigger Refresh        │
    │ - After socket event   │
    │ - Sync with server     │
    └────────────────────────┘
```

---

## 4. BREAK END FLOW DIAGRAM

```
┌─────────────────────────────────────────────────────────────────┐
│                       END BREAK                                 │
└─────────────────────────────────────────────────────────────────┘

FRONTEND (React)                    BACKEND (Node.js)
┌──────────────────┐               ┌──────────────────┐
│ Dashboard        │               │ Attendance       │
│ - End Break btn  │               │ - POST /break-   │
│                  │               │   end            │
└────────┬─────────┘               └──────────────────┘
         │                                 ▲
    ┌────┴──────────────────┐
    │ Validate              │
    │ - On break? ✓         │
    │ - Save state          │
    └────┬──────────────────┘
         │
    ┌────┴──────────────────┐
    │ Optimistic Update      │
    │ - isOnBreak = false    │
    │ - Show UI change       │
    │ - Instant feedback     │
    └────┬──────────────────┘
         │
         │ POST /attendance/break-end
         │ {idempotencyKey}
         ├────────────────────────────────>│
         │                                 │
         │                          ┌──────┴──────────┐
         │                          │ Validate        │
         │                          │ - On break?     │
         │                          │ - Active break? │
         │                          └──────┬──────────┘
         │                                 │
         │                          ┌──────┴──────────┐
         │                          │ Atomic Update   │
         │                          │ - MongoDB array │
         │                          │   Filters       │
         │                          │ - Set endTime   │
         │                          │ - Calculate dur │
         │                          └──────┬──────────┘
         │                                 │
         │                          ┌──────┴──────────┐
         │                          │ Emit Socket     │
         │                          │ - break:ended   │
         │                          │ - All clients   │
         │                          └──────┬──────────┘
         │                                 │
         │ {success, liveStatus}           │
         │<────────────────────────────────┤
         │                                 │
    ┌────┴──────────────────┐
    │ Confirm Update         │
    │ - Match server state   │
    │ - Update UI            │
    │ - Log activity         │
    └────┬──────────────────┘
         │
    ┌────┴──────────────────┐
    │ Trigger Refresh        │
    │ - After socket event   │
    │ - Sync with server     │
    └────────────────────────┘
```

---

## 5. STORAGE ARCHITECTURE

```
┌─────────────────────────────────────────────────────────────────┐
│                    MULTI-LAYER STORAGE                          │
└─────────────────────────────────────────────────────────────────┘

FRONTEND                            BACKEND
┌──────────────────────┐           ┌──────────────────────┐
│ Memory (Session)     │           │ HTTP-only Cookies    │
│ - User object        │           │ - wp_at (15m)        │
│ - Attendance state   │           │ - refreshToken (7d)  │
│ - UI state           │           │ - Secure flag        │
└──────────────────────┘           │ - SameSite=none      │
         ▲                         └──────────────────────┘
         │
┌────────┴──────────────────────────────────────────────┐
│                                                       │
│  ┌──────────────────────┐    ┌──────────────────────┐ │
│  │ IndexedDB            │    │ Redis                │ │
│  │ - Token mirror       │    │ - Session data       │ │
│  │ - Attendance cache   │    │ - Token cache        │ │
│  │ - Large quota        │    │ - 24h TTL            │ │
│  │ - Durable            │    │ - Fast access        │ │
│  └──────────────────────┘    └──────────────────────┘ │
│                                                       │
│  ┌──────────────────────┐    ┌──────────────────────┐ │
│  │ localStorage         │    │ MongoDB              │ │
│  │ - Attendance state   │    │ - Attendance records │ │
│  │ - Preferences        │    │ - Break history      │ │
│  │ - Activity logs      │    │ - Refresh tokens     │ │
│  │ - Fast access        │    │ - Audit logs         │ │
│  └──────────────────────┘    └──────────────────────┘ │
│                                                       │
└───────────────────────────────────────────────────────┘
```

---

## 6. REAL-TIME SYNCHRONIZATION

```
┌─────────────────────────────────────────────────────────────────┐
│                    SOCKET.IO EVENTS                             │
└─────────────────────────────────────────────────────────────────┘

FRONTEND (Client A)                 BACKEND                FRONTEND (Client B)
┌──────────────────┐               ┌──────────────────┐   ┌──────────────────┐
│ Dashboard        │               │ Socket.IO        │   │ Dashboard        │
│ - Break button   │               │ Server           │   │ - Listening      │
└────────┬─────────┘               └──────────────────┘   └──────────────────┘
         │                                 ▲                       ▲
         │ POST /break-start               │                       │
         ├────────────────────────────────>│                       │
         │                                 │                       │
         │                          ┌──────┴──────────┐            │
         │                          │ Update DB       │            │
         │                          │ Emit event      │            │
         │                          └──────┬──────────┘            │
         │                                 │                       │
         │                          break:started                  │
         │                          {employeeId, ...}              │
         │                                 │                       │
         │                                 ├──────────────────────>│
         │                                 │                       │
         │                                 │                  ┌────┴──────┐
         │                                 │                  │ Update UI  │
         │                                 │                  │ - isOnBreak│
         │                                 │                  │ - Refresh  │
         │                                 │                  └────────────┘
         │                                 │
    ┌────┴──────────────────┐
    │ Update UI              │
    │ - isOnBreak = true     │
    │ - Show break status    │
    └────────────────────────┘
```

---

## 7. ERROR HANDLING & ROLLBACK

```
┌─────────────────────────────────────────────────────────────────┐
│                    ERROR HANDLING FLOW                          │
└─────────────────────────────────────────────────────────────────┘

ACTION INITIATED
       │
       ├─> Optimistic Update (UI changes immediately)
       │
       ├─> API Request
       │
       ├─> Response?
       │
       ├─ YES ─> Confirm Update ─> Success
       │
       └─ NO ──> Error Caught
                      │
                      ├─> Rollback State (restore previous)
                      │
                      ├─> Show Error Toast
                      │
                      ├─> Log Error
                      │
                      └─> User can retry
```

---

## 8. SECURITY LAYERS

```
┌─────────────────────────────────────────────────────────────────┐
│                    SECURITY ARCHITECTURE                        │
└─────────────────────────────────────────────────────────────────┘

LAYER 1: AUTHENTICATION
├─ Email/Password validation
├─ Bcrypt password hashing
├─ JWT token generation
└─ Session ID creation

LAYER 2: TOKEN MANAGEMENT
├─ Access token (15m expiry)
├─ Refresh token (7d expiry)
├─ Token fingerprinting (SHA256)
├─ Token blacklisting
└─ Proactive refresh

LAYER 3: SESSION MANAGEMENT
├─ Redis session storage
├─ Per-employee tracking
├─ Role verification
├─ Session invalidation
└─ 24-hour TTL

LAYER 4: COOKIE SECURITY
├─ HTTP-only flag
├─ Secure flag (production)
├─ SameSite=none (production)
├─ SameSite=lax (development)
└─ Priority: Cookies > Headers

LAYER 5: RATE LIMITING
├─ Login endpoint
├─ Register endpoint
├─ Password reset endpoint
└─ Brute force protection

LAYER 6: AUTHORIZATION
├─ Role-based access control
├─ Endpoint authorization
├─ Resource ownership checks
└─ Audit logging

LAYER 7: IDEMPOTENCY
├─ Idempotency keys
├─ Deduplication middleware
├─ Prevents duplicate operations
└─ Atomic database operations

LAYER 8: AUDIT LOGGING
├─ Login/logout events
├─ Attendance actions
├─ Security events
└─ Compliance tracking
```

---

## 9. PERFORMANCE OPTIMIZATIONS

```
┌─────────────────────────────────────────────────────────────────┐
│                    PERFORMANCE STRATEGY                         │
└─────────────────────────────────────────────────────────────────┘

FRONTEND OPTIMIZATIONS
├─ Debouncing (prevents duplicate clicks)
├─ Optimistic updates (instant feedback)
├─ Stale protection (prevents excessive refreshes)
├─ Periodic refresh (30s interval)
├─ Socket.IO integration (real-time updates)
├─ IndexedDB caching (offline support)
└─ Lazy loading (on-demand data)

BACKEND OPTIMIZATIONS
├─ Redis caching (token cache, session cache)
├─ MongoDB atomic operations (prevents race conditions)
├─ Idempotency middleware (prevents duplicates)
├─ Async logging (doesn't block response)
├─ Connection pooling (database)
├─ Rate limiting (prevents abuse)
└─ Compression (response size)

NETWORK OPTIMIZATIONS
├─ HTTP/2 (multiplexing)
├─ Gzip compression
├─ CDN caching
├─ Minification
├─ Code splitting
└─ Lazy loading
```

---

## 10. DEPLOYMENT CHECKLIST

```
┌─────────────────────────────────────────────────────────────────┐
│                    DEPLOYMENT READINESS                         │
└─────────────────────────────────────────────────────────────────┘

ENVIRONMENT SETUP
✅ JWT_SECRET (32+ characters)
✅ REDIS_URL configured
✅ MONGODB_URI configured
✅ CORS_ORIGIN configured
✅ NODE_ENV = production
✅ HTTPS enabled
✅ SSL certificates

SECURITY VERIFICATION
✅ HTTP-only cookies enabled
✅ Secure flag enabled
✅ CORS properly configured
✅ Rate limiting enabled
✅ Audit logging enabled
✅ Error messages sanitized
✅ Secrets not in code

PERFORMANCE VERIFICATION
✅ Redis connection working
✅ MongoDB connection working
✅ Socket.IO working
✅ API response times < 500ms
✅ Database queries optimized
✅ Caching working

MONITORING SETUP
✅ Error tracking (Sentry)
✅ Performance monitoring (APM)
✅ Log aggregation (ELK)
✅ Uptime monitoring
✅ Alert configuration
✅ Dashboard setup

TESTING VERIFICATION
✅ Unit tests passing
✅ Integration tests passing
✅ E2E tests passing
✅ Load testing completed
✅ Security testing completed
✅ Accessibility testing completed
```

---

**Architecture Version:** 1.0
**Last Updated:** May 14, 2026
**Status:** ✅ PRODUCTION READY
