# WorkPlus Deployment Checklist

## Pre-Deployment

- [ ] All code committed to GitHub
- [ ] No `.env` files committed (check `.gitignore`)
- [ ] All tests passing locally
- [ ] Frontend builds successfully: `npm run build`
- [ ] Backend starts successfully: `npm start`
- [ ] MongoDB Atlas cluster created and accessible
- [ ] All required API keys and secrets prepared

## Backend Deployment (Render)

### Setup
- [ ] Render account created
- [ ] GitHub repository connected to Render
- [ ] MongoDB Atlas connection string obtained
- [ ] JWT_SECRET generated (min 32 characters)

### Environment Variables Set
- [ ] `NODE_ENV=production`
- [ ] `PORT=5000`
- [ ] `MONGODB_URI=<your-mongodb-uri>`
- [ ] `JWT_SECRET=<your-secret>`
- [ ] `CORS_ORIGIN=https://workplus-murex.vercel.app`
- [ ] `SUPER_ADMIN_EMAIL=superadmin@company.com`
- [ ] `SUPER_ADMIN_PASSWORD=<secure-password>`
- [ ] `SUPER_ADMIN_NAME=Super Admin`
- [ ] SMTP variables (if using email)
- [ ] Twilio variables (if using SMS)
- [ ] Firebase variables (if using push notifications)

### Deployment
- [ ] Build command set: `npm install`
- [ ] Start command set: `npm start`
- [ ] Deployment triggered
- [ ] Deployment successful (check logs)
- [ ] Backend URL obtained: `https://workplus-backend-sg3a.onrender.com`
- [ ] Backend health check passed (can access `/api/auth/me` with token)

## Frontend Deployment (Vercel)

### Setup
- [ ] Vercel account created
- [ ] GitHub repository connected to Vercel
- [ ] Project imported

### Build Configuration
- [ ] Framework: Vite
- [ ] Build Command: `cd frontend && npm install && npm run build`
- [ ] Output Directory: `frontend/dist`
- [ ] Install Command: `npm install`

### Environment Variables Set
- [ ] `VITE_API_URL=https://workplus-backend-sg3a.onrender.com`
- [ ] `VITE_SOCKET_URL=https://workplus-backend-sg3a.onrender.com`
- [ ] `VITE_APP_NAME=WorkPlus Pro`
- [ ] `VITE_APP_VERSION=1.0.0`
- [ ] `VITE_APP_ENV=production`
- [ ] `VITE_ENABLE_DEBUG=false`
- [ ] `VITE_ENABLE_ANALYTICS=true`

### Deployment
- [ ] Deployment triggered
- [ ] Deployment successful (check logs)
- [ ] Frontend URL obtained: `https://workplus-murex.vercel.app`
- [ ] Frontend loads without errors

## Post-Deployment Testing

### Backend Tests
- [ ] Backend is accessible from frontend
- [ ] Database connection working
- [ ] Super admin user can be created
- [ ] Login endpoint working
- [ ] JWT tokens being generated correctly
- [ ] CORS headers correct
- [ ] API endpoints responding

### Frontend Tests
- [ ] Frontend loads without errors
- [ ] Can navigate to login page
- [ ] Can login with super admin credentials
- [ ] Dashboard loads with data
- [ ] Can create new employee
- [ ] Can edit employee information
- [ ] Can save and retrieve data
- [ ] Profile page shows saved data after refresh
- [ ] All forms working correctly

### Integration Tests
- [ ] Frontend → Backend communication working
- [ ] Data persists after page refresh
- [ ] WebSocket connection working (if applicable)
- [ ] File uploads working
- [ ] Email notifications working (if configured)
- [ ] SMS notifications working (if configured)

## Security Verification

- [ ] HTTPS enabled on both frontend and backend
- [ ] CORS properly configured
- [ ] JWT_SECRET is strong (32+ characters)
- [ ] No sensitive data in logs
- [ ] Environment variables not exposed
- [ ] Database credentials secure
- [ ] API keys not visible in frontend code
- [ ] Rate limiting enabled
- [ ] Input validation working

## Performance Checks

- [ ] Frontend loads in < 3 seconds
- [ ] API responses < 500ms
- [ ] Database queries optimized
- [ ] No console errors
- [ ] No memory leaks
- [ ] Images optimized
- [ ] CSS/JS minified

## Monitoring Setup

- [ ] Render logs accessible
- [ ] Vercel logs accessible
- [ ] Error tracking configured (if using Sentry, etc.)
- [ ] Performance monitoring enabled
- [ ] Uptime monitoring configured

## Documentation

- [ ] Deployment guide updated
- [ ] Environment variables documented
- [ ] API endpoints documented
- [ ] Known issues documented
- [ ] Troubleshooting guide created

## Final Checks

- [ ] All team members notified of deployment
- [ ] Backup of production database created
- [ ] Rollback plan documented
- [ ] Support contact information available
- [ ] Deployment date/time logged

## Post-Deployment

- [ ] Monitor logs for errors (first 24 hours)
- [ ] Test all critical user flows
- [ ] Verify data integrity
- [ ] Check performance metrics
- [ ] Gather user feedback
- [ ] Document any issues found
- [ ] Plan for next deployment

---

**Deployment Date**: _______________
**Deployed By**: _______________
**Status**: ☐ Successful ☐ Partial ☐ Failed

**Notes**:
```
_________________________________________________________________
_________________________________________________________________
_________________________________________________________________
```

**Rollback Plan** (if needed):
```
_________________________________________________________________
_________________________________________________________________
_________________________________________________________________
```
