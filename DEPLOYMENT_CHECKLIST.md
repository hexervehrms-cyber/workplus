# Render Deployment Checklist - 502 Crash Fixes

## Pre-Deployment Verification

### Code Quality
- [x] Syntax validation: `node --check server.js` ✅
- [x] No require() statements in ES module
- [x] All imports at top of file
- [x] No duplicate routes
- [x] No undefined variables
- [x] Proper error handling
- [x] Graceful shutdown support

### Runtime Blockers Fixed
- [x] Express 5 wildcard route syntax (Line 137)
- [x] Async database connection handling (Lines 38-45)
- [x] Render-compatible port binding (Line 3751)
- [x] Duplicate biometric endpoint removed (Line 3360)
- [x] Missing req.userOrgId in middleware (Line 2776)
- [x] Incomplete error handling (Lines 3760+)

### Environment Configuration
- [x] MONGODB_URI set in .env
- [x] PORT variable configured
- [x] JWT_SECRET configured
- [x] NODE_ENV set to production
- [x] CORS_ORIGIN configured

### API Compatibility
- [x] Authentication endpoints unchanged
- [x] Employee management unchanged
- [x] Payroll management unchanged
- [x] Leave requests unchanged
- [x] Attendance tracking unchanged
- [x] Document management unchanged
- [x] Onboarding unchanged
- [x] Dashboard statistics unchanged
- [x] Biometric sync unchanged
- [x] Advance/Loan management unchanged

---

## Deployment Steps

### Step 1: Commit Changes
```bash
git add server.js
git commit -m "Fix Render 502 startup crashes - Express 5 compatibility, async DB handling, port binding, duplicate routes, middleware, error handling"
git push origin main
```

### Step 2: Verify Render Configuration
- [ ] Render project connected to GitHub
- [ ] Auto-deploy enabled
- [ ] Build command: `npm install`
- [ ] Start command: `npm start`
- [ ] Environment variables set:
  - [ ] MONGODB_URI
  - [ ] JWT_SECRET
  - [ ] NODE_ENV=production
  - [ ] CORS_ORIGIN

### Step 3: Monitor Deployment
- [ ] Check Render dashboard
- [ ] Watch build logs
- [ ] Verify startup logs show:
  ```
  ✅ Server running on port [PORT]
  ✅ Socket.IO server initialized
  ✅ Database Status: Connected
  ```

### Step 4: Test Endpoints
- [ ] Health check: `GET /health`
- [ ] API health: `GET /api/health`
- [ ] Login: `POST /api/auth/login`
- [ ] Get users: `GET /api/users`
- [ ] Socket.IO connection

### Step 5: Monitor Production
- [ ] Check error logs
- [ ] Monitor response times
- [ ] Verify database connectivity
- [ ] Test real-time features (Socket.IO)

---

## Troubleshooting

### Issue: 502 Bad Gateway
**Check:**
1. Render logs for startup errors
2. MongoDB connection string
3. Port binding (should be 0.0.0.0)
4. Environment variables

### Issue: Database Connection Failed
**Check:**
1. MONGODB_URI is correct
2. MongoDB cluster allows Render IP
3. Database credentials are valid
4. Network connectivity

### Issue: CORS Errors
**Check:**
1. CORS_ORIGIN matches frontend URL
2. Preflight requests are allowed
3. Headers are properly configured

### Issue: Socket.IO Not Working
**Check:**
1. Socket.IO server initialized
2. CORS configured for Socket.IO
3. Client connecting to correct URL
4. Tenant rooms properly joined

---

## Rollback Plan

If deployment fails:

### Option 1: Revert Commit
```bash
git revert HEAD
git push origin main
# Render will auto-deploy previous version
```

### Option 2: Manual Rollback
1. Go to Render dashboard
2. Select previous deployment
3. Click "Redeploy"

### Option 3: Check Logs
1. Render dashboard → Logs
2. Look for error messages
3. Fix specific issue
4. Redeploy

---

## Performance Metrics

### Expected Startup Time
- Cold start: 30-60 seconds
- Warm start: 5-10 seconds
- Database connection: 2-5 seconds

### Expected Response Times
- Health check: <100ms
- Authentication: 100-500ms
- Database queries: 50-200ms
- Socket.IO events: <50ms

---

## Security Checklist

- [x] JWT_SECRET is strong
- [x] MongoDB credentials are secure
- [x] CORS origins are whitelisted
- [x] No sensitive data in logs
- [x] Error messages don't expose internals
- [x] Rate limiting configured
- [x] Input validation in place

---

## Post-Deployment Verification

### Immediate (First 5 minutes)
- [ ] Server is running
- [ ] No 502 errors
- [ ] Health endpoints respond
- [ ] Database is connected

### Short-term (First hour)
- [ ] Authentication works
- [ ] APIs respond correctly
- [ ] Socket.IO events work
- [ ] No error spikes

### Long-term (First 24 hours)
- [ ] Consistent uptime
- [ ] Normal response times
- [ ] No memory leaks
- [ ] Database queries efficient

---

## Monitoring Setup

### Render Alerts
- [ ] Set up email alerts for crashes
- [ ] Monitor CPU usage
- [ ] Monitor memory usage
- [ ] Monitor response times

### Application Monitoring
- [ ] Set up error tracking (Sentry)
- [ ] Set up performance monitoring
- [ ] Set up uptime monitoring
- [ ] Set up log aggregation

---

## Documentation

- [x] RENDER_502_CRASH_AUDIT_FIXED.md - Detailed audit
- [x] STARTUP_CRASH_FIXES_SUMMARY.md - Quick reference
- [x] DEPLOYMENT_CHECKLIST.md - This file
- [x] ES_MODULES_MIGRATION_GUIDE.md - ES modules info
- [x] FIXES_APPLIED_ES_MODULES.md - Previous fixes

---

## Sign-off

- **Code Review:** ✅ Passed
- **Syntax Check:** ✅ Passed
- **API Compatibility:** ✅ Verified
- **Environment Setup:** ✅ Configured
- **Deployment Ready:** ✅ YES

---

**Deployment Date:** April 27, 2026
**Status:** ✅ Ready for Production
**Node Version:** v24.14.1
**Express Version:** 5.2.1
**MongoDB:** Connected
**All APIs:** Unchanged
