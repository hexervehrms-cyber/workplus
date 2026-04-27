# PHASE 3: SERVER INTEGRATION GUIDE

## How to Integrate Security Features into server.js

### Step 1: Add Imports at the Top

Add these imports after the existing imports in `server.js`:

```javascript
// Security imports
import logger from './utils/logger.js';
import { errorHandler, requestIdMiddleware, asyncHandler } from './middleware/errorHandler.js';
import fileValidator from './middleware/fileValidator.js';
import { loginLimiter, registerLimiter, refreshTokenLimiter } from './middleware/rateLimiter.js';
import securityRoutes from './routes/securityRoutes.js';
import morgan from 'morgan';
import RefreshToken from './models/RefreshToken.js';
import { generateTokenPair, revokeRefreshToken, revokeAllUserTokens } from './services/authService.js';
```

### Step 2: Add Middleware Setup

Add this after `app.use(express.json());` and before route definitions:

```javascript
// ============================================
// SECURITY MIDDLEWARE SETUP
// ============================================

// Request ID middleware - adds unique ID to each request for tracing
app.use(requestIdMiddleware);

// HTTP request logging with Morgan
app.use(morgan('combined', {
  stream: {
    write: (message) => logger.http(message.trim())
  }
}));

logger.info('Security middleware initialized');
```

### Step 3: Update Auth Routes with Rate Limiting

Replace the existing auth routes with these updated versions:

```javascript
// ============================================
// UPDATED AUTHENTICATION ENDPOINTS WITH SECURITY
// ============================================

// POST /api/auth/login - with rate limiting
app.post("/api/auth/login", loginLimiter, async (req, res) => {
  try {
    const { email, password } = req.body;

    // Validate input
    if (!email || !password) {
      return res.status(400).json({ success: false, message: "Email and password are required" });
    }

    // Find user in database
    const user = await User.findOne({ email });
    
    if (!user) {
      logger.warn('Login attempt with non-existent email', { email, ip: req.ip });
      return res.status(401).json({ success: false, message: "Invalid credentials" });
    }

    // Verify password using bcrypt
    const isPasswordValid = await bcrypt.compare(password, user.password);
    
    if (!isPasswordValid) {
      logger.warn('Login attempt with invalid password', { email, ip: req.ip });
      return res.status(401).json({ success: false, message: "Invalid credentials" });
    }

    // Generate token pair (access + refresh)
    const ipAddress = req.ip || req.connection.remoteAddress;
    const userAgent = req.get('user-agent');
    const tokens = await generateTokenPair(user, ipAddress, userAgent);

    logger.info('User logged in successfully', { userId: user._id, email });

    res.json({
      success: true,
      message: "Login successful",
      data: {
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          role: user.role,
          avatar: user.avatar || null,
          organization: user.organization || 'WorkPlus Inc.'
        },
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        expiresIn: tokens.expiresIn
      }
    });
  } catch (error) {
    logger.error('Login error', { error: error.message, ip: req.ip });
    res.status(500).json({ success: false, message: "Internal server error" });
  }
});

// POST /api/auth/register - with rate limiting
app.post("/api/auth/register", registerLimiter, async (req, res) => {
  try {
    const { name, email, password, role, organization } = req.body;

    // Validate input
    if (!name || !email || !password) {
      return res.status(400).json({ success: false, message: "Name, email and password are required" });
    }

    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      logger.warn('Registration attempt with existing email', { email, ip: req.ip });
      return res.status(400).json({ success: false, message: "User already exists" });
    }

    // Hash password using bcrypt
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create new user
    const user = await User.create({
      name,
      email,
      password: hashedPassword,
      role: role || 'employee',
      organization: organization || 'WorkPlus Inc.'
    });

    // Generate token pair
    const ipAddress = req.ip || req.connection.remoteAddress;
    const userAgent = req.get('user-agent');
    const tokens = await generateTokenPair(user, ipAddress, userAgent);

    // Emit Socket.IO event for real-time updates
    const userData = {
      id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      avatar: user.avatar || null,
      organization: user.organization || 'WorkPlus Inc.'
    };
    io.emit('employee_created', userData);

    logger.info('User registered successfully', { userId: user._id, email });

    res.status(201).json({
      success: true,
      message: "Registration successful",
      data: {
        user: userData,
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        expiresIn: tokens.expiresIn
      }
    });
  } catch (error) {
    logger.error('Registration error', { error: error.message, ip: req.ip });
    res.status(500).json({ success: false, message: "Internal server error" });
  }
});

// POST /api/auth/refresh-token - with rate limiting
app.post("/api/auth/refresh-token", refreshTokenLimiter, async (req, res) => {
  try {
    const { refreshToken } = req.body;
    const authHeader = req.headers.authorization;

    if (!refreshToken || !authHeader) {
      return res.status(401).json({
        success: false,
        message: 'Refresh token and user ID are required'
      });
    }

    // Extract user ID from Authorization header
    const token = authHeader.replace('Bearer ', '');
    let userId;

    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'supersecretkey');
      userId = decoded.userId;
    } catch (error) {
      logger.warn('Invalid access token in refresh attempt', { ip: req.ip });
      return res.status(401).json({
        success: false,
        message: 'Invalid access token'
      });
    }

    // Verify refresh token exists and is not revoked
    const storedToken = await RefreshToken.findOne({
      token: refreshToken,
      userId,
      isRevoked: false
    });

    if (!storedToken || new Date() > storedToken.expiresAt) {
      logger.warn('Invalid or expired refresh token', { userId, ip: req.ip });
      return res.status(401).json({
        success: false,
        message: 'Invalid or expired refresh token'
      });
    }

    // Get user
    const user = await User.findById(userId);
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'User not found'
      });
    }

    // Generate new access token
    const newAccessToken = jwt.sign(
      {
        userId: user._id,
        email: user.email,
        role: user.role,
        tenantId: user.orgId || 'system'
      },
      process.env.JWT_SECRET || 'supersecretkey',
      { expiresIn: '24h' }
    );

    logger.info('Access token refreshed', { userId });

    res.json({
      success: true,
      message: 'Token refreshed successfully',
      data: {
        accessToken: newAccessToken,
        expiresIn: 24 * 60 * 60
      }
    });
  } catch (error) {
    logger.error('Token refresh error', { error: error.message, ip: req.ip });
    res.status(500).json({
      success: false,
      message: 'Failed to refresh token'
    });
  }
});

// POST /api/auth/logout
app.post("/api/auth/logout", async (req, res) => {
  try {
    const { refreshToken } = req.body;
    const authHeader = req.headers.authorization;

    if (!authHeader) {
      return res.status(401).json({
        success: false,
        message: "No token provided"
      });
    }

    const token = authHeader.replace('Bearer ', '');
    
    // Verify JWT token
    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET || 'supersecretkey');
    } catch (jwtError) {
      return res.status(401).json({ success: false, message: "Invalid or expired token" });
    }

    // Revoke refresh token if provided
    if (refreshToken) {
      await revokeRefreshToken(refreshToken);
    }

    logger.info('User logged out', { userId: decoded.userId });

    res.json({ success: true, message: "Logout successful" });
  } catch (error) {
    logger.error('Logout error', { error: error.message });
    res.status(500).json({ success: false, message: "Internal server error" });
  }
});

// POST /api/auth/logout-all-devices
app.post("/api/auth/logout-all-devices", async (req, res) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader) {
      return res.status(401).json({
        success: false,
        message: "No token provided"
      });
    }

    const token = authHeader.replace('Bearer ', '');
    
    // Verify JWT token
    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET || 'supersecretkey');
    } catch (jwtError) {
      return res.status(401).json({ success: false, message: "Invalid or expired token" });
    }

    // Revoke all user tokens
    await revokeAllUserTokens(decoded.userId);

    logger.info('User logged out from all devices', { userId: decoded.userId });

    res.json({ success: true, message: "Logged out from all devices successfully" });
  } catch (error) {
    logger.error('Logout all devices error', { error: error.message });
    res.status(500).json({ success: false, message: "Internal server error" });
  }
});
```

### Step 4: Update File Upload Routes with Validation

Update the document upload route:

```javascript
// ============================================
// UPDATED DOCUMENT UPLOAD WITH FILE VALIDATION
// ============================================

// Upload document with file validation
app.post("/api/documents/upload", fileValidator, upload.single('document'), async (req, res) => {
  try {
    const { userId, name, type } = req.body;
    
    if (!req.file) {
      return res.status(400).json({ 
        success: false,
        message: "No file uploaded" 
      });
    }

    const document = new Document({
      userId,
      name,
      type: type || 'general',
      fileName: req.file.originalname,
      filePath: req.file.path,
      size: `${(req.file.size / 1024).toFixed(1)} KB`
    });

    await document.save();
    
    logger.info('Document uploaded successfully', { 
      userId, 
      fileName: req.file.originalname,
      size: req.file.size
    });

    res.status(201).json({
      success: true,
      message: "Document uploaded successfully",
      data: document
    });
  } catch (error) {
    logger.error('Document upload error', { error: error.message });
    res.status(500).json({ 
      success: false,
      message: error.message 
    });
  }
});

// Upload company document with file validation
app.post("/api/company-documents/upload", fileValidator, upload.single('document'), async (req, res) => {
  try {
    const { title, category, description, organizationId, createdBy } = req.body;
    
    if (!req.file) {
      return res.status(400).json({ 
        success: false,
        message: "No file uploaded" 
      });
    }

    const companyDocument = await CompanyDocument.create({
      title,
      category,
      description,
      organizationId,
      createdBy,
      fileName: req.file.originalname,
      filePath: req.file.path,
      fileSize: req.file.size,
      mimeType: req.file.mimetype,
      status: 'Draft',
      isPublic: false
    });

    logger.info('Company document uploaded', { 
      organizationId,
      fileName: req.file.originalname,
      size: req.file.size
    });

    res.status(201).json({
      success: true,
      message: "Document uploaded successfully",
      data: companyDocument
    });
  } catch (error) {
    logger.error('Company document upload error', { error: error.message });
    res.status(500).json({ 
      success: false,
      message: error.message 
    });
  }
});
```

### Step 5: Add Error Handler at the End

Add this at the very end of server.js, before the server.listen() call:

```javascript
// ============================================
// CENTRALIZED ERROR HANDLER (MUST BE LAST)
// ============================================

app.use(errorHandler);

// 404 handler
app.use((req, res) => {
  logger.warn('404 Not Found', { method: req.method, url: req.originalUrl });
  res.status(404).json({
    success: false,
    message: 'Route not found'
  });
});
```

### Step 6: Update Server Startup

Update the server startup code:

```javascript
const PORT = process.env.PORT || 5000;

server.listen(PORT, async () => {
  console.log(`Server running on port ${PORT}`);
  console.log('Socket.IO server initialized');
  console.log('Multi-tenant SaaS architecture enabled');
  console.log('Security features enabled:');
  console.log('  ✓ File upload validation');
  console.log('  ✓ Error logging with Winston');
  console.log('  ✓ Token refresh mechanism');
  console.log('  ✓ Rate limiting');
  
  logger.info('Server started', { port: PORT, environment: process.env.NODE_ENV });
  
  // Seed super admin on server start
  await seedSuperAdmin();
});
```

---

## Environment Variables

Add these to your `.env` file:

```env
# JWT Configuration
JWT_SECRET=your-super-secret-key-change-this-in-production

# Logging
LOG_LEVEL=info
NODE_ENV=production

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=5

# File Upload
MAX_FILE_SIZE=5242880
ALLOWED_FILE_TYPES=pdf,doc,docx,xls,xlsx,jpg,jpeg,png,gif
```

---

## Testing the Integration

### 1. Test File Upload Validation
```bash
# Valid PDF file
curl -X POST http://localhost:5000/api/documents/upload \
  -H "Authorization: Bearer <token>" \
  -F "document=@test.pdf" \
  -F "userId=123" \
  -F "name=Test Document"

# Invalid file type (should fail)
curl -X POST http://localhost:5000/api/documents/upload \
  -H "Authorization: Bearer <token>" \
  -F "document=@test.exe" \
  -F "userId=123"
```

### 2. Test Rate Limiting
```bash
# Make 6 login attempts (5th should succeed, 6th should fail with 429)
for i in {1..6}; do
  echo "Attempt $i:"
  curl -X POST http://localhost:5000/api/auth/login \
    -H "Content-Type: application/json" \
    -d '{"email":"test@example.com","password":"password"}'
  echo ""
done
```

### 3. Test Token Refresh
```bash
# Login
LOGIN_RESPONSE=$(curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com","password":"password"}')

ACCESS_TOKEN=$(echo $LOGIN_RESPONSE | jq -r '.data.accessToken')
REFRESH_TOKEN=$(echo $LOGIN_RESPONSE | jq -r '.data.refreshToken')

# Refresh token
curl -X POST http://localhost:5000/api/auth/refresh-token \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -d "{\"refreshToken\":\"$REFRESH_TOKEN\"}"
```

### 4. Check Logs
```bash
# View all logs
tail -f logs/combined.log

# View only errors
tail -f logs/error.log

# Search for specific user
grep "userId" logs/combined.log
```

---

## Troubleshooting

### Issue: "Cannot find module 'winston'"
**Solution:** Run `npm install winston`

### Issue: Rate limiter not working
**Solution:** Ensure middleware is applied BEFORE route handlers

### Issue: File validator not working
**Solution:** Ensure fileValidator is applied BEFORE multer middleware

### Issue: Logs not being created
**Solution:** 
1. Check logs directory exists: `mkdir -p logs`
2. Check directory permissions: `chmod 755 logs`
3. Check disk space: `df -h`

### Issue: Token refresh failing
**Solution:**
1. Verify JWT_SECRET is set in .env
2. Check RefreshToken model is imported
3. Verify MongoDB connection

---

## Performance Considerations

1. **Rate Limiting:** Uses in-memory store by default. For production with multiple servers, use Redis:
   ```javascript
   import RedisStore from 'rate-limit-redis';
   import redis from 'redis';
   
   const redisClient = redis.createClient();
   const store = new RedisStore({
     client: redisClient,
     prefix: 'rl:'
   });
   ```

2. **Logging:** Logs are written to disk. For high-traffic systems, consider:
   - Log aggregation (ELK, Splunk)
   - Async logging
   - Log sampling

3. **Token Storage:** Refresh tokens are stored in MongoDB. For better performance:
   - Use Redis for token storage
   - Implement token caching
   - Set up TTL indexes

---

## Security Checklist

- [ ] JWT_SECRET is strong and unique
- [ ] HTTPS is enabled in production
- [ ] Rate limits are appropriate for your use case
- [ ] File upload directory is outside web root
- [ ] Logs are stored securely
- [ ] Sensitive data is not logged
- [ ] Error messages don't expose system details
- [ ] CORS is properly configured
- [ ] Database credentials are not in code
- [ ] Regular security audits are scheduled

---

**Integration Complete!** Your HRMS platform now has enterprise-grade security features.
