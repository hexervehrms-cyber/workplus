# 🔐 Security Verification Checklist

Run these commands to verify your security setup is correct.

## 1. Verify .env is in .gitignore

```bash
# Check if .env is ignored
git check-ignore -v .env

# Expected output:
# .gitignore:15:	.env
```

If you see nothing, `.env` is NOT properly ignored! Fix it immediately.

## 2. Verify .env is NOT in Git history

```bash
# Check if .env was ever committed
git log --all --full-history -- .env

# Expected output:
# (nothing - empty result)
```

If you see commits, `.env` was committed! See SECURITY_CRITICAL.md for recovery steps.

## 3. Verify backend/.env is ignored

```bash
# Check if backend/.env is ignored
git check-ignore -v backend/.env

# Expected output:
# backend/.gitignore:3:	.env
```

## 4. Verify .env.example exists

```bash
# Check if .env.example exists
ls -la backend/.env.example

# Expected output:
# -rw-r--r--  1 user  group  2048 May  2 12:00 backend/.env.example
```

## 5. Verify .env.example has NO real secrets

```bash
# Check .env.example for real credentials
grep -E "mongodb\+srv://.*:.*@|JWT_SECRET=workplus-pro|Jadu@123" backend/.env.example

# Expected output:
# (nothing - should not find real credentials)
```

## 6. Verify no secrets in code

```bash
# Search for hardcoded secrets in JavaScript/TypeScript
grep -r "mongodb+srv://" --include="*.js" --include="*.ts" backend/
grep -r "JWT_SECRET" --include="*.js" --include="*.ts" backend/
grep -r "password" --include="*.js" --include="*.ts" backend/ | grep -v "// password"

# Expected output:
# (nothing - should not find hardcoded secrets)
```

## 7. Verify no secrets in environment files

```bash
# Check all .env files are properly ignored
git status --ignored | grep .env

# Expected output:
# (nothing - all .env files should be ignored)
```

## 8. Verify .gitignore syntax

```bash
# Check .gitignore for syntax errors
git check-ignore -v .

# Should complete without errors
```

## 9. List all ignored files

```bash
# See what's being ignored
git status --ignored

# Should include:
# .env
# backend/.env
# node_modules/
# dist/
# etc.
```

## 10. Verify Git configuration

```bash
# Check Git is configured correctly
git config --list | grep -E "user.name|user.email"

# Expected output:
# user.name=Your Name
# user.email=your.email@example.com
```

## Quick Verification Script

Run this script to verify everything:

```bash
#!/bin/bash

echo "🔐 Security Verification"
echo "======================="
echo ""

# Check 1: .env in .gitignore
echo "✓ Checking .env in .gitignore..."
if git check-ignore -q .env; then
    echo "  ✅ .env is properly ignored"
else
    echo "  ❌ .env is NOT ignored - SECURITY RISK!"
fi

# Check 2: .env not in history
echo "✓ Checking .env not in Git history..."
if git log --all --full-history -- .env | grep -q .; then
    echo "  ❌ .env found in Git history - SECURITY RISK!"
else
    echo "  ✅ .env not in Git history"
fi

# Check 3: .env.example exists
echo "✓ Checking .env.example exists..."
if [ -f backend/.env.example ]; then
    echo "  ✅ .env.example exists"
else
    echo "  ❌ .env.example not found"
fi

# Check 4: No real secrets in .env.example
echo "✓ Checking .env.example has no real secrets..."
if grep -q "mongodb+srv://.*:.*@" backend/.env.example; then
    echo "  ❌ Real MongoDB URI found in .env.example!"
else
    echo "  ✅ No real MongoDB URI in .env.example"
fi

# Check 5: No hardcoded secrets in code
echo "✓ Checking for hardcoded secrets in code..."
if grep -r "mongodb+srv://" backend/ --include="*.js" --include="*.ts" | grep -v ".env" | grep -q .; then
    echo "  ❌ Hardcoded MongoDB URI found in code!"
else
    echo "  ✅ No hardcoded MongoDB URI in code"
fi

echo ""
echo "✅ Security verification complete!"
```

Save as `verify-security.sh` and run:
```bash
chmod +x verify-security.sh
./verify-security.sh
```

## Expected Results

All checks should show ✅:

```
🔐 Security Verification
=======================

✓ Checking .env in .gitignore...
  ✅ .env is properly ignored
✓ Checking .env not in Git history...
  ✅ .env not in Git history
✓ Checking .env.example exists...
  ✅ .env.example exists
✓ Checking .env.example has no real secrets...
  ✅ No real MongoDB URI in .env.example
✓ Checking for hardcoded secrets in code...
  ✅ No hardcoded MongoDB URI in code

✅ Security verification complete!
```

## If Any Check Fails

### .env is NOT ignored
```bash
# Add to .gitignore
echo ".env" >> .gitignore
git add .gitignore
git commit -m "Security: Add .env to .gitignore"
```

### .env is in Git history
See SECURITY_CRITICAL.md for recovery steps.

### .env.example has real secrets
```bash
# Replace with dummy values
cp backend/.env.example backend/.env.example.bak
# Edit backend/.env.example and replace real values with examples
git add backend/.env.example
git commit -m "Security: Remove real secrets from .env.example"
```

### Hardcoded secrets in code
```bash
# Remove hardcoded secrets and use environment variables instead
# Example: Replace
# const secret = "my-secret-key"
# With:
# const secret = process.env.JWT_SECRET
```

## Deployment Security Checklist

Before deploying to Render/Vercel:

- [ ] `.env` is in `.gitignore`
- [ ] `.env` is NOT in Git history
- [ ] `.env.example` exists with dummy values
- [ ] No hardcoded secrets in code
- [ ] All secrets set in Render environment variables
- [ ] All secrets set in Vercel environment variables
- [ ] CORS_ORIGIN is correct
- [ ] JWT_SECRET is strong (32+ characters)
- [ ] Database password is strong
- [ ] HTTPS is enabled (automatic)

## Ongoing Security

### Weekly
- [ ] Review access logs
- [ ] Check for suspicious activity

### Monthly
- [ ] Audit environment variables
- [ ] Review Git commits for secrets
- [ ] Check dependency vulnerabilities: `npm audit`

### Quarterly
- [ ] Rotate JWT_SECRET
- [ ] Rotate database password
- [ ] Rotate API keys

### Annually
- [ ] Security audit
- [ ] Penetration testing
- [ ] Update security policies

---

**Status**: ✅ Ready for Verification
**Last Updated**: May 2, 2026
