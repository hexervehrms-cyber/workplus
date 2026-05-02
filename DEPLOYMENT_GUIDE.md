# WorkPlus HRMS - Deployment Guide

This guide will help you deploy WorkPlus to Vercel (Frontend) and Render (Backend).

## Prerequisites

- GitHub account with the repository pushed
- Vercel account (https://vercel.com)
- Render account (https://render.com)
- MongoDB Atlas account (https://www.mongodb.com/cloud/atlas)
- Environment variables ready

## Part 1: Backend Deployment on Render

### Step 1: Prepare MongoDB Atlas

1. Go to https://www.mongodb.com/cloud/atlas
2. Create a new cluster or use existing one
3. Get your connection string: `mongodb+srv://username:password@cluster.mongodb.net/database?retryWrites=true&w=majority`
4. Keep this connection string safe - you'll need it for Render

### Step 2: Deploy Backend to Render

1. Go to https://render.com and sign in
2. Click "New +" → "Web Service"
3. Connect your GitHub repository
4. Fill in the deployment details:
   - **Name**: `workplus-backend`
   - **Environment**: `Node`
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
   - **Plan**: Standard (or higher for production)

### Step 3: Set Environment Variables on Render

In the Render dashboard, go to your service and add these environment variables:

```
NODE_ENV=production
PORT=5000
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/workpluspro?retryWrites=true&w=majority
JWT_SECRET=your-secure-32-character-secret-key-here
CORS_ORIGIN=https://workplus-murex.vercel.app
SUPER_ADMIN_EMAIL=superadmin@company.com
SUPER_ADMIN_PASSWORD=your-secure-password
SUPER_ADMIN_NAME=Super Admin
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
FROM_EMAIL=noreply@workpluspro.com
TWILIO_ACCOUNT_SID=your-twilio-sid
TWILIO_AUTH_TOKEN=your-twilio-token
TWILIO_PHONE_NUMBER=+1234567890
FIREBASE_PROJECT_ID=your-firebase-project-id
FIREBASE_PRIVATE_KEY=your-firebase-private-key
FIREBASE_CLIENT_EMAIL=your-firebase-email
```

### Step 4: Deploy

Click "Deploy" and wait for the deployment to complete. You'll get a URL like:
`https://workplus-backend-sg3a.onrender.com`

## Part 2: Frontend Deployment on Vercel

### Step 1: Deploy Frontend to Vercel

1. Go to https://vercel.com and sign in
2. Click "Add New..." → "Project"
3. Import your GitHub repository
4. Select the project and click "Import"

### Step 2: Configure Build Settings

In the Vercel dashboard:

1. Go to Settings → General
2. Set **Framework Preset**: `Vite`
3. Set **Build Command**: `cd frontend && npm install && npm run build`
4. Set **Output Directory**: `frontend/dist`
5. Set **Install Command**: `npm install`

### Step 3: Set Environment Variables on Vercel

In the Vercel dashboard, go to Settings → Environment Variables and add:

```
VITE_API_URL=https://workplus-backend-sg3a.onrender.com
VITE_SOCKET_URL=https://workplus-backend-sg3a.onrender.com
VITE_APP_NAME=WorkPlus Pro
VITE_APP_VERSION=1.0.0
VITE_APP_ENV=production
VITE_ENABLE_DEBUG=false
VITE_ENABLE_ANALYTICS=true
```

**Important**: Replace `https://workplus-backend-sg3a.onrender.com` with your actual Render backend URL.

### Step 4: Deploy

Click "Deploy" and wait for the deployment to complete. You'll get a URL like:
`https://workplus-murex.vercel.app`

## Part 3: Post-Deployment Configuration

### Step 1: Update CORS on Backend

After getting your Vercel frontend URL, update the `CORS_ORIGIN` environment variable on Render:

```
CORS_ORIGIN=https://workplus-murex.vercel.app
```

### Step 2: Update Frontend API URL

Make sure the `VITE_API_URL` on Vercel points to your Render backend:

```
VITE_API_URL=https://workplus-backend-sg3a.onrender.com
```

### Step 3: Test the Connection

1. Go to your Vercel frontend URL
2. Try to login with the super admin credentials:
   - Email: `superadmin@company.com`
   - Password: `Jadu@123` (or your configured password)
3. If login works, the deployment is successful!

## Environment Variables Reference

### Backend (Render)

| Variable | Description | Example |
|----------|-------------|---------|
| `NODE_ENV` | Environment mode | `production` |
| `PORT` | Server port | `5000` |
| `MONGODB_URI` | MongoDB connection string | `mongodb+srv://...` |
| `JWT_SECRET` | JWT signing secret (min 32 chars) | `your-secret-key` |
| `CORS_ORIGIN` | Frontend URL for CORS | `https://workplus-murex.vercel.app` |
| `SUPER_ADMIN_EMAIL` | Super admin email | `superadmin@company.com` |
| `SUPER_ADMIN_PASSWORD` | Super admin password | `secure-password` |

### Frontend (Vercel)

| Variable | Description | Example |
|----------|-------------|---------|
| `VITE_API_URL` | Backend API URL | `https://workplus-backend-sg3a.onrender.com` |
| `VITE_SOCKET_URL` | WebSocket URL | `https://workplus-backend-sg3a.onrender.com` |
| `VITE_APP_ENV` | App environment | `production` |

## Troubleshooting

### Backend won't start on Render

1. Check the logs in Render dashboard
2. Verify MongoDB connection string is correct
3. Ensure all required environment variables are set
4. Check that the `backend/server.js` file exists

### Frontend shows blank page

1. Check browser console for errors
2. Verify `VITE_API_URL` is correct
3. Check that backend is running and accessible
4. Clear browser cache and reload

### CORS errors

1. Verify `CORS_ORIGIN` on backend matches your Vercel URL
2. Restart the backend service on Render
3. Clear browser cache

### Login not working

1. Verify MongoDB connection is working
2. Check that super admin user was created
3. Verify JWT_SECRET is set correctly
4. Check backend logs for errors

## Monitoring

### Render Dashboard

- View logs: Service → Logs
- Monitor performance: Service → Metrics
- Manage environment variables: Service → Environment

### Vercel Dashboard

- View logs: Deployments → Logs
- Monitor performance: Analytics
- Manage environment variables: Settings → Environment Variables

## Security Best Practices

1. **Never commit `.env` files** - Use environment variables instead
2. **Use strong JWT_SECRET** - At least 32 characters, random
3. **Rotate secrets periodically** - Change JWT_SECRET every 3-6 months
4. **Enable HTTPS** - Both Render and Vercel provide HTTPS by default
5. **Use environment-specific secrets** - Different secrets for dev/prod
6. **Monitor logs** - Check for suspicious activity
7. **Keep dependencies updated** - Run `npm audit` regularly

## Scaling

### For increased traffic:

**Backend (Render)**:
- Upgrade plan from Standard to Pro or higher
- Enable auto-scaling if available
- Consider database optimization

**Frontend (Vercel)**:
- Vercel automatically scales
- Monitor bandwidth usage
- Optimize images and assets

## Support

For issues or questions:
1. Check the logs in Render/Vercel dashboards
2. Review this deployment guide
3. Check the main README.md for project setup
4. Contact support for platform-specific issues

---

**Deployment URLs**:
- Frontend: https://workplus-murex.vercel.app
- Backend: https://workplus-backend-sg3a.onrender.com
- MongoDB: Your Atlas cluster

**Last Updated**: May 2, 2026
