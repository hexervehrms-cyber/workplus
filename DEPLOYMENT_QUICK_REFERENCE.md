# 🚀 DEPLOYMENT QUICK REFERENCE

## ✅ STATUS: CODE PUSHED TO GITHUB

```
Commit: Production: Deploy to Vercel and Render with security fixes
Branch: main
Status: ✅ Ready for deployment
```

---

## 📋 DEPLOYMENT CHECKLIST

### Frontend (Vercel)
- [ ] Go to https://vercel.com
- [ ] Import GitHub repo: `hexervehrms-cyber/workplus`
- [ ] Set root directory: `frontend`
- [ ] Add environment variables (see below)
- [ ] Deploy
- [ ] Verify: https://workplus-murex.vercel.app

### Backend (Render)
- [ ] Go to https://render.com
- [ ] Create Web Service from GitHub
- [ ] Set root directory: `backend`
- [ ] Add environment variables (see below)
- [ ] Deploy
- [ ] Verify: https://workplus-backend-sg3a.onrender.com/api/health

---

## 🔑 ENVIRONMENT VARIABLES

### Frontend (Vercel)
```
VITE_API_URL=https://workplus-backend-sg3a.onrender.com
VITE_SOCKET_URL=https://workplus-backend-sg3a.onrender.com
VITE_APP_ENV=production
VITE_ENABLE_DEBUG=false
VITE_ENABLE_ANALYTICS=true
```

### Backend (Render)
```
NODE_ENV=production
PORT=5000
MONGODB_URI=mongodb+srv://atulcse08_db_user:Jadu%40123@workplus.tcf4qho.mongodb.net/workpluspro?retryWrites=true&w=majority
JWT_SECRET=workplus-pro-production-jwt-secret-key-32-chars-minimum-2024
CORS_ORIGIN=https://workplus-murex.vercel.app
SUPER_ADMIN_EMAIL=superadmin@company.com
SUPER_ADMIN_PASSWORD=Jadu@123
SUPER_ADMIN_NAME=Super Admin
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
FROM_EMAIL=noreply@workpluspro.com
TWILIO_ACCOUNT_SID=your-twilio-account-sid
TWILIO_AUTH_TOKEN=your-twilio-auth-token
TWILIO_PHONE_NUMBER=+1234567890
FIREBASE_PROJECT_ID=your-firebase-project-id
FIREBASE_PRIVATE_KEY=your-firebase-private-key
FIREBASE_CLIENT_EMAIL=your-firebase-client-email
```

---

## 👤 LOGIN CREDENTIALS

```
Email: superadmin@company.com
Password: Jadu@123
```

---

## 🔗 DEPLOYMENT URLS

| Service | URL |
|---------|-----|
| Frontend | https://workplus-murex.vercel.app |
| Backend | https://workplus-backend-sg3a.onrender.com |
| GitHub | https://github.com/hexervehrms-cyber/workplus |

---

## ⏱️ ESTIMATED TIME

- Frontend deployment: 2-3 minutes
- Backend deployment: 5-10 minutes
- Total: ~15 minutes

---

## 🧪 QUICK TEST

1. Open https://workplus-murex.vercel.app
2. Login with superadmin@company.com / Jadu@123
3. Go to Profile → Official Information
4. Fill in fields and click Save
5. Refresh page
6. Data should persist ✅

---

## 📞 TROUBLESHOOTING

| Issue | Solution |
|-------|----------|
| Frontend won't load | Check Vercel logs, verify environment variables |
| Backend 502 error | Check Render logs, verify MongoDB connection |
| Login fails | Verify JWT_SECRET and CORS_ORIGIN are correct |
| Profile data not saving | Check backend logs, verify API connection |

---

## 📚 FULL DOCUMENTATION

- `DEPLOYMENT_COMPLETE.md` - Full deployment guide
- `DEPLOYMENT_GUIDE.md` - Detailed step-by-step instructions
- `SECURITY_CRITICAL.md` - Security best practices
- `VERIFY_SECURITY.md` - Security verification checklist

---

**Ready to deploy? Start with Vercel, then Render!**

