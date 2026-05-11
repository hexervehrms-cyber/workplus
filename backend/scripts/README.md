# WorkPlus Pro - Super Admin Scripts

This directory contains scripts for managing and testing the Super Admin account.

## 📋 Available Scripts

### 1. `seed-super-admin.js` - Manual Seeding Script

**Purpose**: Manually seed or fix the Super Admin account in the database.

**Usage**:
```bash
node scripts/seed-super-admin.js
```

**What it does**:
- Connects to MongoDB
- Checks if Super Admin exists
- Creates Super Admin if missing
- Updates Super Admin if configuration is wrong
- Verifies password hash
- Confirms login credentials work

**When to use**:
- First time setup
- After database reset
- If Super Admin login is not working
- To fix Super Admin password

**Output**:
```
✅ SUPER ADMIN READY
📋 CREDENTIALS:
   Email: admin@workpluspro.com
   Password: Jadu@123
   Role: super_admin
```

---

### 2. `test-super-admin-login.js` - Database Login Test

**Purpose**: Test Super Admin login flow against the database directly.

**Usage**:
```bash
node scripts/test-super-admin-login.js
```

**What it does**:
- Connects to MongoDB
- Checks if Super Admin exists in database
- Verifies password hash
- Simulates complete login flow
- Tests JWT token generation
- Optionally tests HTTP endpoint (if server is running)

**Tests performed**:
1. ✅ Super Admin exists in database
2. ✅ Password hash is valid
3. ✅ Login flow works correctly
4. ✅ JWT token generation works
5. ✅ HTTP login endpoint works (optional)

**Output**:
```
✅ ALL TESTS PASSED
🚀 READY FOR PRODUCTION LOGIN
```

---

### 3. `verify-production-login.js` - Production API Test

**Purpose**: Test Super Admin login against the production API endpoint.

**Usage**:
```bash
node scripts/verify-production-login.js
```

**What it does**:
- Tests production API health
- Tests Super Admin login via HTTP
- Verifies JWT token
- Tests security (wrong credentials should fail)

**Tests performed**:
1. ✅ Server health check
2. ✅ Super Admin login via API
3. ✅ JWT token verification
4. ✅ Wrong credentials rejected

**Output**:
```
✅ ALL TESTS PASSED
🎉 PRODUCTION LOGIN IS WORKING!
```

---

## 🚀 Quick Start Guide

### First Time Setup

1. **Seed Super Admin**:
   ```bash
   node scripts/seed-super-admin.js
   ```

2. **Test Database Login**:
   ```bash
   node scripts/test-super-admin-login.js
   ```

3. **Test Production API**:
   ```bash
   node scripts/verify-production-login.js
   ```

4. **Login to Frontend**:
   - Go to: https://hexerve.online/login
   - Email: `admin@workpluspro.com`
   - Password: `Jadu@123`
   - Click "Sign In"

---

## 🔧 Troubleshooting

### Problem: "Super Admin does not exist"

**Solution**:
```bash
node scripts/seed-super-admin.js
```

This will create the Super Admin account.

---

### Problem: "Password verification failed"

**Solution**:
```bash
node scripts/seed-super-admin.js
```

This will fix the password hash.

---

### Problem: "Database not connected"

**Check**:
1. MongoDB URI in `.env` file
2. MongoDB Atlas cluster is running
3. IP whitelist includes your IP
4. Network connectivity

**Test connection**:
```bash
mongosh "your-mongodb-uri"
```

---

### Problem: "Login failed - Invalid credentials"

**Debug steps**:

1. **Check database**:
   ```bash
   node scripts/test-super-admin-login.js
   ```

2. **Check API**:
   ```bash
   node scripts/verify-production-login.js
   ```

3. **Check environment variables**:
   ```bash
   cat .env | grep SUPER_ADMIN
   ```

4. **Reseed Super Admin**:
   ```bash
   node scripts/seed-super-admin.js
   ```

---

### Problem: "Server not running"

**Check**:
```bash
curl https://workplus-backend-sg3a.onrender.com/health
```

**Expected response**:
```json
{
  "success": true,
  "status": "healthy",
  "database": {
    "status": "connected"
  }
}
```

---

## 📊 Script Comparison

| Script | Purpose | Requires Server | Requires DB | Output |
|--------|---------|----------------|-------------|--------|
| `seed-super-admin.js` | Create/fix Super Admin | ❌ No | ✅ Yes | Credentials |
| `test-super-admin-login.js` | Test database login | ❌ No | ✅ Yes | Test results |
| `verify-production-login.js` | Test API login | ✅ Yes | ✅ Yes | Test results |

---

## 🔐 Security Notes

### Environment Variables

All scripts read credentials from `.env` file:

```env
SUPER_ADMIN_EMAIL=admin@workpluspro.com
SUPER_ADMIN_PASSWORD=Jadu@123
SUPER_ADMIN_NAME=Super Admin
```

### Password Security

- Passwords are hashed using bcrypt with 12 rounds
- Password hash is never logged
- Only password verification results are logged

### Production Safety

- Scripts only create ONE Super Admin
- Never create duplicates
- Never reseed password repeatedly (only if mismatch detected)
- All operations are idempotent

---

## 📝 Automatic Seeding

The server automatically seeds Super Admin on startup:

**File**: `server.js`

**Function**: `seedSuperAdmin()`

**When**: After successful database connection

**Logic**:
1. Check if Super Admin exists
2. If not, create it
3. If exists, verify configuration
4. Update if needed
5. Verify login credentials

**Logs**:
```
🔐 Checking Super Admin account...
✅ Super Admin created successfully
   Email: admin@workpluspro.com
   Password: Jadu@123
   Role: super_admin
✅ Super Admin login credentials verified
```

---

## 🧪 Testing Workflow

### Development Testing

1. Start server:
   ```bash
   npm start
   ```

2. Check logs for:
   ```
   ✅ Super Admin created successfully
   ✅ Super Admin login credentials verified
   ```

3. Test login:
   ```bash
   node scripts/test-super-admin-login.js
   ```

### Production Testing

1. Deploy to production

2. Check server logs for seeding confirmation

3. Test API:
   ```bash
   node scripts/verify-production-login.js
   ```

4. Test frontend login:
   - Go to login page
   - Enter credentials
   - Verify redirect to dashboard

---

## 📞 Support

If you encounter issues:

1. **Check server logs** for error messages
2. **Run test scripts** to identify the problem
3. **Reseed Super Admin** if needed
4. **Check environment variables** are correct
5. **Verify database connection** is working

---

## ✅ Success Checklist

- [ ] Super Admin exists in database
- [ ] Password hash is correct
- [ ] Login flow works in tests
- [ ] API login endpoint works
- [ ] Frontend login works
- [ ] Redirect to dashboard works
- [ ] JWT token is valid
- [ ] Wrong credentials are rejected

---

## 🎯 Expected Results

### After Seeding:
```
✅ Super Admin created successfully
   Email: admin@workpluspro.com
   Password: Jadu@123
   Role: super_admin
✅ Super Admin login credentials verified
```

### After Testing:
```
✅ ALL TESTS PASSED
🚀 READY FOR PRODUCTION LOGIN
```

### After Production Verification:
```
✅ ALL TESTS PASSED
🎉 PRODUCTION LOGIN IS WORKING!
✅ System is production-ready!
```

---

## 📚 Additional Resources

- **User Model**: `models/User.js`
- **Login Route**: `server.js` (line ~580)
- **Seeding Function**: `server.js` (line ~1560)
- **Environment Config**: `.env`

---

**Last Updated**: April 27, 2026  
**Version**: 1.0.0  
**Status**: Production Ready ✅
