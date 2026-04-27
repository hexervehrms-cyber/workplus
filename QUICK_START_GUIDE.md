# WorkPlus Backend - Quick Start Guide

## What Changed?

The backend has been completely stabilized to eliminate random crashes and 500/502 errors.

### Key Improvements
- ✅ Global error handling
- ✅ Database retry logic
- ✅ Socket.IO error isolation
- ✅ Request logging
- ✅ Health checks
- ✅ Graceful shutdown
- ✅ Rate limiting
- ✅ Security headers

---

## Starting the Server

### Development
```bash
npm start
```

### With Logging
```bash
npm start
# Logs go to:
# - Console (colored output)
# - logs/all.log (all logs)
# - logs/error.log (errors only)
```

---

## Health Checks

### Quick Health Check
```bash
curl http://localhost:5000/health
```

**Response**:
```json
{
  "success": true,
  "status": "healthy",
  "database": "connected",
  "timestamp": "2026-04-27T10:00:00.000Z",
  "uptime": 123.45,
  "memory": { ... }
}
```

### Database Health Check
```bash
curl http://localhost:5000/api/health/db
```

**Response**:
```json
{
  "success": true,
  "status": "connected",
  "database": "connected",
  "timestamp": "2026-04-27T10:00:00.000Z"
}
```

---

## Environment Variables

### Required
```env
MONGODB_URI=mongodb+srv://...
JWT_SECRET=your-secret-key (NOT 'supersecretkey')
NODE_ENV=production
```

### Optional
```env
PORT=5000 (defaults to 5000)
CORS_ORIGIN=https://your-domain.com
LOG_LEVEL=debug (defaults to debug)
```

---

## API Endpoints

### Authentication
- `POST /api/auth/login` - Login
- `POST /api/auth/register` - Register
- `GET /api/auth/me` - Get current user
- `POST /api/auth/logout` - Logout
- `POST /api/auth/create-admin` - Create admin (super admin only)

### Users
- `GET /api/users` - Get all users (admin only)

### Documents
- `POST /api/documents/upload` - Upload document
- `GET /api/documents/:userId` - Get user documents
- `GET /api/documents/employee/:employeeId` - Get employee documents
- `GET /api/documents/organization/:organizationId` - Get org documents
- `GET /api/documents/:documentId` - Get document by ID
- `DELETE /api/documents/:documentId` - Delete document
- `PATCH /api/documents/:id/status` - Update document status

### Onboarding
- `POST /api/onboarding/submit` - Submit onboarding form
- `POST /api/onboarding/generate-link` - Generate onboarding link
- `GET /api/onboarding/validate/:token` - Validate onboarding link

### Health
- `GET /` - Server status
- `GET /health` - Health check
- `GET /api/health` - API health check
- `GET /api/health/db` - Database health check

---

## Error Handling

### All Errors Return Clean JSON
```json
{
  "success": false,
  "message": "User-friendly error message",
  "requestId": "unique-request-id"
}
```

### No Stack Traces in Production
- Stack traces only shown in development
- Full errors logged internally
- Request ID for tracing

---

## Rate Limiting

### Login Endpoint
- **Limit**: 5 requests per 15 minutes
- **Status**: 429 Too Many Requests

### Register Endpoint
- **Limit**: 3 requests per hour
- **Status**: 429 Too Many Requests

---

## File Upload

### Limits
- **Max Size**: 5MB
- **Allowed Types**: PDF, DOC, DOCX, XLS, XLSX, JPG, PNG, GIF

### Validation
- File type checked
- MIME type validated
- Filename sanitized
- Size enforced

---

## Socket.IO Events

### Supported Events
- `authenticate` - Authenticate user
- `employee_created` - Employee created
- `employee_updated` - Employee updated
- `employee_deleted` - Employee deleted
- `leave_created` - Leave request created
- `leave_updated` - Leave request updated
- `leave_deleted` - Leave request deleted
- `expense_created` - Expense created
- `expense_updated` - Expense updated
- `expense_deleted` - Expense deleted
- `attendance:create` - Attendance created

### Error Handling
- All socket errors caught and logged
- Socket errors don't crash server
- Automatic reconnection supported

---

## Logging

### Log Files
- `logs/all.log` - All logs
- `logs/error.log` - Errors only

### Log Format
```
2026-04-27 10:00:00:123 info: User logged in
2026-04-27 10:00:01:456 error: Database connection failed
```

### Log Levels
- `error` - Errors
- `warn` - Warnings
- `info` - Info messages
- `http` - HTTP requests
- `debug` - Debug messages

---

## Graceful Shutdown

### Signals Handled
- `SIGTERM` - Render shutdown
- `SIGINT` - Ctrl+C

### Shutdown Sequence
1. Close HTTP server
2. Close Socket.IO
3. Close database connection
4. Exit process

### No Data Loss
- All connections closed cleanly
- Pending requests completed
- Database connection closed properly

---

## Troubleshooting

### Server Won't Start
1. Check `MONGODB_URI` is set
2. Check `JWT_SECRET` is set
3. Check MongoDB is accessible
4. Check port 5000 is available

### Database Connection Failed
- Server will retry automatically
- Max 5 retries with exponential backoff
- Server starts in degraded mode if DB fails

### Socket.IO Not Working
- Check CORS_ORIGIN is set correctly
- Check firewall allows WebSocket
- Check browser console for errors

### High Memory Usage
- Check for memory leaks
- Monitor `logs/all.log`
- Restart server if needed

### Slow Responses
- Check database performance
- Check network latency
- Monitor response times in logs

---

## Monitoring

### Key Metrics
- Error rate (should be <0.1%)
- Response time (should be <200ms)
- Database connection status
- Memory usage
- CPU usage

### Health Check Interval
- Recommended: Every 30 seconds
- Endpoint: `GET /health`
- Timeout: 5 seconds

---

## Security

### Headers Added
- X-Content-Type-Options: nosniff
- X-Frame-Options: DENY
- X-XSS-Protection: 1; mode=block
- Strict-Transport-Security
- Content-Security-Policy

### CORS Whitelist
- https://workplus-murex.vercel.app
- https://workplus-seven.vercel.app
- https://workplus.vercel.app
- http://localhost:5173
- http://localhost:3000
- http://localhost:3001
- Custom origin from CORS_ORIGIN env var

### Rate Limiting
- Login: 5 requests per 15 minutes
- Register: 3 requests per hour

---

## Performance Tips

### Database Queries
- Use `.lean()` for read-only queries
- Add indexes for frequently queried fields
- Limit result sets with pagination

### File Uploads
- Keep files under 5MB
- Use allowed file types only
- Clean up old uploads regularly

### Socket.IO
- Limit room size
- Clean up disconnected sockets
- Monitor connection count

---

## Deployment

### Render Deployment
1. Set environment variables
2. Deploy code
3. Server starts automatically
4. Health checks pass
5. Ready for traffic

### Environment Variables for Render
```env
MONGODB_URI=mongodb+srv://...
JWT_SECRET=your-secret-key
NODE_ENV=production
PORT=5000
```

---

## Support

### Check Logs
```bash
tail -f logs/all.log
tail -f logs/error.log
```

### Health Check
```bash
curl http://localhost:5000/health
```

### Request ID Tracing
- Every request has unique ID
- ID in response headers: `X-Request-ID`
- Use ID to find request in logs

---

## Next Steps

1. ✅ Deploy to production
2. ✅ Monitor error logs
3. ✅ Set up alerts
4. ✅ Add database indexes
5. ✅ Add unit tests
6. ✅ Professional security audit

---

**Last Updated**: April 27, 2026  
**Status**: ✅ Production Ready
