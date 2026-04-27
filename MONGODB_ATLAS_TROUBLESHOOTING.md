# 🔍 MongoDB Atlas Connection Troubleshooting Guide

## 🎯 Quick Diagnosis

Run the audit script to diagnose connection issues:

```bash
node scripts/audit-mongodb-connection.js
```

This will test:
- ✅ URI format and parsing
- ✅ DNS resolution
- ✅ MongoDB connection
- ✅ Database access
- ✅ Collections access
- ✅ Write permissions
- ✅ Connection pool

---

## 📊 Current Configuration

**Cluster:** `workplus.tcf4qho.mongodb.net`  
**Database:** `workpluspro`  
**Username:** `atulcse08_db_user`  
**Protocol:** `mongodb+srv` (DNS SRV)

---

## 🚨 Common Issues & Solutions

### Issue 1: "Could not connect to any servers" / IP Whitelist Error

**Symptoms:**
```
Could not connect to any servers in your MongoDB Atlas cluster.
One common reason is that you're trying to access the database 
from an IP that isn't whitelisted.
```

**Root Cause:** Network Access settings are blocking the connection.

**Solution:**

1. **Go to MongoDB Atlas:** https://cloud.mongodb.com/
2. **Select Correct Project** (top-left dropdown)
3. **Go to Network Access** (left sidebar)
4. **Click "Add IP Address"**
5. **Click "ALLOW ACCESS FROM ANYWHERE"**
   - This adds `0.0.0.0/0` to whitelist
6. **Click "Confirm"**
7. **Wait 1-2 minutes** for changes to propagate

**Why 0.0.0.0/0?**
- Render uses dynamic IP addresses
- Your database is still protected by username/password
- This is the standard approach for cloud deployments

---

### Issue 2: "bad auth" / Authentication Failed

**Symptoms:**
```
MongoServerError: bad auth : Authentication failed
```

**Root Cause:** Username or password is incorrect, or user doesn't exist.

**Solution:**

1. **Go to MongoDB Atlas:** https://cloud.mongodb.com/
2. **Go to Database Access** (left sidebar)
3. **Verify user exists:** `atulcse08_db_user`
4. **Check user permissions:**
   - Should have "Atlas Admin" OR
   - "Read and write to any database"
5. **If user doesn't exist, create it:**
   - Click "Add New Database User"
   - Username: `atulcse08_db_user`
   - Password: `Jadu@123`
   - Role: "Read and write to any database"
   - Click "Add User"

**Password Special Characters:**

If password contains special characters, ensure they're URL-encoded:
- `@` → `%40`
- `#` → `%23`
- `$` → `%24`
- `%` → `%25`
- `&` → `%26`

Current password `Jadu@123` is encoded as `Jadu%40123` ✅

---

### Issue 3: Cluster Not Found / DNS Error

**Symptoms:**
```
MongooseError: getaddrinfo ENOTFOUND workplus.tcf4qho.mongodb.net
```

**Root Cause:** Cluster doesn't exist or name is wrong.

**Solution:**

1. **Go to MongoDB Atlas:** https://cloud.mongodb.com/
2. **Check if cluster exists:**
   - Look for cluster named "workplus"
   - Verify it's in the correct project
3. **Get correct cluster hostname:**
   - Click on cluster
   - Click "Connect"
   - Click "Connect your application"
   - Copy the connection string
   - Extract hostname (e.g., `workplus.tcf4qho.mongodb.net`)
4. **Update .env file** if hostname is different

**Common Mistakes:**
- Cluster was deleted
- Wrong project selected
- Cluster name changed
- Typo in hostname

---

### Issue 4: Wrong Project Selected

**Symptoms:**
- Cluster exists but can't connect
- Network Access shows no entries
- Database user doesn't appear

**Root Cause:** MongoDB Atlas has multiple projects, and you're viewing the wrong one.

**Solution:**

1. **Check current project:**
   - Look at top-left corner of MongoDB Atlas
   - Project name is displayed in dropdown
2. **Switch to correct project:**
   - Click project dropdown
   - Select project containing "workplus" cluster
3. **Verify cluster is in this project:**
   - Should see "workplus" cluster in Database view
4. **Configure Network Access in correct project:**
   - Network Access settings are project-specific
   - Add 0.0.0.0/0 in the correct project

---

### Issue 5: SSL/TLS Error

**Symptoms:**
```
error:0A000438:SSL routines:ssl3_read_bytes:tlsv1 alert internal error
```

**Root Cause:** SSL/TLS handshake failure, often related to MongoDB Atlas configuration or Node.js version.

**Solutions:**

**Option 1: Update Connection String**
Add `&tls=true&tlsAllowInvalidCertificates=true` to connection string (development only):

```
mongodb+srv://user:pass@cluster.mongodb.net/db?retryWrites=true&w=majority&tls=true&tlsAllowInvalidCertificates=true
```

**Option 2: Check MongoDB Atlas Cluster**
1. Go to cluster settings
2. Verify cluster is running (not paused)
3. Check cluster tier (M0 free tier should work)

**Option 3: Update Node.js**
- Ensure Node.js version is 18+ (current: 24.14.1 ✅)

---

### Issue 6: Database Doesn't Exist

**Symptoms:**
- Connection works
- But database `workpluspro` doesn't exist

**Root Cause:** Database hasn't been created yet.

**Solution:**

**This is NORMAL!** MongoDB creates databases automatically on first write.

1. **Let the app run**
2. **Database will be created when:**
   - Super admin is seeded
   - First user registers
   - First data is written
3. **Verify database exists:**
   - Go to MongoDB Atlas
   - Click "Browse Collections"
   - Should see `workpluspro` database

---

## 🔧 Step-by-Step Verification Checklist

### Step 1: Verify Cluster Exists

- [ ] Go to https://cloud.mongodb.com/
- [ ] Log in to your account
- [ ] Check project dropdown (top-left)
- [ ] Select correct project
- [ ] Verify cluster "workplus" exists
- [ ] Cluster status is "Active" (not paused)

### Step 2: Verify Database User

- [ ] Go to "Database Access" (left sidebar)
- [ ] Find user: `atulcse08_db_user`
- [ ] User exists and is enabled
- [ ] User has "Read and write to any database" role
- [ ] Password is correct: `Jadu@123`

### Step 3: Verify Network Access

- [ ] Go to "Network Access" (left sidebar)
- [ ] Check if `0.0.0.0/0` is in the list
- [ ] Entry status is "Active" (green checkmark)
- [ ] If not, add it:
  - [ ] Click "Add IP Address"
  - [ ] Click "ALLOW ACCESS FROM ANYWHERE"
  - [ ] Click "Confirm"
  - [ ] Wait 1-2 minutes

### Step 4: Verify Connection String

- [ ] Open `.env` file
- [ ] Check `MONGODB_URI` value
- [ ] Format: `mongodb+srv://username:password@cluster.mongodb.net/database?params`
- [ ] Username: `atulcse08_db_user` ✅
- [ ] Password: `Jadu%40123` (URL-encoded) ✅
- [ ] Cluster: `workplus.tcf4qho.mongodb.net` ✅
- [ ] Database: `workpluspro` ✅

### Step 5: Test Connection

- [ ] Run audit script: `node scripts/audit-mongodb-connection.js`
- [ ] All tests should pass
- [ ] If tests fail, review error messages
- [ ] Follow recommendations in audit output

### Step 6: Start Server

- [ ] Run: `node server.js`
- [ ] Server should start successfully
- [ ] Look for: "✅ MongoDB Connected Successfully"
- [ ] Look for: "✅ Connected to: workplus.tcf4qho.mongodb.net"
- [ ] Look for: "✅ Database: workpluspro"

---

## 🎯 Expected Successful Output

### Audit Script Output

```
🔍 MONGODB CONNECTION AUDIT - WORKPLUS PRO

TEST 1: MongoDB URI Verification
✅ MONGODB_URI environment variable exists
✅ MongoDB URI is valid and parseable
ℹ Protocol: mongodb+srv (DNS SRV)
ℹ Cluster Host: workplus.tcf4qho.mongodb.net
ℹ Database Name: workpluspro
ℹ Username: atulcse08_db_user

TEST 2: DNS Resolution
✅ DNS SRV record found with 3 server(s)

TEST 3: MongoDB Connection
✅ Successfully connected to MongoDB!
ℹ Connected to: workplus-shard-00-00.tcf4qho.mongodb.net
ℹ Database: workpluspro

TEST 4: Database Access
✅ Database ping successful
✅ Can access database list

TEST 5: Collections Access
✅ Can access collections

TEST 6: Write Operation Test
✅ Write operation successful
✅ Test document cleaned up

TEST 7: Connection Pool
✅ Connection pool is active

AUDIT SUMMARY
Tests Passed: 7
Tests Failed: 0
Success Rate: 100%

✅ ALL TESTS PASSED! MongoDB connection is fully functional.
```

### Server Startup Output

```
🚀 Starting WorkPlus Backend Server...
Environment: production
✅ Environment validation passed

✅ Server running on port 5000
✅ Server ready and accepting connections!

Connecting to MongoDB in background...
📊 Cluster: workplus.tcf4qho.mongodb.net
📊 Database: workpluspro
📊 Username: atulcse08_db_user
✅ MongoDB connection established
✅ Connected to: workplus-shard-00-00.tcf4qho.mongodb.net
✅ Database: workpluspro

🔐 Checking Super Admin account...
✅ Super Admin already exists
```

---

## 📞 Still Having Issues?

### Get Detailed Diagnostics

```bash
# Run audit script
node scripts/audit-mongodb-connection.js

# Check server logs
node server.js

# Test health endpoint
curl http://localhost:5000/api/health/db
```

### Common Mistakes Checklist

- [ ] Wrong project selected in MongoDB Atlas
- [ ] Network Access configured in different project
- [ ] Database user created in different project
- [ ] Cluster name typo in connection string
- [ ] Password not URL-encoded
- [ ] Forgot to wait 1-2 minutes after adding IP whitelist
- [ ] Cluster is paused (not active)
- [ ] Free tier cluster reached connection limit

---

## 🔗 Useful Links

- **MongoDB Atlas Dashboard:** https://cloud.mongodb.com/
- **MongoDB Connection String Docs:** https://www.mongodb.com/docs/manual/reference/connection-string/
- **MongoDB Atlas IP Whitelist:** https://www.mongodb.com/docs/atlas/security-whitelist/
- **Mongoose Connection Docs:** https://mongoosejs.com/docs/connections.html

---

## 📊 Connection String Anatomy

```
mongodb+srv://atulcse08_db_user:Jadu%40123@workplus.tcf4qho.mongodb.net/workpluspro?retryWrites=true&w=majority
│              │                 │          │                              │            │
│              │                 │          │                              │            └─ Connection options
│              │                 │          │                              └─ Database name
│              │                 │          └─ Cluster hostname
│              │                 └─ Password (URL-encoded)
│              └─ Username
└─ Protocol (mongodb+srv = DNS SRV)
```

---

**Last Updated:** April 27, 2026  
**Status:** Ready for troubleshooting
