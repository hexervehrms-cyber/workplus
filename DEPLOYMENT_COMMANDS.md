# Deployment Commands Reference

## Pre-Deployment Commands

### Generate JWT Secret
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### Test Local Build
```bash
# Build frontend
npm run build

# Start backend
npm start
```

### Verify Git Status
```bash
git status
git log --oneline -5
```

## Render Deployment (Backend)

### Via Render Dashboard

1. Go to https://render.com
2. Click "New +" → "Web Service"
3. Select your GitHub repository
4. Fill in:
   - **Name**: `workplus-backend`
   - **Environment**: `Node`
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
   - **Plan**: Standard

### Environment Variables to Set on Render

```bash
NODE_ENV=production
PORT=5000
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/workpluspro?retryWrites=true&w=majority
JWT_SECRET=<your-32-char-secret>
CORS_ORIGIN=https://workplus-murex.vercel.app
SUPER_ADMIN_EMAIL=superadmin@company.com
SUPER_ADMIN_PASSWORD=Jadu@123
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

### Redeploy Backend
```bash
# In Render dashboard, click "Manual Deploy" → "Deploy latest commit"
# Or push to GitHub and it will auto-deploy
git push origin main
```

## Vercel Deployment (Frontend)

### Via Vercel Dashboard

1. Go to https://vercel.com
2. Click "Add New..." → "Project"
3. Select your GitHub repository
4. Click "Import"

### Build Settings

- **Framework Preset**: Vite
- **Build Command**: `cd frontend && npm install && npm run build`
- **Output Directory**: `frontend/dist`
- **Install Command**: `npm install`

### Environment Variables to Set on Vercel

```bash
VITE_API_URL=https://workplus-backend-sg3a.onrender.com
VITE_SOCKET_URL=https://workplus-backend-sg3a.onrender.com
VITE_APP_NAME=WorkPlus Pro
VITE_APP_VERSION=1.0.0
VITE_APP_ENV=production
VITE_ENABLE_DEBUG=false
VITE_ENABLE_ANALYTICS=true
```

### Redeploy Frontend
```bash
# In Vercel dashboard, click "Redeploy"
# Or push to GitHub and it will auto-deploy
git push origin main
```

## Local Development Commands

### Install Dependencies
```bash
npm install
cd frontend && npm install
cd ../backend && npm install
```

### Start Development Server
```bash
# Terminal 1: Backend
npm start

# Terminal 2: Frontend
npm run dev
```

### Build for Production
```bash
npm run build
```

### Run Tests
```bash
npm test
```

### Create Indexes
```bash
npm run create-indexes
```

### Initialize RBAC
```bash
npm run init-rbac
```

### Initialize Security
```bash
npm run init-security
```

## Monitoring Commands

### Check Backend Logs (Render)
```bash
# Via Render dashboard:
# Service → Logs
```

### Check Frontend Logs (Vercel)
```bash
# Via Vercel dashboard:
# Deployments → Logs
```

### Monitor Database (MongoDB Atlas)
```bash
# Via MongoDB Atlas dashboard:
# Cluster → Monitoring
```

## Troubleshooting Commands

### Test Backend Connection
```bash
curl -X GET http://localhost:5000/api/auth/me \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### Test Frontend Build
```bash
cd frontend
npm run build
npm run preview
```

### Check Node Version
```bash
node --version
npm --version
```

### Clear npm Cache
```bash
npm cache clean --force
```

### Reinstall Dependencies
```bash
rm -rf node_modules package-lock.json
npm install
```

## Git Commands

### Commit Changes
```bash
git add .
git commit -m "Deploy to production"
```

### Push to GitHub
```bash
git push origin main
```

### Check Git Status
```bash
git status
```

### View Recent Commits
```bash
git log --oneline -10
```

## Environment Variable Commands

### Generate Strong Secret
```bash
# macOS/Linux
openssl rand -hex 32

# Windows PowerShell
[System.Convert]::ToHexString((1..32 | ForEach-Object { Get-Random -Maximum 256 }))

# Node.js (all platforms)
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### Verify Environment Variables
```bash
# Check if .env file exists
ls -la .env

# Check if .env is in .gitignore
cat .gitignore | grep .env

# View environment variables (be careful with secrets!)
cat .env
```

## Database Commands

### MongoDB Connection Test
```bash
# Using MongoDB CLI
mongosh "mongodb+srv://username:password@cluster.mongodb.net/workpluspro"

# Or via MongoDB Atlas UI
# Cluster → Connect → MongoDB Shell
```

### Create Database Indexes
```bash
npm run create-indexes
```

### Initialize RBAC
```bash
npm run init-rbac
```

## Deployment Verification Commands

### Test Frontend URL
```bash
curl https://workplus-murex.vercel.app
```

### Test Backend URL
```bash
curl https://workplus-backend-sg3a.onrender.com/api/auth/me
```

### Check Backend Health
```bash
curl -X GET https://workplus-backend-sg3a.onrender.com/health
```

## Rollback Commands

### Rollback Frontend (Vercel)
```bash
# Via Vercel dashboard:
# Deployments → Select previous deployment → Redeploy
```

### Rollback Backend (Render)
```bash
# Via Render dashboard:
# Service → Deployments → Select previous deployment → Redeploy
```

### Rollback Git
```bash
# Revert last commit
git revert HEAD

# Or reset to previous commit
git reset --hard <commit-hash>
```

## Performance Commands

### Check Frontend Bundle Size
```bash
cd frontend
npm run build
# Check dist/ folder size
du -sh dist/
```

### Analyze Dependencies
```bash
npm list
npm outdated
```

### Check for Vulnerabilities
```bash
npm audit
npm audit fix
```

## Cleanup Commands

### Remove Old Deployments
```bash
# Via Render dashboard: Service → Deployments → Delete old ones
# Via Vercel dashboard: Deployments → Delete old ones
```

### Clean Local Build
```bash
rm -rf frontend/dist
rm -rf backend/dist
```

### Clear Logs
```bash
rm -rf backend/logs/*
```

## Quick Reference

| Task | Command |
|------|---------|
| Generate JWT Secret | `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` |
| Start Backend | `npm start` |
| Start Frontend | `npm run dev` |
| Build Frontend | `npm run build` |
| Test Build | `npm run preview` |
| Create Indexes | `npm run create-indexes` |
| Initialize RBAC | `npm run init-rbac` |
| Check Status | `git status` |
| Push Changes | `git push origin main` |
| View Logs | `npm run logs` |

---

**Note**: Replace placeholder values with your actual values before running commands.

**Last Updated**: May 2, 2026
