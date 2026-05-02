# Quick Deployment Guide - 5 Minutes

## Step 1: Prepare Your Secrets (2 minutes)

Generate a strong JWT secret:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Gather these values:
- MongoDB URI: `mongodb+srv://user:pass@cluster.mongodb.net/workpluspro?retryWrites=true&w=majority`
- JWT Secret: (generated above)
- Frontend URL: `https://workplus-murex.vercel.app`
- Backend URL: `https://workplus-backend-sg3a.onrender.com`

## Step 2: Deploy Backend to Render (2 minutes)

1. Go to https://render.com
2. Click "New +" → "Web Service"
3. Connect your GitHub repo
4. Fill in:
   - Name: `workplus-backend`
   - Build: `npm install`
   - Start: `npm start`
5. Click "Advanced" and add these env vars:

```
NODE_ENV=production
PORT=5000
MONGODB_URI=<your-mongodb-uri>
JWT_SECRET=<your-jwt-secret>
CORS_ORIGIN=https://workplus-murex.vercel.app
SUPER_ADMIN_EMAIL=superadmin@company.com
SUPER_ADMIN_PASSWORD=Jadu@123
SUPER_ADMIN_NAME=Super Admin
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
FROM_EMAIL=noreply@workpluspro.com
```

6. Click "Deploy"
7. Wait for deployment (2-3 minutes)
8. Copy your backend URL

## Step 3: Deploy Frontend to Vercel (1 minute)

1. Go to https://vercel.com
2. Click "Add New..." → "Project"
3. Import your GitHub repo
4. Click "Deploy"
5. Go to Settings → Environment Variables
6. Add these env vars:

```
VITE_API_URL=<your-backend-url>
VITE_SOCKET_URL=<your-backend-url>
VITE_APP_ENV=production
VITE_ENABLE_DEBUG=false
```

7. Redeploy from Deployments tab
8. Wait for deployment (1-2 minutes)

## Step 4: Test (1 minute)

1. Go to your Vercel frontend URL
2. Login with:
   - Email: `superadmin@company.com`
   - Password: `Jadu@123`
3. If it works, you're done! 🎉

## Troubleshooting

**Backend won't deploy**:
- Check MongoDB URI is correct
- Verify all env vars are set
- Check Render logs

**Frontend shows errors**:
- Verify `VITE_API_URL` is correct
- Clear browser cache
- Check browser console

**Login fails**:
- Verify backend is running
- Check MongoDB connection
- Verify JWT_SECRET is set

## Environment Variables Quick Reference

### Backend (Render)
```
NODE_ENV=production
PORT=5000
MONGODB_URI=mongodb+srv://...
JWT_SECRET=<32-char-secret>
CORS_ORIGIN=https://workplus-murex.vercel.app
SUPER_ADMIN_EMAIL=superadmin@company.com
SUPER_ADMIN_PASSWORD=Jadu@123
SUPER_ADMIN_NAME=Super Admin
```

### Frontend (Vercel)
```
VITE_API_URL=https://workplus-backend-sg3a.onrender.com
VITE_SOCKET_URL=https://workplus-backend-sg3a.onrender.com
VITE_APP_ENV=production
VITE_ENABLE_DEBUG=false
```

## URLs After Deployment

- **Frontend**: https://workplus-murex.vercel.app
- **Backend**: https://workplus-backend-sg3a.onrender.com
- **MongoDB**: Your Atlas cluster

## Next Steps

1. Create real users through the UI
2. Configure email/SMS (optional)
3. Set up monitoring
4. Configure backups
5. Document your setup

---

**Need help?** See `DEPLOYMENT_GUIDE.md` for detailed instructions.
