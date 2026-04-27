/**
 * WorkPlus Backend Server - Production Stable Version
 * 
 * STABILITY FEATURES:
 * - Global error handling with specific error types
 * - Graceful shutdown with cleanup
 * - Database retry logic with auto-reconnect
 * - Async route wrapping
 * - Socket.IO error handling and memory management
 * - Request logging with Winston
 * - Health checks with detailed status
 * - Environment validation
 * - Render proxy compatibility
 * - Rate limiting with correct IP detection
 * - MongoDB connection pooling
 * - Security hardening with Helmet
 */

import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import bcrypt from "bcrypt";
import crypto from "crypto";
import mongoose from "mongoose";
import helmet from "helmet";
import morgan from "morgan";
import path from "path";
import { fileURLToPath } from "url";
import { createServer } from "http";
import { Server } from "socket.io";
import jwt from "jsonwebtoken";
import multer from "multer";
import compression from "compression";

// Import database connection
import connectDB, { isDBConnected, getDBStatus, closeDB } from "./config/db.js";

// Import models
import User from "./models/User.js";
import Employee from "./models/Employee.js";
import Payslip from "./models/Payroll.js";
import AdvanceLoan from "./models/AdvanceLoan.js";
import Document from "./models/Document.js";
import Company from "./models/Company.js";
import Subscription from "./models/Subscription.js";
import Expense from "./models/Expense.js";
import LeaveRequest from "./models/LeaveRequest.js";
import Attendance from "./models/Attendance.js";
import Holiday from "./models/Holiday.js";
import HolidayCalendar from "./models/HolidayCalendar.js";
import CurrencyPreference from "./models/CurrencyPreference.js";
import OnboardingLink from "./models/OnboardingLink.js";
import OnboardingSubmission from "./models/OnboardingSubmission.js";
import CompanyDocument from "./models/CompanyDocument.js";
import DocumentAcknowledgment from "./models/DocumentAcknowledgment.js";
import GeneratedDocument from "./models/GeneratedDocument.js";
import Reminder from "./models/Reminder.js";

// Import middleware
import { 
  errorHandler, 
  requestIdMiddleware, 
  asyncHandler, 
  notFoundHandler,
  DatabaseError 
} from "./middleware/errorHandler.js";
import { tenantMiddleware, subscriptionMiddleware } from "./middleware/tenant.js";
import fileValidator from "./middleware/fileValidator.js";
import { 
  loginLimiter, 
  registerLimiter, 
  apiLimiter,
  getClientIP 
} from "./middleware/rateLimiter.js";

// Import logger
import logger from "./utils/logger.js";

// Load environment variables
dotenv.config();

// ============================================================================
// ENVIRONMENT VALIDATION
// ============================================================================

const validateEnvironment = () => {
  const requiredVars = ['MONGODB_URI', 'JWT_SECRET', 'NODE_ENV'];
  const missing = requiredVars.filter(v => !process.env[v]);
  
  if (missing.length > 0) {
    console.error('❌ Missing required environment variables:', missing.join(', '));
    logger.error('Missing required environment variables', { missing });
    process.exit(1);
  }

  // Validate JWT_SECRET is not default
  if (process.env.JWT_SECRET === 'supersecretkey' || process.env.JWT_SECRET === 'your-super-secret-jwt-key-change-this-in-production') {
    console.warn('⚠️  WARNING: JWT_SECRET is using default value. Change this in production!');
    logger.warn('JWT_SECRET is using default value - security risk!');
  }

  // Validate JWT_SECRET length
  if (process.env.JWT_SECRET.length < 32) {
    console.warn('⚠️  WARNING: JWT_SECRET should be at least 32 characters for security');
    logger.warn('JWT_SECRET is too short - security risk!');
  }

  console.log('✅ Environment validation passed');
  logger.info('Environment validation passed', {
    nodeEnv: process.env.NODE_ENV,
    port: process.env.PORT || 5000
  });
};

validateEnvironment();

// ============================================================================
// SETUP
// ============================================================================

const app = express();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Create HTTP server for Socket.IO
const server = createServer(app);

// ============================================================================
// TRUST PROXY - CRITICAL FOR RENDER DEPLOYMENT
// Fixes ERR_ERL_UNEXPECTED_X_FORWARDED_FOR error
// ============================================================================

// Trust first proxy (Render uses a single proxy layer)
app.set('trust proxy', 1);

// ============================================================================
// CORS CONFIGURATION
// ============================================================================

// CORS whitelist - MUST be defined BEFORE Socket.IO initialization
const allowedOrigins = [
  "https://workplus-murex.vercel.app",
  "https://workplus-seven.vercel.app",
  "https://workplus.vercel.app",
  "http://localhost:5173",
  "http://localhost:3000",
  "http://localhost:3001",
  process.env.CORS_ORIGIN
].filter(Boolean);

// Log allowed origins for debugging
logger.info('CORS allowed origins', { origins: allowedOrigins });

const corsOptions = {
  origin: function(origin, callback) {
    // Allow requests with no origin (mobile apps, curl, etc.)
    if (!origin) return callback(null, true);
    
    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      logger.warn(`CORS blocked origin: ${origin}`);
      callback(new Error("Not allowed by CORS"));
    }
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With", "X-Request-ID"],
  exposedHeaders: ["X-Request-ID", "X-RateLimit-Limit", "X-RateLimit-Remaining"],
  optionsSuccessStatus: 200,
  maxAge: 86400 // 24 hours
};

// ============================================================================
// SOCKET.IO SETUP
// ============================================================================

// Initialize Socket.IO with CORS options
const io = new Server(server, {
  cors: corsOptions,
  transports: ['websocket', 'polling'],
  pingInterval: 25000,
  pingTimeout: 60000,
  // Connection state recovery
  connectionStateRecovery: {
    maxDisconnectionDuration: 2 * 60 * 1000, // 2 minutes
    skipMiddlewares: true
  }
});

// Track connected sockets for cleanup
const connectedSockets = new Map();

// ============================================================================
// SECURITY MIDDLEWARE
// ============================================================================

// Helmet for security headers
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "blob:"],
      connectSrc: ["'self'", ...allowedOrigins],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"]
    }
  },
  crossOriginEmbedderPolicy: false,
  crossOriginResourcePolicy: { policy: "cross-origin" }
}));

// Compression middleware
app.use(compression({
  filter: (req, res) => {
    if (req.headers['x-no-compression']) {
      return false;
    }
    return compression.filter(req, res);
  },
  threshold: 1024 // Only compress responses > 1KB
}));

// ============================================================================
// REQUEST LOGGING
// ============================================================================

app.use(morgan('combined', {
  stream: {
    write: (message) => logger.http(message.trim())
  },
  skip: (req) => {
    // Skip logging health checks
    return req.path === '/health' || req.path === '/api/health';
  }
}));

// ============================================================================
// MIDDLEWARE SETUP
// ============================================================================

// CORS
app.use(cors(corsOptions));
app.options('*', cors(corsOptions));

// Request ID middleware
app.use(requestIdMiddleware);

// Request timeout middleware - prevent hanging requests
app.use((req, res, next) => {
  // Set timeout for request (30 seconds)
  req.setTimeout(30000, () => {
    logger.warn('Request timeout', { 
      url: req.url, 
      method: req.method,
      ip: getClientIP(req),
      requestId: req.id
    });
    
    if (!res.headersSent) {
      res.status(408).json({
        success: false,
        message: 'Request timeout - operation took too long',
        code: 'REQUEST_TIMEOUT'
      });
    }
  });
  
  // Set timeout for response (30 seconds)
  res.setTimeout(30000, () => {
    logger.warn('Response timeout', { 
      url: req.url, 
      method: req.method,
      requestId: req.id
    });
  });
  
  next();
});

// Body parsing with size limits
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));

// Static files
app.use('/uploads', express.static(path.join(__dirname, 'uploads'), {
  maxAge: '1d',
  etag: true
}));

// ============================================================================
// MULTER CONFIGURATION
// ============================================================================

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'uploads/');
  },
  filename: function (req, file, cb) {
    // Sanitize filename
    const sanitized = file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_');
    cb(null, Date.now() + '-' + sanitized);
  }
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB
  },
  fileFilter: (req, file, cb) => {
    // Validate file type
    const allowedMimes = [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'image/jpeg',
      'image/png',
      'image/gif'
    ];
    
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type'));
    }
  }
});

// ============================================================================
// HEALTH CHECK ENDPOINTS
// ============================================================================

app.get("/", (req, res) => {
  res.json({
    success: true,
    message: "WorkPlus backend running",
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || "production",
    version: "1.0.0"
  });
});

app.get("/health", asyncHandler(async (req, res) => {
  const dbStatus = getDBStatus();
  const isConnected = isDBConnected();
  
  res.json({
    success: true,
    status: isConnected ? "healthy" : "degraded",
    database: dbStatus,
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: {
      heapUsed: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
      heapTotal: Math.round(process.memoryUsage().heapTotal / 1024 / 1024),
      rss: Math.round(process.memoryUsage().rss / 1024 / 1024),
      unit: 'MB'
    },
    environment: process.env.NODE_ENV
  });
}));

app.get("/api/health", asyncHandler(async (req, res) => {
  const dbStatus = getDBStatus();
  const isConnected = isDBConnected();
  
  res.json({
    success: true,
    status: isConnected ? "healthy" : "degraded",
    database: dbStatus,
    timestamp: new Date().toISOString()
  });
}));

app.get("/api/health/db", asyncHandler(async (req, res) => {
  try {
    if (!isDBConnected()) {
      return res.status(503).json({
        success: false,
        status: "disconnected",
        message: "Database not connected",
        timestamp: new Date().toISOString()
      });
    }
    
    // Test database connection with ping
    const startTime = Date.now();
    await mongoose.connection.db.admin().ping();
    const latency = Date.now() - startTime;
    
    res.json({
      success: true,
      status: "connected",
      database: getDBStatus(),
      latency: `${latency}ms`,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Database health check failed', { error: error.message });
    res.status(503).json({
      success: false,
      status: "disconnected",
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
}));

app.get("/api/health/full", asyncHandler(async (req, res) => {
  const startTime = Date.now();
  
  // Check database
  let dbHealth = { status: 'unknown', latency: null };
  try {
    if (isDBConnected()) {
      const dbStart = Date.now();
      await mongoose.connection.db.admin().ping();
      dbHealth = {
        status: 'connected',
        latency: `${Date.now() - dbStart}ms`
      };
    } else {
      dbHealth = { status: 'disconnected', latency: null };
    }
  } catch (error) {
    dbHealth = { status: 'error', error: error.message };
  }
  
  // Memory usage
  const mem = process.memoryUsage();
  
  // CPU usage (simplified)
  const cpuUsage = process.cpuUsage();
  
  res.json({
    success: true,
    timestamp: new Date().toISOString(),
    uptime: {
      seconds: Math.floor(process.uptime()),
      human: `${Math.floor(process.uptime() / 3600)}h ${Math.floor((process.uptime() % 3600) / 60)}m ${Math.floor(process.uptime() % 60)}s`
    },
    responseTime: `${Date.now() - startTime}ms`,
    database: dbHealth,
    memory: {
      heapUsed: `${Math.round(mem.heapUsed / 1024 / 1024)} MB`,
      heapTotal: `${Math.round(mem.heapTotal / 1024 / 1024)} MB`,
      rss: `${Math.round(mem.rss / 1024 / 1024)} MB`,
      external: `${Math.round(mem.external / 1024 / 1024)} MB`
    },
    cpu: {
      user: cpuUsage.user,
      system: cpuUsage.system
    },
    environment: process.env.NODE_ENV,
    version: "1.0.0",
    nodeVersion: process.version
  });
}));

// ============================================================================
// SOCKET.IO EVENT HANDLERS
// ============================================================================

io.on('connection', (socket) => {
  const socketId = socket.id;
  const clientIP = socket.handshake.address || 'unknown';
  
  // Track socket
  connectedSockets.set(socketId, {
    id: socketId,
    ip: clientIP,
    connectedAt: new Date(),
    userId: null,
    tenantId: null
  });
  
  logger.info(`Socket connected`, { socketId, ip: clientIP, total: connectedSockets.size });

  // Handle user authentication
  socket.on('authenticate', (data) => {
    try {
      const { userId, role, tenantId } = data;
      
      if (!userId || !tenantId) {
        logger.warn(`Invalid socket auth data`, { socketId });
        socket.emit('auth_error', { message: 'Invalid authentication data' });
        return;
      }

      // Leave previous rooms if any
      if (connectedSockets.get(socketId)?.tenantId) {
        socket.leave(`tenant_${connectedSockets.get(socketId).tenantId}`);
      }

      // Join new rooms
      socket.join(`tenant_${tenantId}`);
      socket.join(role);
      
      // Update socket tracking
      connectedSockets.set(socketId, {
        ...connectedSockets.get(socketId),
        userId,
        role,
        tenantId
      });
      
      socket.userId = userId;
      socket.role = role;
      socket.tenantId = tenantId;

      if (role === 'admin' || role === 'superadmin' || role === 'super_admin') {
        socket.join('management');
      }

      logger.info(`Socket authenticated`, { socketId, userId, tenantId, role });
      socket.emit('authenticated', { success: true });
    } catch (error) {
      logger.error(`Socket auth error`, { socketId, error: error.message });
      socket.emit('auth_error', { message: 'Authentication failed' });
    }
  });

  // Employee events
  const handleSocketEvent = (eventName) => {
    socket.on(eventName, (data) => {
      try {
        const socketInfo = connectedSockets.get(socketId);
        const tenantId = socketInfo?.tenantId || data?.tenantId;
        
        if (tenantId) {
          io.to(`tenant_${tenantId}`).emit(eventName, data);
          logger.debug(`Socket event: ${eventName}`, { tenantId });
        }
      } catch (error) {
        logger.error(`Socket event error: ${eventName}`, { error: error.message });
      }
    });
  };

  // Register event handlers
  ['employee_created', 'employee_updated', 'employee_deleted',
   'leave_created', 'leave_updated', 'leave_deleted',
   'expense_created', 'expense_updated', 'expense_deleted',
   'attendance:create'].forEach(handleSocketEvent);

  // Disconnect handler
  socket.on('disconnect', (reason) => {
    connectedSockets.delete(socketId);
    logger.info(`Socket disconnected`, { 
      socketId, 
      reason, 
      total: connectedSockets.size 
    });
  });

  // Error handler
  socket.on('error', (error) => {
    logger.error(`Socket error`, { socketId, error: error.message });
  });
});

// Socket.IO server error handler
io.engine.on('connection_error', (err) => {
  logger.error('Socket.IO connection error', { 
    message: err.message, 
    code: err.code 
  });
});

// ============================================================================
// AUTHENTICATION ROUTES
// ============================================================================

/**
 * Login endpoint with comprehensive error handling
 */
app.post("/api/auth/login", loginLimiter, asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  const clientIP = getClientIP(req);

  // Validate input
  if (!email || !password) {
    logger.warn('Login attempt missing credentials', { ip: clientIP });
    return res.status(400).json({ 
      success: false, 
      message: "Email and password are required" 
    });
  }

  // Validate email format
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    logger.warn('Login attempt with invalid email format', { ip: clientIP, email });
    return res.status(400).json({ 
      success: false, 
      message: "Invalid email format" 
    });
  }

  // Check database connection
  if (!isDBConnected()) {
    logger.error('Login failed - database not connected', { ip: clientIP });
    return res.status(503).json({ 
      success: false, 
      message: "Database temporarily unavailable. Please try again later.",
      code: "DATABASE_UNAVAILABLE"
    });
  }

  try {
    // Find user with password field (password has select: false by default)
    const user = await User.findOne({ email: email.toLowerCase().trim() })
      .select('+password') // CRITICAL: Include password field
      .maxTimeMS(10000); // 10 second timeout
    
    if (!user) {
      logger.warn('Login attempt with non-existent email', { ip: clientIP, email });
      return res.status(401).json({ 
        success: false, 
        message: "Invalid credentials" 
      });
    }

    // Check if user is active
    if (user.isActive === false) {
      logger.warn('Login attempt for inactive user', { ip: clientIP, email });
      return res.status(403).json({ 
        success: false, 
        message: "Account is deactivated. Please contact administrator." 
      });
    }

    // Verify password exists
    if (!user.password) {
      logger.error('User has no password set', { userId: user._id, email: user.email });
      return res.status(500).json({ 
        success: false, 
        message: "Account configuration error. Please contact administrator.",
        code: "NO_PASSWORD"
      });
    }

    // Compare password
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      logger.warn('Login attempt with wrong password', { ip: clientIP, email });
      return res.status(401).json({ 
        success: false, 
        message: "Invalid credentials" 
      });
    }

    // Verify JWT_SECRET exists
    if (!process.env.JWT_SECRET) {
      logger.error('JWT_SECRET not configured');
      return res.status(500).json({ 
        success: false, 
        message: "Authentication system not configured. Please contact administrator.",
        code: "NO_JWT_SECRET"
      });
    }

    // Generate JWT token
    const token = jwt.sign(
      { 
        userId: user._id,
        email: user.email,
        role: user.role,
        tenantId: user.orgId || 'system'
      },
      process.env.JWT_SECRET,
      { 
        expiresIn: '24h',
        issuer: 'workplus-api',
        audience: 'workplus-client'
      }
    );

    // Update last login
    user.lastLogin = new Date();
    user.loginAttempts = 0;
    await user.save();

    logger.info('User logged in successfully', { 
      userId: user._id, 
      email: user.email, 
      role: user.role,
      ip: clientIP
    });

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
        token: token
      }
    });
  } catch (dbError) {
    // Handle database errors
    logger.error('Database error during login', { 
      error: dbError.message,
      stack: dbError.stack,
      ip: clientIP 
    });
    
    if (dbError.name === 'MongooseError' || dbError.name === 'MongoError' || dbError.name === 'MongoServerError') {
      return res.status(503).json({ 
        success: false, 
        message: "Database temporarily unavailable. Please try again later.",
        code: "DATABASE_ERROR"
      });
    }
    
    // Log unexpected errors but don't expose details to client
    logger.error('Unexpected error during login', {
      error: dbError.message,
      stack: dbError.stack,
      name: dbError.name
    });
    
    return res.status(500).json({ 
      success: false, 
      message: "An authentication error occurred. Please try again later.",
      code: "AUTH_ERROR"
    });
  }
}));

/**
 * Register endpoint
 */
app.post("/api/auth/register", registerLimiter, asyncHandler(async (req, res) => {
  const { name, email, password, role, organization } = req.body;
  const clientIP = getClientIP(req);

  // Validate input
  if (!name || !email || !password) {
    return res.status(400).json({ 
      success: false, 
      message: "Name, email and password are required" 
    });
  }

  // Validate email format
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return res.status(400).json({ 
      success: false, 
      message: "Invalid email format" 
    });
  }

  // Validate password strength
  if (password.length < 8) {
    return res.status(400).json({ 
      success: false, 
      message: "Password must be at least 8 characters long" 
    });
  }

  // Check database connection
  if (!isDBConnected()) {
    return res.status(503).json({ 
      success: false, 
      message: "Database temporarily unavailable. Please try again later.",
      code: "DATABASE_UNAVAILABLE"
    });
  }

  // Check for existing user
  const existingUser = await User.findOne({ email: email.toLowerCase().trim() });
  if (existingUser) {
    return res.status(400).json({ 
      success: false, 
      message: "User already exists with this email" 
    });
  }

  // Hash password
  const hashedPassword = await bcrypt.hash(password, 12);

  // Create user
  const user = await User.create({
    name: name.trim(),
    email: email.toLowerCase().trim(),
    password: hashedPassword,
    role: role || 'employee',
    organization: organization || 'WorkPlus Inc.'
  });

  // Generate token
  const token = jwt.sign(
    { 
      userId: user._id,
      email: user.email,
      role: user.role,
      tenantId: user.orgId || 'system'
    },
    process.env.JWT_SECRET,
    { expiresIn: '24h' }
  );

  const userData = {
    id: user._id,
    name: user.name,
    email: user.email,
    role: user.role,
    avatar: user.avatar || null,
    organization: user.organization || 'WorkPlus Inc.'
  };

  // Emit socket event
  io.emit('employee_created', userData);

  logger.info('User registered', { userId: user._id, email: user.email, ip: clientIP });

  res.status(201).json({
    success: true,
    message: "Registration successful",
    data: {
      user: userData,
      token: token
    }
  });
}));

/**
 * Get current user
 */
app.get("/api/auth/me", asyncHandler(async (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(401).json({ 
      success: false, 
      message: "No token provided" 
    });
  }

  const token = authHeader.replace('Bearer ', '');
  
  let decoded;
  try {
    decoded = jwt.verify(token, process.env.JWT_SECRET);
  } catch (jwtError) {
    return res.status(401).json({ 
      success: false, 
      message: "Invalid or expired token" 
    });
  }
  
  // Check database connection
  if (!isDBConnected()) {
    return res.status(503).json({ 
      success: false, 
      message: "Database temporarily unavailable" 
    });
  }

  const user = await User.findById(decoded.userId).select('-password').lean();
  if (!user) {
    return res.status(401).json({ 
      success: false, 
      message: "User not found" 
    });
  }

  res.json({
    success: true,
    data: {
      id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      avatar: user.avatar || null,
      organization: user.organization || 'WorkPlus Inc.'
    }
  });
}));

/**
 * Logout endpoint
 */
app.post("/api/auth/logout", asyncHandler(async (req, res) => {
  // JWT is stateless, so logout is handled client-side
  // This endpoint exists for future token blacklisting if needed
  res.json({ 
    success: true, 
    message: "Logout successful" 
  });
}));

// ============================================================================
// DOCUMENT ROUTES
// ============================================================================

app.post("/api/documents/upload", upload.single('document'), fileValidator, asyncHandler(async (req, res) => {
  const { userId, name, type } = req.body;
  
  if (!req.file) {
    return res.status(400).json({ 
      success: false,
      message: "No file uploaded" 
    });
  }

  if (!isDBConnected()) {
    return res.status(503).json({ 
      success: false, 
      message: "Database temporarily unavailable" 
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
  
  logger.info('Document uploaded', { documentId: document._id, userId });
  
  res.status(201).json({
    success: true,
    data: document
  });
}));

app.get("/api/documents/:userId", asyncHandler(async (req, res) => {
  const { userId } = req.params;
  
  // Validate ObjectId
  if (!mongoose.Types.ObjectId.isValid(userId)) {
    return res.status(400).json({ 
      success: false,
      message: "Invalid user ID" 
    });
  }

  if (!isDBConnected()) {
    return res.status(503).json({ 
      success: false, 
      message: "Database temporarily unavailable" 
    });
  }

  const documents = await Document.find({ userId })
    .sort({ uploadedAt: -1 })
    .lean();
    
  res.json({
    success: true,
    data: documents
  });
}));

// ============================================================================
// ADDITIONAL ROUTES
// ============================================================================

// Create Admin (Super Admin only)
app.post("/api/auth/create-admin", asyncHandler(async (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(401).json({ success: false, message: "No token provided" });
  }

  const token = authHeader.replace('Bearer ', '');
  
  let decoded;
  try {
    decoded = jwt.verify(token, process.env.JWT_SECRET);
  } catch (jwtError) {
    return res.status(401).json({ success: false, message: "Invalid or expired token" });
  }

  if (decoded.role !== 'super_admin') {
    return res.status(403).json({ success: false, message: "Only super admin can create admin accounts" });
  }

  const { name, email, password, organization, orgId } = req.body;

  if (!name || !email || !password) {
    return res.status(400).json({ success: false, message: "Name, email and password are required" });
  }

  if (!isDBConnected()) {
    return res.status(503).json({ success: false, message: "Database temporarily unavailable" });
  }

  const existingUser = await User.findOne({ email: email.toLowerCase() });
  if (existingUser) {
    return res.status(400).json({ success: false, message: "User already exists with this email" });
  }

  const hashedPassword = await bcrypt.hash(password, 12);
  const user = await User.create({
    name: name.trim(),
    email: email.toLowerCase().trim(),
    password: hashedPassword,
    role: 'admin',
    organization: organization || 'WorkPlus Inc.',
    orgId: orgId || decoded.tenantId || 'system'
  });

  logger.info('Admin created', { adminId: user._id, createdBy: decoded.userId });

  res.status(201).json({
    success: true,
    message: "Admin user created successfully",
    data: {
      id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      organization: user.organization
    }
  });
}));

// Get all users (Admin/Super Admin only)
app.get("/api/users", asyncHandler(async (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(401).json({ success: false, message: "No token provided" });
  }

  const token = authHeader.replace('Bearer ', '');
  
  let decoded;
  try {
    decoded = jwt.verify(token, process.env.JWT_SECRET);
  } catch (jwtError) {
    return res.status(401).json({ success: false, message: "Invalid or expired token" });
  }

  if (!['admin', 'super_admin'].includes(decoded.role)) {
    return res.status(403).json({ success: false, message: "Access denied" });
  }

  if (!isDBConnected()) {
    return res.status(503).json({ success: false, message: "Database temporarily unavailable" });
  }

  const users = await User.find({}, { password: 0 }).lean();
  res.json({
    success: true,
    data: users
  });
}));

// Get experience documents
app.get("/api/experience-documents/:userId", asyncHandler(async (req, res) => {
  const { userId } = req.params;
  
  if (!mongoose.Types.ObjectId.isValid(userId)) {
    return res.status(400).json({ success: false, message: "Invalid user ID" });
  }

  if (!isDBConnected()) {
    return res.status(503).json({ success: false, message: "Database temporarily unavailable" });
  }

  const experienceTypes = [
    "experience_letter", 
    "offer_letter", 
    "relieving_letter", 
    "appraisal_letter", 
    "salary_slips", 
    "bank_statement"
  ];
  
  const documents = await Document.find({ 
    userId, 
    type: { $in: experienceTypes } 
  }).sort({ uploadedAt: -1 }).lean();
  
  res.json({
    success: true,
    data: documents
  });
}));

// Update document status
app.patch("/api/documents/:id/status", asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;
  
  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).json({ success: false, message: "Invalid document ID" });
  }

  if (!isDBConnected()) {
    return res.status(503).json({ success: false, message: "Database temporarily unavailable" });
  }
  
  const document = await Document.findByIdAndUpdate(
    id, 
    { status }, 
    { new: true }
  ).lean();
  
  if (!document) {
    return res.status(404).json({ success: false, message: "Document not found" });
  }
  
  res.json({
    success: true,
    data: document
  });
}));

// Onboarding form submission
app.post("/api/onboarding/submit", upload.array('documents'), asyncHandler(async (req, res) => {
  const {
    firstName, lastName, email, phone, dateOfBirth, gender, address,
    employeeId, joiningDate, department, designation, employmentType, workLocation,
    aadharNumber, panNumber, bankAccount, ifscCode,
    emergencyName, emergencyRelation, emergencyPhone
  } = req.body;

  // Validate required fields
  if (!firstName || !lastName || !email || !phone || !dateOfBirth || !gender || !address) {
    return res.status(400).json({ 
      success: false, 
      message: "Please fill in all required personal information fields" 
    });
  }

  if (!employeeId) {
    return res.status(400).json({ success: false, message: "Employee ID is required" });
  }

  if (!joiningDate || !department || !designation || !employmentType || !workLocation) {
    return res.status(400).json({ 
      success: false, 
      message: "Please fill in all official information fields" 
    });
  }

  if (!aadharNumber || !panNumber || !bankAccount || !ifscCode) {
    return res.status(400).json({ 
      success: false, 
      message: "Please fill in all banking information fields" 
    });
  }

  if (!emergencyName || !emergencyRelation || !emergencyPhone) {
    return res.status(400).json({ 
      success: false, 
      message: "Please fill in all emergency contact fields" 
    });
  }

  if (!isDBConnected()) {
    return res.status(503).json({ success: false, message: "Database temporarily unavailable" });
  }

  // Handle file uploads
  let uploadedDocuments = [];
  if (req.files && req.files.length > 0) {
    uploadedDocuments = req.files.map(file => ({
      fileName: file.originalname,
      filePath: file.path,
      size: `${(file.size / 1024).toFixed(1)} KB`,
      uploadedAt: new Date()
    }));
  }

  // Create or update user
  let user;
  if (employeeId && employeeId.startsWith('new_employee_')) {
    const hashedPassword = await bcrypt.hash('tempPassword123', 12);
    user = new User({
      name: `${firstName} ${lastName}`,
      email: email.toLowerCase(),
      password: hashedPassword,
      role: 'employee',
      orgId: 'org_001'
    });
    await user.save();
  } else {
    user = await User.findByIdAndUpdate(
      employeeId,
      {
        name: `${firstName} ${lastName}`,
        email: email.toLowerCase(),
        role: 'employee'
      },
      { new: true }
    );
  }

  // Create onboarding submission
  const onboardingSubmission = await OnboardingSubmission.create({
    employeeId: user._id.toString(),
    employeeName: `${firstName} ${lastName}`,
    email: email.toLowerCase(),
    phone,
    personalInfo: {
      firstName,
      lastName,
      dateOfBirth,
      gender,
      address: req.body.address
    },
    officialInfo: {
      employeeId: user._id.toString(),
      joiningDate,
      department,
      designation,
      employmentType,
      workLocation
    },
    sensitiveInfo: {
      aadharNumber,
      panNumber,
      bankAccount,
      ifscCode
    },
    emergencyContact: {
      name: emergencyName,
      relation: emergencyRelation,
      phone: emergencyPhone
    },
    documents: uploadedDocuments,
    submittedBy: user._id,
    submittedAt: new Date(),
    status: 'pending'
  });

  logger.info('Onboarding submitted', { employeeId: user._id, email });

  res.status(201).json({
    success: true,
    message: "Onboarding form submitted successfully",
    data: {
      userId: user._id,
      onboardingData: onboardingSubmission
    }
  });
}));

// Generate sharable onboarding link
app.post("/api/onboarding/generate-link", asyncHandler(async (req, res) => {
  const { employeeEmail, employeeName, department, organizationName, organizationId, createdBy } = req.body;
  
  if (!employeeEmail || !employeeName) {
    return res.status(400).json({ success: false, message: "Employee email and name are required" });
  }

  if (!isDBConnected()) {
    return res.status(503).json({ success: false, message: "Database temporarily unavailable" });
  }

  const token = crypto.randomBytes(32).toString('hex');
  
  const onboardingLink = await OnboardingLink.create({
    token,
    employeeEmail: employeeEmail.toLowerCase(),
    employeeName,
    department: department || 'General',
    organizationName: organizationName || 'Default Organization',
    organizationId: organizationId || 'ORG-DEFAULT',
    createdBy,
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    isUsed: false
  });
  
  const shareableLink = `${req.protocol}://${req.get('host')}/onboarding/${token}`;
  
  logger.info('Onboarding link generated', { email: employeeEmail, createdBy });
  
  res.status(201).json({
    success: true,
    message: "Onboarding link generated successfully",
    data: {
      link: shareableLink,
      token,
      expiresAt: onboardingLink.expiresAt
    }
  });
}));

// Validate onboarding link
{}
app.get("/api/onboarding/validate/:token", asyncHandler(async (req, res) => {
  const { token } = req.params;
  
  if (!isDBConnected()) {
    return res.status(503).json({ success: false, message: "Database temporarily unavailable" });
  }
  
  const onboardingLink = await OnboardingLink.findOne({ token });
  
  if (!onboardingLink) {
    return res.status(400).json({ 
      success: false, 
      message: "Invalid or expired link" 
    });
  }

  if (onboardingLink.isUsed) {
    return res.status(400).json({ 
      success: false, 
      message: "Link already used" 
    });
  }

  if (onboardingLink.expiresAt && new Date(onboardingLink.expiresAt) < new Date()) {
    return res.status(400).json({ 
      success: false, 
      message: "Link expired" 
    });
  }

  res.json({
    success: true,
    data: {
      valid: true,
      employeeEmail: onboardingLink.employeeEmail,
      employeeName: onboardingLink.employeeName,
      department: onboardingLink.department,
      organizationName: onboardingLink.organizationName
    }
  });
}));

// Generate employee document
app.post("/api/documents/generate", asyncHandler(async (req, res) => {
  const { employeeId, documentType, organizationId, createdBy, documentData } = req.body;
  
  if (!employeeId || !documentType || !organizationId) {
    return res.status(400).json({ 
      success: false, 
      message: "Employee ID, document type, and organization ID are required" 
    });
  }

  if (!mongoose.Types.ObjectId.isValid(employeeId)) {
    return res.status(400).json({ success: false, message: "Invalid employee ID" });
  }

  if (!isDBConnected()) {
    return res.status(503).json({ success: false, message: "Database temporarily unavailable" });
  }

  const employee = await Employee.findById(employeeId).populate('userId').lean();
  const employeeName = employee?.userId?.name || 'Unknown';
  const organizationName = organizationId;

  const documentId = `doc_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  const documentUrl = `/documents/${documentId}.pdf`;
  
  const document = await GeneratedDocument.create({
    id: documentId,
    documentType,
    employeeId,
    employeeName,
    organizationId,
    organizationName,
    createdBy,
    content: JSON.stringify(documentData),
    status: 'generated',
    fileUrl: documentUrl,
    fileName: `${documentType.replace(/\s+/g, '_')}_${employeeId}_${Date.now()}.pdf`
  });

  logger.info('Document generated', { documentId, employeeId, type: documentType });

  res.status(201).json({
    success: true,
    message: "Document generated successfully",
    data: document
  });
}));

// Get all documents for an employee
app.get("/api/documents/employee/:employeeId", asyncHandler(async (req, res) => {
  const { employeeId } = req.params;
  
  if (!mongoose.Types.ObjectId.isValid(employeeId)) {
    return res.status(400).json({ success: false, message: "Invalid employee ID" });
  }

  if (!isDBConnected()) {
    return res.status(503).json({ success: false, message: "Database temporarily unavailable" });
  }
  
  const employeeDocuments = await GeneratedDocument.find({ employeeId })
    .sort({ createdAt: -1 })
    .lean();

  res.json({
    success: true,
    data: employeeDocuments
  });
}));

// Get documents for organization
app.get("/api/documents/organization/:organizationId", asyncHandler(async (req, res) => {
  const { organizationId } = req.params;

  if (!isDBConnected()) {
    return res.status(503).json({ success: false, message: "Database temporarily unavailable" });
  }
  
  const organizationDocuments = await GeneratedDocument.find({ organizationId })
    .sort({ createdAt: -1 })
    .lean();

  res.json({
    success: true,
    data: organizationDocuments
  });
}));

// Get document by ID
app.get("/api/documents/detail/:documentId", asyncHandler(async (req, res) => {
  const { documentId } = req.params;

  if (!isDBConnected()) {
    return res.status(503).json({ success: false, message: "Database temporarily unavailable" });
  }
  
  const document = await GeneratedDocument.findOne({ id: documentId }).lean();

  if (!document) {
    return res.status(404).json({ success: false, message: "Document not found" });
  }

  res.json({
    success: true,
    data: document
  });
}));

// Delete document
app.delete("/api/documents/:documentId", asyncHandler(async (req, res) => {
  const { documentId } = req.params;

  if (!isDBConnected()) {
    return res.status(503).json({ success: false, message: "Database temporarily unavailable" });
  }
  
  const deletedDocument = await GeneratedDocument.findOneAndDelete({ id: documentId });

  if (!deletedDocument) {
    return res.status(404).json({ success: false, message: "Document not found" });
  }

  logger.info('Document deleted', { documentId });

  res.json({ 
    success: true, 
    message: "Document deleted successfully" 
  });
}));

// ============================================================================
// ERROR HANDLERS (MUST BE LAST)
// ============================================================================

// 404 handler
app.use(notFoundHandler);

// Global error handler
app.use(errorHandler);

// ============================================================================
// GRACEFUL SHUTDOWN
// ============================================================================

const gracefulShutdown = async (signal) => {
  logger.info(`${signal} received. Starting graceful shutdown...`);
  console.log(`\n${signal} received. Starting graceful shutdown...`);
  
  try {
    // Stop accepting new connections
    server.close(() => {
      logger.info('HTTP server closed');
      console.log('HTTP server closed');
    });

    // Close all Socket.IO connections
    io.close(() => {
      logger.info('Socket.IO closed');
      console.log('Socket.IO closed');
    });

    // Close database connection
    await closeDB();

    logger.info('Graceful shutdown complete');
    console.log('Graceful shutdown complete');
    
    process.exit(0);
  } catch (error) {
    logger.error('Error during shutdown', { error: error.message });
    console.error('Error during shutdown:', error.message);
    process.exit(1);
  }
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// ============================================================================
// UNCAUGHT EXCEPTION HANDLER
// ============================================================================

process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception', { 
    message: error.message, 
    stack: error.stack 
  });
  console.error('\n❌ Uncaught Exception:', error.message);
  console.error(error.stack);
  
  // Give time for logs to flush before exiting
  setTimeout(() => process.exit(1), 1000);
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection', { 
    reason: String(reason),
    promise: String(promise)
  });
  console.error('\n⚠️  Unhandled Rejection:', reason);
  
  // Don't exit on unhandled rejection, but log it
  // In production, you might want to exit depending on the error
});

// ============================================================================
// SUPER ADMIN SEEDING
// ============================================================================

/**
 * Ensure Super Admin exists in database
 * Creates if missing, updates if exists with correct password
 */
const seedSuperAdmin = async () => {
  try {
    if (!isDBConnected()) {
      logger.warn('Cannot seed super admin - database not connected');
      return false;
    }

    const superAdminEmail = process.env.SUPER_ADMIN_EMAIL || 'admin@workpluspro.com';
    const superAdminPassword = process.env.SUPER_ADMIN_PASSWORD || 'Jadu@123';
    const superAdminName = process.env.SUPER_ADMIN_NAME || 'Super Admin';

    // Check if super admin exists (include password field)
    let superAdmin = await User.findOne({ email: superAdminEmail.toLowerCase() }).select('+password');

    if (superAdmin) {
      let needsUpdate = false;
      
      // Update role if needed
      if (superAdmin.role !== 'super_admin') {
        superAdmin.role = 'super_admin';
        needsUpdate = true;
        logger.info('Updating super admin role');
      }
      
      // Update name if needed
      if (superAdmin.name !== superAdminName) {
        superAdmin.name = superAdminName;
        needsUpdate = true;
      }
      
      // Ensure account is active
      if (superAdmin.isActive !== true) {
        superAdmin.isActive = true;
        needsUpdate = true;
      }
      
      // CRITICAL: Always verify/update password to ensure it's correct
      if (superAdmin.password) {
        const isPasswordCorrect = await bcrypt.compare(superAdminPassword, superAdmin.password);
        if (!isPasswordCorrect) {
          logger.warn('Super admin password mismatch - updating password');
          superAdmin.password = await bcrypt.hash(superAdminPassword, 12);
          needsUpdate = true;
        }
      } else {
        // No password set - set it now
        logger.warn('Super admin has no password - setting password');
        superAdmin.password = await bcrypt.hash(superAdminPassword, 12);
        needsUpdate = true;
      }
      
      if (needsUpdate) {
        await superAdmin.save();
        logger.info('✅ Super Admin updated', { email: superAdminEmail });
        console.log('✅ Super Admin updated');
        console.log(`   Email: ${superAdminEmail}`);
        console.log(`   Password: ${superAdminPassword}`);
        console.log(`   Role: super_admin`);
      } else {
        logger.info('✅ Super Admin already exists with correct configuration', { email: superAdminEmail });
        console.log('✅ Super Admin already exists');
        console.log(`   Email: ${superAdminEmail}`);
        console.log(`   Role: super_admin`);
      }
    } else {
      // Create new super admin
      const hashedPassword = await bcrypt.hash(superAdminPassword, 12);
      
      superAdmin = await User.create({
        name: superAdminName,
        email: superAdminEmail.toLowerCase(),
        password: hashedPassword,
        role: 'super_admin',
        organization: 'WorkPlus Inc.',
        isActive: true,
        orgId: 'system'
      });

      logger.info('✅ Super Admin created successfully', { 
        id: superAdmin._id, 
        email: superAdminEmail 
      });
      console.log('✅ Super Admin created successfully');
      console.log(`   Email: ${superAdminEmail}`);
      console.log(`   Password: ${superAdminPassword}`);
      console.log(`   Role: super_admin`);
    }

    // Verify super admin can be found and logged in
    const verifyUser = await User.findOne({ email: superAdminEmail.toLowerCase() }).select('+password');
    if (verifyUser && verifyUser.password) {
      const canLogin = await bcrypt.compare(superAdminPassword, verifyUser.password);
      if (canLogin) {
        logger.info('✅ Super Admin login verified');
        console.log('✅ Super Admin login credentials verified');
      } else {
        logger.error('❌ Super Admin password verification failed');
        console.error('❌ WARNING: Super Admin password verification failed!');
      }
    }

    return true;
  } catch (error) {
    logger.error('Failed to seed super admin', { error: error.message, stack: error.stack });
    console.error('❌ Failed to seed super admin:', error.message);
    console.error(error.stack);
    return false;
  }
};

// ============================================================================
// SERVER STARTUP
// ============================================================================

const startServer = async () => {
  try {
    logger.info('🚀 Starting WorkPlus Backend Server...');
    console.log('\n🚀 Starting WorkPlus Backend Server...');
    logger.info(`Environment: ${process.env.NODE_ENV}`);
    console.log(`Environment: ${process.env.NODE_ENV}`);

    // Start server FIRST - bind to 0.0.0.0 for Render compatibility
    // This ensures Render sees an open port immediately
    const PORT = process.env.PORT || 5000;
    
    server.listen(PORT, '0.0.0.0', () => {
      logger.info(`✅ Server running on port ${PORT}`);
      console.log(`\n✅ Server running on port ${PORT}`);
      console.log(`📊 Health check: http://localhost:${PORT}/health`);
      console.log(`📊 Full health:  http://localhost:${PORT}/api/health/full`);
      console.log(`🔗 API base:     http://localhost:${PORT}/api`);
      console.log(`\n🌐 Allowed CORS origins:`);
      allowedOrigins.forEach(origin => console.log(`   - ${origin}`));
      console.log('\n✅ Server ready and accepting connections!\n');
    });

    // Connect to database in background (non-blocking)
    logger.info('Connecting to MongoDB in background...');
    console.log('Connecting to MongoDB in background...');
    
    // Use setImmediate to ensure server starts first
    setImmediate(async () => {
      try {
        const dbConnected = await connectDB();
        
        if (!dbConnected) {
          logger.warn('⚠️  Database connection failed. Running in degraded mode.');
          console.log('⚠️  Database connection failed. Running in degraded mode.');
          console.log('   Some features may not work until database is available.');
          console.log('   Server will continue to retry connection in background.');
        } else {
          logger.info('✅ Database connected successfully');
          console.log('✅ Database connected successfully');
          
          // Seed super admin after successful DB connection
          console.log('\n🔐 Checking Super Admin account...');
          await seedSuperAdmin();
        }
      } catch (dbError) {
        logger.error('Database connection error', { error: dbError.message });
        console.error('⚠️  Database connection error:', dbError.message);
        console.log('   Server continues running. DB will retry automatically.');
      }
    });

  } catch (error) {
    logger.error('Failed to start server', { error: error.message });
    console.error('\n❌ Failed to start server:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
};

// Start the server
startServer();

// Export for testing
export { app, server, io };
