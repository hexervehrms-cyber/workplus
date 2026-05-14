# Workplus - Quick Reference Guide

## ✅ SYSTEM STATUS: ALL OPERATIONAL

---

## LOGIN / LOGOUT

### Login
- **Endpoint:** `POST /api/auth/login`
- **Frontend:** `AuthService.login(email, password)`
- **Storage:** JWT in IndexedDB + HTTP-only cookies
- **Session:** Redis (24h TTL)
- **Status:** ✅ WORKING

### Logout
- **Endpoint:** `POST /api/auth/logout`
- **Frontend:** `AuthContext.logout()`
- **Cleanup:** Revoke token, invalidate session, clear storage
- **Status:** ✅ WORKING

---

## BREAK START / END

### Break Start
- **Endpoint:** `POST /api/attendance/break-start`
- **Frontend:** `handleBreakStart(breakType)`
- **Validation:** Must be checked in, not already on break
- **Atomic:** MongoDB $push prevents duplicates
- **Idempotency:** Prevents duplicate operations
- **Status:** ✅ WORKING

### Break End
- **Endpoint:** `POST /api/attendance/break-end`
- **Frontend:** `handleBreakEnd()`
- **Validation:** Must be on break
- **Atomic:** MongoDB arrayFilters finds active break
- **Duration:** Automatically calculated
- **Status:** ✅ WORKING

---

## STORAGE LAYERS

| Layer | Purpose | TTL | Access |
|-------|---------|-----|--------|
| HTTP-only Cookies | Access/Refresh tokens | 15m / 7d | Automatic |
| Redis | Session data, token cache | 24h | Server-side |
| IndexedDB | Token mirror, attendance cache | Indefinite | Client-side |
| localStorage | Attendance state, preferences | Session | Client-side |
| Memory | Current user, UI state | Session | Client-side |

---

## KEY FILES

### Frontend
- `frontend/src/app/context/AuthContext.tsx` - Auth logic
- `frontend/src/app/pages/employee/Dashboard.tsx` - Dashboard UI
- `frontend/src/app/pages/employee/Attendance.tsx` - Attendance page
- `frontend/src/app/utils/api.ts` - API client
- `frontend/src/app/utils/greetingUtils.ts` - Greeting messages

### Backend
- `backend/routes/auth.js` - Auth endpoints
- `backend/routes/attendance.js` - Attendance endpoints
- `backend/middleware/auth.js` - Auth middleware
- `backend/utils/sessionManager.js` - Session management
- `backend/utils/jwtCache.js` - JWT caching

---

## ENVIRONMENT VARIABLES

### Backend (.env)
```
PORT=5000
NODE_ENV=production
MONGODB_URI=mongodb+srv://...
JWT_SECRET=workplus-pro-production-jwt-secret-key-minimum-32-characters-long-secure-2024-v1
REDIS_URL=redis://...
CORS_ORIGIN=https://hexerve.online
```

### Frontend (.env)
```
VITE_API_URL=https://workplus-backend-sg3a.onrender.com/api
VITE_ENABLE_DEBUG=false
```

---

## API ENDPOINTS

### Authentication
- `POST /api/auth/login` - Login
- `POST /api/auth/logout` - Logout
- `GET /api/auth/me` - Get current user
- `POST /api/auth/refresh` - Refresh token
- `GET /api/auth/verify-role` - Verify role

### Attendance
- `POST /api/attendance/check-in` - Check in
- `POST /api/attendance/check-out` - Check out
- `POST /api/attendance/break-start` - Start break
- `POST /api/attendance/break-end` - End break
- `GET /api/attendance/today` - Get today's attendance
- `GET /api/attendance` - Get attendance history

---

## SOCKET.IO EVENTS

### Emitted by Server
- `break:started` - Break started
- `break:ended` - Break ended
- `attendance:checked_in` - User checked in
- `attendance:checked_out` - User checked out

### Listened by Client
- `break:started` - Update UI
- `break:ended` - Update UI
- `attendance:checked_in` - Update UI
- `attendance:checked_out` - Update UI

---

## SECURITY FEATURES

### Authentication
- ✅ JWT tokens (15m access, 7d refresh)
- ✅ Bcrypt password hashing
- ✅ Session ID generation
- ✅ HTTP-only cookies
- ✅ HTTPS in production

### Authorization
- ✅ Role-based access control (RBAC)
- ✅ Endpoint authorization
- ✅ Resource ownership checks
- ✅ Audit logging

### Protection
- ✅ Rate limiting
- ✅ Token blacklisting
- ✅ Idempotency keys
- ✅ CORS configuration
- ✅ SQL injection prevention

---

## COMMON ISSUES & SOLUTIONS

### Issue: Login fails
**Solution:** Check JWT_SECRET is set and 32+ characters

### Issue: Break start fails
**Solution:** Ensure user is checked in and not already on break

### Issue: Redis connection fails
**Solution:** Check REDIS_URL is correct and Redis is running

### Issue: Token expired
**Solution:** Automatic refresh happens, or user needs to login again

### Issue: Socket.IO not connecting
**Solution:** Check CORS_ORIGIN includes frontend URL

---

## TESTING COMMANDS

### Test Login
```bash
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password123"}'
```

### Test Break Start
```bash
curl -X POST http://localhost:5000/api/attendance/break-start \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"breakType":"regular"}'
```

### Test Break End
```bash
curl -X POST http://localhost:5000/api/attendance/break-end \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{}'
```

---

## MONITORING

### Key Metrics
- Login success rate
- Break start/end success rate
- API response times
- Redis connection status
- MongoDB connection status
- Socket.IO connection count
- Error rate

### Logs to Monitor
- `backend/logs/all.log` - All logs
- `backend/logs/error.log` - Error logs
- Browser console - Frontend logs
- Redis logs - Session/cache issues
- MongoDB logs - Database issues

---

## PERFORMANCE TARGETS

- Login response: < 500ms
- Break start/end: < 500ms
- Dashboard load: < 1s
- API response: < 500ms
- Socket.IO latency: < 100ms
- Database query: < 100ms

---

## DEPLOYMENT STEPS

1. **Set environment variables**
   ```bash
   export JWT_SECRET="your-secret-key"
   export REDIS_URL="redis://..."
   export MONGODB_URI="mongodb+srv://..."
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Build frontend**
   ```bash
   npm run build
   ```

4. **Start backend**
   ```bash
   npm start
   ```

5. **Verify endpoints**
   - Check `/api/auth/login` responds
   - Check `/api/attendance/today` responds
   - Check Socket.IO connects

---

## TROUBLESHOOTING

### Backend won't start
- Check Node.js version (14+)
- Check port 5000 is available
- Check environment variables are set
- Check MongoDB connection
- Check Redis connection

### Frontend won't load
- Check API URL is correct
- Check CORS is configured
- Check frontend build succeeded
- Check browser console for errors

### Login fails
- Check email/password are correct
- Check MongoDB has user data
- Check JWT_SECRET is set
- Check rate limiting isn't blocking

### Break operations fail
- Check user is checked in
- Check user is not already on break
- Check MongoDB connection
- Check idempotency key is unique

---

## SUPPORT

For issues or questions:
1. Check logs: `backend/logs/error.log`
2. Check browser console: F12 > Console
3. Check network tab: F12 > Network
4. Review this guide
5. Contact development team

---

**Last Updated:** May 14, 2026
**Version:** 1.0
**Status:** ✅ PRODUCTION READY
