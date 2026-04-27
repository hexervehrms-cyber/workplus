# WorkPlus Backend Stabilization Plan

## CRITICAL ISSUES TO FIX (PHASE 1)

### 1. Socket.IO CORS ReferenceError
- **Issue**: `allowedOrigins` used before definition
- **Fix**: Move `allowedOrigins` array before Socket.IO initialization
- **Impact**: Server crashes on startup

### 2. Missing Logger Module
- **Issue**: `errorHandler.js` imports non-existent `utils/logger.js`
- **Fix**: Create logger utility or remove dependency
- **Impact**: Server crashes on startup

### 3. CommonJS Export in ES Module
- **Issue**: `fileValidator.js` uses `module.exports` in ES module
- **Fix**: Change to `export default fileValidator;`
- **Impact**: Middleware fails to load

### 4. Database Connection Crashes
- **Issue**: `config/db.js` calls `process.exit(1)` on failure
- **Fix**: Implement retry logic with exponential backoff
- **Impact**: Server crashes on DB connection failure

### 5. Unhandled Promise Rejections
- **Issue**: Async routes without try-catch
- **Fix**: Wrap all async routes with `asyncHandler` middleware
- **Impact**: Random 500 errors and crashes

### 6. Socket.IO Event Handler Errors
- **Issue**: No error handling in socket event listeners
- **Fix**: Add try-catch to all socket event handlers
- **Impact**: Socket errors crash connection

### 7. Missing Global Error Handler
- **Issue**: No error handler middleware registered
- **Fix**: Add error handler middleware at end of app setup
- **Impact**: Unhandled errors crash server

### 8. JWT Secret Hardcoded Fallback
- **Issue**: Uses 'supersecretkey' if env var missing
- **Fix**: Validate JWT_SECRET on startup
- **Impact**: Security vulnerability

## IMPLEMENTATION STEPS

1. Create logger utility
2. Fix fileValidator export
3. Fix Socket.IO CORS initialization order
4. Implement database retry logic
5. Create asyncHandler wrapper
6. Add global error handler
7. Wrap all async routes
8. Add Socket.IO error handlers
9. Add graceful shutdown handlers
10. Add environment validation
11. Add request logging
12. Add health check endpoints
13. Add input validation
14. Add file upload security
15. Add database indexes

## EXPECTED OUTCOMES

- Zero random crashes
- Proper error logging
- Graceful degradation
- Production-ready stability
- Clear error messages
- Request tracing
- Health monitoring
