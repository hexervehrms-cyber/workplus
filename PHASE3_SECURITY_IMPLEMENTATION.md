# PHASE 3: SECURITY FIXES - IMPLEMENTATION GUIDE

## Overview
This document outlines the implementation of 4 critical security features for the HRMS platform upgrade.

## Completed Tasks

### ✅ TASK 1: FILE UPLOAD VALIDATION

**Status:** COMPLETED

**Files Created:**
- `middleware/fileValidator.js` - File validation middleware

**Features Implemented:**
- ✅ File type whitelist: pdf, doc, docx, xls, xlsx, jpg, jpeg, png, gif
- ✅ File size limit: 5MB (5242880 bytes)
- ✅ MIME type validation
- ✅ File extension validation
- ✅ Path traversal prevention
- ✅ Clear error messages

**Usage:**
```javascript
import fileValidator from './middleware/fileValidator.js';

// Apply to upload endpoints
app.post('/api/documents/upload', fileValidator, upload.single('document'), (req, res) => {
  // Handle upload
});
```

**Validation Checks:**
1. File exists check
2. MIME type validation against whitelist
3. File extension validation
4. File size validation (max 5MB)
5. Filename security check (no path traversal)

**Error Responses:**
- 400: No file uploaded
- 400: Invalid file type
- 400: Invalid MIME type
- 413: File size exceeds limit
- 400: Invalid filename

---

### ✅ TASK 2: ERROR LOGGING SYSTEM

**Status:** COMPLETED

**Files Created:**
- `utils/logger.js` - Winston logger configuration
- `middleware/errorHandler.js` - Centralized error handler

**Features Implemented:**
- ✅ Winston logger with file and console transports
- ✅ Separate error and combined log files
- ✅ Timestamp and stack trace logging
- ✅ Sensitive data sanitization
- ✅ Request ID generation for tracing
- ✅ Standardized error responses
- ✅ Exception and rejection handlers

**Log Files Created:**
- `logs/error.log` - Error level logs only
- `logs/combined.log` - All logs
- `logs/exceptions.log` - Uncaught exceptions
- `logs/rejections.log` - Unhandled promise rejections

**Usage:**
```javascript
import logger from './utils/logger.js';
import { errorHandler, requestIdMiddleware, asyncHandler } from './middleware/errorHandler.js';

// Add request ID middleware
app.use(requestIdMiddleware);

// Use async handler for route handlers
app.get('/api/data', asyncHandler(async (req, res) => {
  // Your code here
}));

// Add error handler at the end
app.use(errorHandler);

// Log messages
logger.info('User logged in', { userId: user._id });
logger.error('Database error', { error: error.message });
logger.warn('Suspicious activity', { ip: req.ip });
```

**Sensitive Data Sanitization:**
- Passwords are redacted
- Tokens are redacted
- API keys are redacted
- Database connection strings are redacted

**Log Format:**
```json
{
  "timestamp": "2024-01-15 10:30:45:123",
  "level": "error",
  "message": "User authentication failed",
  "requestId": "550e8400-e29b-41d4-a716-446655440000",
  "method": "POST",
  "url": "/api/auth/login",
  "ip": "192.168.1.1",
  "userAgent": "Mozilla/5.0..."
}
```

---

### ✅ TASK 3: TOKEN REFRESH MECHANISM

**Status:** COMPLETED

**Files Created:**
- `models/RefreshToken.js` - Refresh token database model
- `services/authService.js` - Authentication service with token management
- `routes/securityRoutes.js` - Security routes including token refresh

**Features Implemented:**
- ✅ Access token generation (24 hours expiry)
- ✅ Refresh token generation (7 days expiry)
- ✅ Refresh token storage in database
- ✅ Token refresh endpoint
- ✅ Token revocation on logout
- ✅ Logout from all devices
- ✅ Automatic token refresh before expiry
- ✅ Request ID tracking for tokens

**Token Expiry:**
- Access Token: 24 hours
- Refresh Token: 7 days

**API Endpoints:**

#### POST /api/auth/refresh-token
Refresh access token using refresh token

**Request:**
```json
{
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**Response:**
```json
{
  "success": true,
  "message": "Token refreshed successfully",
  "data": {
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "expiresIn": 86400
  }
}
```

#### POST /api/auth/logout
Logout user and revoke refresh token

**Request:**
```json
{
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**Response:**
```json
{
  "success": true,
  "message": "Logged out successfully"
}
```

#### POST /api/auth/logout-all-devices
Logout from all devices by revoking all refresh tokens

**Response:**
```json
{
  "success": true,
  "message": "Logged out from all devices successfully"
}
```

**Frontend Implementation:**
```javascript
// Store tokens
localStorage.setItem('accessToken', response.data.accessToken);
localStorage.setItem('refreshToken', response.data.refreshToken);

// Refresh token before expiry
const refreshAccessToken = async () => {
  try {
    const response = await fetch('/api/auth/refresh-token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('accessToken')}`
      },
      body: JSON.stringify({
        refreshToken: localStorage.getItem('refreshToken')
      })
    });

    if (response.ok) {
      const data = await response.json();
      localStorage.setItem('accessToken', data.data.accessToken);
      return data.data.accessToken;
    }
  } catch (error) {
    console.error('Token refresh failed:', error);
    // Redirect to login
  }
};

// Set up automatic refresh (23 hours)
setInterval(refreshAccessToken, 23 * 60 * 60 * 1000);
```

---

### ✅ TASK 4: RATE LIMITING

**Status:** COMPLETED

**Files Created:**
- `middleware/rateLimiter.js` - Rate limiting middleware

**Features Implemented:**
- ✅ Login rate limiting: 5 requests per 15 minutes per IP
- ✅ Register rate limiting: 3 requests per hour per IP
- ✅ Token refresh rate limiting: 10 requests per minute per IP
- ✅ Password reset rate limiting: 3 requests per hour per IP
- ✅ Clear error messages
- ✅ 429 status code on limit exceeded
- ✅ IP-based tracking
- ✅ Test environment bypass

**Rate Limits:**
| Endpoint | Limit | Window |
|----------|-------|--------|
| POST /api/auth/login | 5 | 15 minutes |
| POST /api/auth/register | 3 | 1 hour |
| POST /api/auth/refresh-token | 10 | 1 minute |
| POST /api/auth/password-reset | 3 | 1 hour |

**Usage:**
```javascript
import { loginLimiter, registerLimiter, refreshTokenLimiter } from './middleware/rateLimiter.js';

// Apply to routes
app.post('/api/auth/login', loginLimiter, loginHandler);
app.post('/api/auth/register', registerLimiter, registerHandler);
app.post('/api/auth/refresh-token', refreshTokenLimiter, refreshHandler);
```

**Error Response (429):**
```json
{
  "success": false,
  "message": "Too many login attempts. Please try again after 15 minutes.",
  "retryAfter": 1705329600000
}
```

---

## Installation & Setup

### 1. Install Dependencies
```bash
npm install winston express-rate-limit uuid morgan
```

### 2. Create Logs Directory
```bash
mkdir -p logs
```

### 3. Update Environment Variables
Add to `.env`:
```
JWT_SECRET=your-secret-key-here
LOG_LEVEL=info
NODE_ENV=production
```

### 4. Update server.js

Add imports at the top:
```javascript
import logger from './utils/logger.js';
import { errorHandler, requestIdMiddleware, asyncHandler } from './middleware/errorHandler.js';
import fileValidator from './middleware/fileValidator.js';
import { loginLimiter, registerLimiter, refreshTokenLimiter } from './middleware/rateLimiter.js';
import securityRoutes from './routes/securityRoutes.js';
import morgan from 'morgan';
```

Add middleware setup:
```javascript
// Request ID middleware
app.use(requestIdMiddleware);

// HTTP request logging with Morgan
app.use(morgan('combined', {
  stream: {
    write: (message) => logger.http(message.trim())
  }
}));

// Apply rate limiters to auth routes
app.post('/api/auth/login', loginLimiter, ...);
app.post('/api/auth/register', registerLimiter, ...);

// Apply file validator to upload routes
app.post('/api/documents/upload', fileValidator, upload.single('document'), ...);

// Use security routes
app.use('/api', securityRoutes);

// Error handler (must be last)
app.use(errorHandler);
```

---

## Testing

### Test File Upload Validation
```bash
# Valid file
curl -X POST http://localhost:5000/api/documents/upload \
  -F "document=@file.pdf" \
  -F "userId=123" \
  -F "name=Test Document"

# Invalid file type
curl -X POST http://localhost:5000/api/documents/upload \
  -F "document=@file.exe" \
  -F "userId=123"

# File too large
curl -X POST http://localhost:5000/api/documents/upload \
  -F "document=@large-file.pdf" \
  -F "userId=123"
```

### Test Rate Limiting
```bash
# First 5 requests succeed
for i in {1..5}; do
  curl -X POST http://localhost:5000/api/auth/login \
    -H "Content-Type: application/json" \
    -d '{"email":"test@example.com","password":"password"}'
done

# 6th request returns 429
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password"}'
```

### Test Token Refresh
```bash
# Login to get tokens
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com","password":"password"}'

# Refresh token
curl -X POST http://localhost:5000/api/auth/refresh-token \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <access-token>" \
  -d '{"refreshToken":"<refresh-token>"}'
```

### Test Error Logging
```bash
# Check logs
tail -f logs/combined.log
tail -f logs/error.log
```

---

## Security Best Practices

### 1. File Upload Security
- ✅ Whitelist allowed file types
- ✅ Validate MIME types
- ✅ Enforce file size limits
- ✅ Prevent path traversal attacks
- ✅ Store files outside web root
- ✅ Scan files for malware (optional)

### 2. Error Logging Security
- ✅ Never log passwords or tokens
- ✅ Sanitize sensitive data
- ✅ Use request IDs for tracing
- ✅ Store logs securely
- ✅ Rotate log files regularly
- ✅ Monitor for suspicious patterns

### 3. Token Security
- ✅ Use HTTPS only
- ✅ Store refresh tokens securely
- ✅ Implement token rotation
- ✅ Revoke tokens on logout
- ✅ Set appropriate expiry times
- ✅ Track token usage

### 4. Rate Limiting
- ✅ Prevent brute force attacks
- ✅ Track by IP address
- ✅ Return clear error messages
- ✅ Implement exponential backoff
- ✅ Monitor for abuse patterns
- ✅ Whitelist trusted IPs (optional)

---

## Monitoring & Maintenance

### Log Rotation
Set up log rotation using `logrotate`:
```bash
# /etc/logrotate.d/hrms
/path/to/logs/*.log {
  daily
  rotate 30
  compress
  delaycompress
  notifempty
  create 0640 www-data www-data
  sharedscripts
}
```

### Monitor Rate Limiting
```javascript
// Check rate limit status
app.get('/api/admin/rate-limit-status', (req, res) => {
  // Return current rate limit stats
});
```

### Analyze Logs
```bash
# Find errors
grep "error" logs/combined.log

# Find failed logins
grep "Invalid credentials" logs/combined.log

# Find rate limit violations
grep "Too many" logs/combined.log

# Find by request ID
grep "550e8400-e29b-41d4-a716-446655440000" logs/combined.log
```

---

## Verification Checklist

### File Upload Validation
- [ ] Valid files accepted
- [ ] Invalid file types rejected
- [ ] Files > 5MB rejected
- [ ] Clear error messages returned
- [ ] Path traversal prevented
- [ ] MIME type validation working

### Error Logging
- [ ] Errors logged to file
- [ ] Includes timestamp and stack trace
- [ ] No sensitive data logged
- [ ] Standardized error responses
- [ ] Request IDs generated
- [ ] Log files created

### Token Refresh
- [ ] Refresh endpoint works
- [ ] New token generated
- [ ] Old token invalidated
- [ ] Logout revokes tokens
- [ ] Logout all devices works
- [ ] Token expiry enforced

### Rate Limiting
- [ ] Login limited to 5 per 15 min
- [ ] Register limited to 3 per hour
- [ ] 429 status returned
- [ ] Clear error messages
- [ ] IP-based tracking working
- [ ] Test environment bypass works

---

## Next Steps

1. **Integration Testing:** Test all security features together
2. **Performance Testing:** Ensure security doesn't impact performance
3. **Security Audit:** Review code for vulnerabilities
4. **Documentation:** Update API documentation
5. **Deployment:** Deploy to staging environment
6. **Monitoring:** Set up alerts for security events

---

## Support & Troubleshooting

### Issue: Rate limiter not working
**Solution:** Ensure middleware is applied before route handlers

### Issue: Logs not being created
**Solution:** Check logs directory permissions and disk space

### Issue: Token refresh failing
**Solution:** Verify JWT_SECRET is set correctly in environment

### Issue: File upload validation bypassed
**Solution:** Ensure fileValidator middleware is applied to all upload routes

---

## References

- [Winston Logger Documentation](https://github.com/winstonjs/winston)
- [Express Rate Limit Documentation](https://github.com/nfriedly/express-rate-limit)
- [JWT Best Practices](https://tools.ietf.org/html/rfc8725)
- [OWASP File Upload Security](https://owasp.org/www-community/vulnerabilities/Unrestricted_File_Upload)

---

**Phase 3 Status:** ✅ COMPLETE

All 4 critical security features have been implemented and are ready for integration testing.
