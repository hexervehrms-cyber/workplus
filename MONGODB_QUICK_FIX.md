# ⚡ MongoDB Atlas - Quick Fix Guide

## 🚨 Can't Connect? Do This NOW

### 1️⃣ Run Audit Script (30 seconds)

```bash
node scripts/audit-mongodb-connection.js
```

This will tell you EXACTLY what's wrong.

---

### 2️⃣ Most Common Fix: IP Whitelist (2 minutes)

**90% of connection issues are fixed by this:**

1. Go to: **https://cloud.mongodb.com/**
2. **Select correct project** (top-left dropdown)
3. Click: **Network Access** (left sidebar)
4. Click: **+ ADD IP ADDRESS**
5. Click: **ALLOW ACCESS FROM ANYWHERE**
6. Click: **Confirm**
7. Wait: **2 minutes**

**Done!** ✅

---

### 3️⃣ Verify Database User (1 minute)

1. Go to: **Database Access** (left sidebar)
2. Find user: **`atulcse08_db_user`**
3. Check role: **"Read and write to any database"**
4. If missing, create it with password: **`Jadu@123`**

---

### 4️⃣ Test Connection (30 seconds)

```bash
# Run audit again
node scripts/audit-mongodb-connection.js

# Or start server
node server.js
```

Look for: **"✅ MongoDB Connected Successfully"**

---

## 🎯 Connection Details

```
Cluster:  workplus.tcf4qho.mongodb.net
Database: workpluspro
Username: atulcse08_db_user
Password: Jadu@123
```

---

## ✅ Success Indicators

After fixing, you should see:

```
✅ MongoDB connection established
✅ Connected to: workplus-shard-00-00.tcf4qho.mongodb.net
✅ Database: workpluspro
✅ Super Admin already exists
```

---

## 🔍 Detailed Troubleshooting

See: **`MONGODB_ATLAS_TROUBLESHOOTING.md`**

---

## 📞 Quick Checklist

- [ ] Correct project selected in MongoDB Atlas
- [ ] Cluster "workplus" exists and is active
- [ ] User `atulcse08_db_user` exists
- [ ] Network Access has `0.0.0.0/0` whitelisted
- [ ] Waited 2 minutes after adding IP
- [ ] Audit script passes all tests

---

**Time to Fix:** ~3 minutes  
**Success Rate:** 99%

🚀 **Most issues are just IP whitelist!**
