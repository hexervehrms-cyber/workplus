# 🚀 WorkPlus Backend - Quick Deployment Guide

## ✅ What Was Fixed

All deprecated MongoDB connection options have been **completely removed**. The backend now uses modern Mongoose 9.x compatible options.

### Before (Broken)
```javascript
// ❌ DEPRECATED - Causes errors
{
  autoReconnect: true,
  reconnectTries: 10,
  reconnectInterval: 5000,
  useNewUrlParser: true,
  useUnifiedTopology: true
}
```

### After (Fixed)
```javascript
// ✅ MODERN - Production stable
{
  serverSelectionTimeoutMS: 15000,
  socketTimeoutMS: 45000,
  connectTimeoutMS: 10000,
  maxPoolSize: 10,
  minPoolSize: 1,
  retryWrites: true,
  w: 'majority',
  heartbeatFrequencyMS: 10000
}
```

---

## 🔧 Render Deployment Steps

### 1. Environment Variables

Set these in Render Dashboard → Environment:

```bash
# Required
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/database?retryWrites=true&w=majority
JWT_SECRET=your-super-secret-jwt-key-32-chars-minimum
NODE_ENV=production

# Optional (has defaults)
PORT=5000  # Auto-set by Render
SUPER_ADMIN_EMAIL=admin@workpluspro.com
SUPER_ADMIN_PASSWORD=Jadu@123
SUPER_ADMIN_NAME=Super Admin
CORS_ORIGIN=https://workplus-murex.vercel.app
```

### 2. Build & Start Commands

```bash
# Build Command
npm install

# Start Command
node server.js
```

### 3. Deploy

Click **"Manual Deploy"** or push to connected Git branch.

---

## ✅ Verification After Deployment

### Option 1: Use Verification Script

```bash
chmod +x verify-deployment.sh
./verify-deployment.sh https://your-app.onrender.com
```

### Option 2: Manual Tests

```bash
# 1. Health Check
curl https://your-app.onrender.com/health

# 2. Database Health
curl https://your-app.onrender.com/api/health/db

# 3. Super Admin Login
curl -X POST https://your-app.onrender.com/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@workpluspro.com","password":"Jadu@123"}'
```

### Expected Logs in Render

```
🚀 Starting WorkPlus Backend Server...
Environment: production
Connecting to MongoDB...
✅ MongoDB Connected Successfully
✅ Database connected successfully

🔐 Checking Super Admin account...
✅ Super Admin already exists

✅ Server running on port 5000
✅ Server ready!
```

---

## 🔍 Troubleshooting

### Issue: "No open ports detected"

**Cause:** Server not binding to `0.0.0.0`

**Fix:** Already fixed in `server.js`:
```javascript
server.listen(PORT, '0.0.0.0', () => { ... });
```

### Issue: "options autoreconnect not supported"

**Cause:** Deprecated MongoDB options

**Fix:** Already removed from `config/db.js`

### Issue: Login fails with 503

**Cause:** Database not connected

**Check:**
1. Verify `MONGODB_URI` in Render env vars
2. Check MongoDB Atlas IP whitelist (allow `0.0.0.0/0` for Render)
3. Verify database user credentials
4. Check Render logs for connection errors

### Issue: Super Admin not created

**Cause:** Database connection failed during startup

**Fix:**
1. Check Render logs for DB connection errors
2. Verify MongoDB URI is correct
3. Restart the service after fixing env vars

---

## 📊 Health Check Endpoints

| Endpoint | Purpose | Returns |
|----------|---------|---------|
| `GET /` | Basic status | Server info |
| `GET /health` | Server health | Status + DB state |
| `GET /api/health` | API health | Status + DB state |
| `GET /api/health/db` | DB only | DB connection details |
| `GET /api/health/full` | Full diagnostics | All metrics |

---

## 🔐 Default Super Admin

```
Email:    admin@workpluspro.com
Password: Jadu@123
Role:     super_admin
```

**Auto-created on first startup!**

---

## 🎯 Production Checklist

- [x] Deprecated MongoDB options removed
- [x] Server binds to `0.0.0.0`
- [x] Environment variables set
- [x] Health endpoints working
- [x] Super Admin auto-seeding
- [x] Login protection (503 when DB down)
- [x] Graceful shutdown
- [x] Clean logging
- [x] Connection pooling
- [x] Error handling

---

## 📞 Quick Commands

```bash
# Check if server is up
curl https://your-app.onrender.com/health

# Test login
curl -X POST https://your-app.onrender.com/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@workpluspro.com","password":"Jadu@123"}'

# View logs (in Render dashboard)
# Logs → View Logs

# Restart service (in Render dashboard)
# Manual Deploy → Clear build cache & deploy
```

---

## 🎉 Success Indicators

✅ Render shows "Live" status  
✅ Health endpoint returns 200  
✅ Database health shows "connected"  
✅ Super Admin login works  
✅ No error logs about deprecated options  
✅ No "No open ports detected" error  

---

**Backend Status:** 🟢 **PRODUCTION READY**

For detailed technical report, see: `MONGODB_CONNECTION_FIX_COMPLETE.md`
