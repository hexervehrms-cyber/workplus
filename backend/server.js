/**
 * WorkPlus Backend Server - Production Stable Version
 * 
 * STABILITY FEATURES:
 * - Global error handling
 * - Graceful shutdown
 * - Database retry logic
 * - Async route wrapping
 * - Socket.IO error handling
 * - Request logging
 * - Health checks
 * - Environment validation
 * 
 * Last redeploy: 2025-05-10 23:30 (CORS fix)
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
import cookieParser from "cookie-parser";

// Import database connection
import connectDB, { isDBConnected, getDBStatus } from "./config/db.js";

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
import LeaveTypeSettings from "./models/LeaveTypeSettings.js";
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
import Session from "./models/Session.js";

// Import middleware
import { errorHandler, requestIdMiddleware, asyncHandler } from "./middleware/errorHandler.js";
import { createAuthenticatedUploadsHandler } from "./middleware/authenticatedUploads.js";
import { tenantMiddleware, subscriptionMiddleware } from "./middleware/tenant.js";
import { domainResolver, ensureDomainTenantMatch } from "./middleware/domainResolver.js";
import fileValidator from "./middleware/fileValidator.js";
import { registerLimiter } from "./middleware/rateLimiter.js";

// Import logger
import logger from "./utils/logger.js";

// Import Redis utility
import redis from "./utils/redis.js";

// Import KPI updater
import { emitKPIUpdate, emitAttendanceKPIUpdate, emitLeaveKPIUpdate, emitExpenseKPIUpdate, emitEmployeeKPIUpdate } from "./utils/kpiUpdater.js";
import { setAccessTokenCookie, clearAccessTokenCookie, clearLegacyAuthCookies, parseCookies, ACCESS_TOKEN_COOKIE } from "./utils/httpAuth.js";

// Import seeders
import seedSuperAdmin from "./seeders/superAdminSeeder.js";

// Import socket handlers
import { initializeChatHandlers } from "./utils/chatSocketHandlers.js";
import { attachSocketIoRedisAdapter } from "./utils/socketIoScale.js";
import { apiTrafficLimiter, uploadTrafficLimiter } from "./middleware/trafficGuard.js";

// Import routes
import dashboardRoutes from "./routes/dashboard.js";
import dashboardSuperAdminRoutes from "./routes/dashboard-superadmin.js";
import dashboardEmployeeRoutes from "./routes/dashboard-employee.js";
import documentsRoutes from "./routes/documents.js";
import expensesRoutes from "./routes/expenses.js";
import employeesRoutes from "./routes/employees.js";
import attendanceRoutes from "./routes/attendance.js";
import attendanceHistoryRoutes from "./routes/attendanceHistory.js";
import leaveRoutes from "./routes/leave.js";
import leaveAllocationRoutes from "./routes/leave-allocation.js";
import leaveTypeSettingsRoutes from "./routes/leave-type-settings.js";
import usersRoutes from "./routes/users.js";
import departmentsRoutes from "./routes/departments.js";
import holidaysRoutes from "./routes/holidays.js";
import profileRoutes from "./routes/profile.js";
import rolesRoutes from "./routes/roles.js";
import chatRoutes from "./routes/chat.js";
import currencyRoutes from "./routes/currency.js";
import onboardingRoutes from "./routes/onboarding.js";
import salaryRoutes from "./routes/salary.js";
import salaryCycleRoutes from "./routes/salary-cycle.js";
import fnfRoutes from "./routes/fnf.js";
import payrollRoutes from "./routes/payroll.js";
import organizationNotificationSettingsRoutes from "./routes/organizationNotificationSettings.js";
import adminBulkOperationsRoutes from "./routes/admin-bulk-operations.js";
import announcementsRoutes from "./routes/announcements.js";
import notificationsRoutes from "./routes/notifications.js";
import tasksRoutes from "./routes/tasks.js";
import organizationsRoutes from "./routes/organizations.js";
import assetsRoutes from "./routes/assets.js";
import employeeDashboardRoutes from "./routes/employee-dashboard.js";
import authRoutes from "./routes/auth.js";
import { handleAuthRefresh } from "./handlers/authRefreshHandler.js";

// Import sales routes
import callsRoutes from "./routes/sales/calls.js";
import leadsRoutes from "./routes/sales/leads.js";
import dealsRoutes from "./routes/sales/deals.js";
import performanceRoutes from "./routes/sales/performance.js";
import performanceEmployeeRoutes from "./routes/performance-employee.js";
import revenueRoutes from "./routes/sales/revenue.js";

// Setup __dirname for ES modules (must be before dotenv.config)
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables from .env ONLY in development
// In production (Render), use environment variables from dashboard/render.yaml
if (process.env.NODE_ENV !== 'production' && !process.env.JWT_SECRET) {
  dotenv.config({ path: path.join(__dirname, '.env') });
}

// ============================================================================
// ENVIRONMENT VALIDATION
// ============================================================================

const validateEnvironment = () => {
  const requiredVars = ['MONGODB_URI', 'JWT_SECRET', 'NODE_ENV'];
  const missing = requiredVars.filter(v => !process.env[v]);
  
  if (missing.length > 0) {
    console.error('❌ Missing required environment variables:', missing.join(', '));
    console.error('Available environment variables:', Object.keys(process.env).filter(k => !k.startsWith('npm_')).join(', '));
    process.exit(1);
  }

  // CRITICAL: Validate JWT_SECRET is not default or weak
  const jwtSecret = process.env.JWT_SECRET;
  const defaultSecrets = [
    'supersecretkey',
    'secret',
    'your-secret-key',
    'your-secure-jwt-secret-key-minimum-32-characters-long-change-this',
    'workplus-pro-production-jwt-secret-key-32-chars-minimum-2024',
    'change-me',
    'change_me',
    'default',
    'password',
    'test',
    'demo',
    'your_random_64_char_hex_string'
  ];
  
  // Check length
  if (!jwtSecret || jwtSecret.length < 32) {
    console.error('❌ CRITICAL SECURITY ERROR: JWT_SECRET is missing or too short (minimum 32 characters)');
    console.error('   Current JWT_SECRET:', jwtSecret ? `${jwtSecret.length} chars` : 'NOT SET');
    console.error('   ➜ Generate a new secret: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"');
    console.error('   ➜ Add to .env: JWT_SECRET=<generated_secret>');
    process.exit(1);
  }
  
  // Check for obvious default patterns (case-insensitive)
  const secretLower = jwtSecret.toLowerCase();
  const hasObviousDefault = defaultSecrets.some(s => secretLower.includes(s.toLowerCase()));
  
  if (hasObviousDefault || jwtSecret.includes('workplus') || jwtSecret.includes('-') || /^[a-z-]+$/.test(jwtSecret)) {
    if (process.env.NODE_ENV === 'production') {
      console.error('❌ CRITICAL SECURITY ERROR IN PRODUCTION: JWT_SECRET appears to use a default or weak pattern');
      console.error('   Do NOT use dictionary words, hyphens, or obvious patterns');
      console.error('   ➜ Generate a new secret: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"');
      console.error('   ➜ Deploy with new secret to production immediately');
      process.exit(1);
    } else {
      console.warn('⚠️  WARNING (Development): JWT_SECRET appears to use a default pattern');
      console.warn('   ➜ For production, generate: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"');
    }
  }

  console.log('✅ Environment validation passed');
  console.log('📝 Loaded environment:', {
    NODE_ENV: process.env.NODE_ENV,
    PORT: process.env.PORT || 5000,
    MONGODB_URI: process.env.MONGODB_URI ? '✅ Set' : '❌ Missing',
    JWT_SECRET: process.env.JWT_SECRET ? `✅ Set (${jwtSecret.length} chars)` : '❌ Missing',
    CORS_ORIGIN: process.env.CORS_ORIGIN || 'Not set'
  });
};

validateEnvironment();

// ============================================================================
// SETUP
// ============================================================================

const app = express();

// Render / reverse proxy — required for rate limits and client IP
app.set('trust proxy', 1);

// Create HTTP server for Socket.IO
const server = createServer(app);

// CORS whitelist - MUST be defined BEFORE Socket.IO initialization
// Parse multiple origins from comma-separated environment variable
const parseCorsOrigins = () => {
  const corsOrigin = process.env.CORS_ORIGIN || process.env.FRONTEND_URL || '';
  const origins = corsOrigin.split(',').map(origin => origin.trim()).filter(Boolean);
  
  // Base origins that should ALWAYS be allowed
  const baseOrigins = [
    'http://localhost:5173',
    'http://localhost:3000',
    'https://hexerve.online',
    'https://www.hexerve.online',
    'http://hexerve.online',
    'http://www.hexerve.online'
  ];
  
  // Combine environment origins with base origins
  const combinedOrigins = [...new Set([...origins, ...baseOrigins])];
  
  return combinedOrigins;
};

const allowedOrigins = parseCorsOrigins();

console.log('✅ CORS Allowed Origins:', allowedOrigins);

const corsOptions = {
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    
    if (allowedOrigins.indexOf(origin) !== -1 || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      console.warn(`⚠️  CORS blocked origin: ${origin}`);
      // In production, you might want to be stricter, but for now let's allow it 
      // if it's one of our variants just in case of slight string mismatches
      if (origin.includes('hexerve.online') || origin.includes('vercel.app')) {
        return callback(null, true);
      }
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With", "X-CSRF-Token", "Idempotency-Key"],
  optionsSuccessStatus: 200,
  preflightContinue: false
};

// Initialize Socket.IO with CORS options
const io = new Server(server, {
  cors: {
    origin: allowedOrigins,
    credentials: true,
    methods: ['GET', 'POST']
  },
  transports: ['websocket', 'polling'],
  pingInterval: 25000,
  pingTimeout: 60000,
  maxHttpBufferSize: 1e6,
  perMessageDeflate: { threshold: 1024 },
  connectionStateRecovery: {
    maxDisconnectionDuration: 2 * 60 * 1000,
    skipMiddlewares: true,
  },
});

// Make io globally accessible for routes
global.io = io;

// ============================================================================
// MIDDLEWARE SETUP
// ============================================================================

// 1. CORS middleware (Must be first)
app.use(cors(corsOptions));
app.options('*', cors(corsOptions));

// 2. Security middleware
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" },
  crossOriginOpenerPolicy: { policy: "same-origin-allow-popups" }
}));

// 3. Request logging
app.use(morgan('combined', {
  stream: {
    write: (message) => logger.http(message.trim())
  }
}));

// Request ID middleware
app.use(requestIdMiddleware);

// Domain Resolver Middleware (resolve custom domains to organizations)
// Must be early, after basic middleware, before auth
app.use(domainResolver);

// Cookie parser middleware (for HTTP-only cookies)
app.use(cookieParser());

// Body parsing with size limits
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));

// Serve static assets (logo, images, etc.)
app.use('/assets', express.static(path.join(__dirname, 'public', 'assets')));

// ============================================================================
// REAL-TIME EMITTER MIDDLEWARE
// ============================================================================

// Add emitter functions to request object for real-time updates
app.use((req, res, next) => {
  // Attach Socket.IO instance to request
  req.io = io;

  // Emit attendance updates to Socket.IO
  req.emitAttendanceUpdate = (attendance, orgId) => {
    console.log('📊 [EMIT-ATTENDANCE] Emitting attendance update:', { orgId, attendanceId: attendance._id });
    if (io) {
      io.to(`tenant_${orgId}`).emit('attendance:update', {
        attendance,
        timestamp: new Date(),
        orgId
      });
      
      // Emit KPI update for attendance changes
      console.log('📊 [EMIT-ATTENDANCE] Calling emitAttendanceKPIUpdate');
      emitAttendanceKPIUpdate(io, orgId, { ...attendance, action: 'update' });
    }
  };

  // Emit leave updates to Socket.IO
  req.emitLeaveUpdate = (action, leaveRequest, orgId) => {
    if (io) {
      io.to(`tenant_${orgId}`).emit('leave:update', {
        action,
        leaveRequest,
        timestamp: new Date(),
        orgId
      });
      
      // Emit KPI update for leave changes
      emitLeaveKPIUpdate(io, orgId, { ...leaveRequest, action });
    }
  };

  // Emit dashboard updates to Socket.IO
  req.emitDashboardUpdate = (action, type, data, orgId) => {
    if (io) {
      io.to(`tenant_${orgId}`).emit('dashboard:update', {
        action,
        type,
        data,
        timestamp: new Date(),
        orgId
      });
    }
  };

  // Emit expense updates to Socket.IO
  req.emitExpenseUpdate = (action, expense, orgId) => {
    if (io) {
      io.to(`tenant_${orgId}`).emit('expense:update', {
        action,
        expense,
        timestamp: new Date(),
        orgId
      });
      
      // Emit KPI update for expense changes
      emitExpenseKPIUpdate(io, orgId, { ...expense, action });
    }
  };

  // Emit activity updates to Socket.IO
  req.emitActivityUpdate = (activity, orgId) => {
    if (io) {
      io.to(`tenant_${orgId}`).emit('activity:update', {
        activity,
        timestamp: new Date(),
        orgId
      });
    }
  };

  // Emit holiday updates to Socket.IO
  req.emitHolidayUpdate = (action, holiday, orgId) => {
    if (io) {
      io.to(`tenant_${orgId}`).emit('holiday:update', {
        action,
        holiday,
        timestamp: new Date(),
        orgId
      });
    }
  };

  // Emit notifications to specific user or organization
  req.emitNotification = (notification, userId, orgId) => {
    if (io) {
      if (userId) {
        // Send to specific user
        io.to(`user_${userId}`).emit('notification', {
          ...notification,
          timestamp: new Date()
        });
      } else {
        // Send to organization
        io.to(`tenant_${orgId}`).emit('notification', {
          ...notification,
          timestamp: new Date()
        });
      }
    }
  };

  // Emit employee updates to Socket.IO
  req.emitEmployeeUpdate = (action, employee, orgId) => {
    if (io) {
      io.to(`tenant_${orgId}`).emit('employee:update', {
        action,
        employee,
        timestamp: new Date(),
        orgId
      });
      
      // Emit KPI update for employee changes
      emitEmployeeKPIUpdate(io, orgId, { ...employee, action });
    }
  };

  next();
});

// Uploaded files — require auth; access controlled by path (receipts, documents, avatars, chat)
app.use(
  "/uploads",
  authenticate,
  asyncHandler(createAuthenticatedUploadsHandler(path.join(__dirname, "uploads")))
);

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
  const mongoStatus = mongoose.connection.readyState;
  const isConnected = mongoStatus === 1;
  
  res.json({
    success: true,
    status: isConnected ? "healthy" : "degraded",
    database: getDBStatus(),
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: process.memoryUsage()
  });
}));

app.get("/api/health", asyncHandler(async (req, res) => {
  const mongoStatus = mongoose.connection.readyState;
  const isConnected = mongoStatus === 1;
  
  res.json({
    success: true,
    status: isConnected ? "healthy" : "degraded",
    database: getDBStatus(),
    timestamp: new Date().toISOString()
  });
}));

// Session refresh (also on auth router) — early registration for Render deploys
app.post("/api/auth/refresh", asyncHandler(handleAuthRefresh));
app.options("/api/auth/refresh", (_req, res) => {
  res.sendStatus(204);
});

app.get("/api/health/db", asyncHandler(async (req, res) => {
  try {
    // Test database connection
    await mongoose.connection.db.admin().ping();
    
    res.json({
      success: true,
      status: "connected",
      database: getDBStatus(),
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(503).json({
      success: false,
      status: "disconnected",
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
}));

// ============================================================================
// OPTIMIZATION MIDDLEWARE
// ============================================================================

// Import optimization middleware
import {
  compressionMiddleware,
  securityHeaders,
  cacheControl,
  etagMiddleware,
  optimizeResponse,
  requestTimeout,
  queryOptimization
} from "./middleware/optimization.js";

// Import deduplication middleware
import { deduplicationMiddleware, startCacheCleanup } from "./middleware/deduplication.js";

// Import CSRF middleware
import { generateCSRFToken, verifyCSRFToken, startCSRFCleanup } from "./middleware/csrf.js";

// Import connection monitor
import { connectionMonitor } from "./utils/connectionMonitor.js";

// Apply optimization middleware
app.use(compressionMiddleware);
app.use(cacheControl);
app.use(etagMiddleware);
app.use(optimizeResponse);
app.use(requestTimeout(30000)); // 30 second timeout
app.use(queryOptimization);

// Apply CSRF protection middleware - DISABLED for API (JWT is sufficient)
// CSRF is mainly for form-based attacks, not API calls with JWT
if (false && (process.env.NODE_ENV === 'production' || process.env.ENABLE_CSRF === 'true')) {
  app.use(generateCSRFToken);
  app.use(verifyCSRFToken);
  logger.info('CSRF protection enabled');
}

// Apply deduplication middleware for POST/PUT/DELETE
app.use(deduplicationMiddleware);

// Start cache cleanup
startCacheCleanup(60000); // Clean every minute

// Start CSRF token cleanup
startCSRFCleanup(60 * 60 * 1000); // Clean every hour

// Initialize connection monitoring
connectionMonitor.initialize();

// ============================================================================
// HEALTH CHECK ROUTES
// ============================================================================

// Import health routes
import healthRoutes from "./routes/health.js";

// Health check endpoints (no authentication required)
app.use("/health", healthRoutes);

// ============================================================================
// API ROUTES REGISTRATION
// ============================================================================

// Import auth middleware
import { authenticate, authorize } from "./middleware/auth.js";
import { validateOrgId } from "./middleware/orgIdValidation.js";
import {
  normalizeAuthOrgId,
  socketTenantIdFromDecoded
} from "./utils/orgScopeHelpers.js";

/** Authenticated API routes that require a real tenant org (non–super_admin). */
const authedTenant = [authenticate, validateOrgId];

// Registration: invite-only (OnboardingLink token), role fixed to employee — no client-supplied role/orgId
app.post("/api/auth/register", registerLimiter, asyncHandler(async (req, res) => {
  const { name, email, password, inviteToken } = req.body;

  if (!name || !email || !password) {
    return res.status(400).json({
      success: false,
      message: "Name, email and password are required"
    });
  }

  if (!inviteToken || typeof inviteToken !== 'string') {
    return res.status(400).json({
      success: false,
      message: 'A valid invite token is required to register',
      code: 'INVITE_REQUIRED'
    });
  }

  const invite = await OnboardingLink.findOne({ token: inviteToken.trim() });
  if (!invite) {
    return res.status(400).json({
      success: false,
      message: 'Invalid or expired invite',
      code: 'INVALID_INVITE'
    });
  }
  if (invite.isUsed) {
    return res.status(400).json({
      success: false,
      message: 'This invite has already been used',
      code: 'INVITE_USED'
    });
  }
  if (invite.expiresAt && new Date(invite.expiresAt) < new Date()) {
    return res.status(400).json({
      success: false,
      message: 'This invite has expired',
      code: 'INVITE_EXPIRED'
    });
  }

  const emailNorm = email.toLowerCase().trim();
  const inviteEmail = String(invite.employeeEmail || '').toLowerCase().trim();
  if (inviteEmail && inviteEmail !== emailNorm) {
    return res.status(400).json({
      success: false,
      message: 'Email does not match the invite',
      code: 'INVITE_EMAIL_MISMATCH'
    });
  }

  const inviteOrgId = String(invite.organizationId || '').trim();
  if (!inviteOrgId || inviteOrgId === 'ORG-DEFAULT') {
    return res.status(400).json({
      success: false,
      message: 'Invite is missing a valid organization',
      code: 'INVALID_INVITE_ORG'
    });
  }

  const existingUser = await User.findOne({ email: emailNorm });
  if (existingUser) {
    return res.status(400).json({
      success: false,
      message: "User already exists"
    });
  }

  const hashedPassword = await bcrypt.hash(password, 10);
  const user = await User.create({
    name,
    email: emailNorm,
    password: hashedPassword,
    role: 'employee',
    organization: invite.organizationName || 'WorkPlus Inc.',
    orgId: inviteOrgId,
    tenantId: inviteOrgId
  });

  const authOrg = normalizeAuthOrgId(user);
  if (!authOrg) {
    await User.deleteOne({ _id: user._id });
    return res.status(400).json({
      success: false,
      message: 'Invalid organization on invite',
      code: 'MISSING_ORG_CONTEXT'
    });
  }

  invite.isUsed = true;
  await invite.save();

  const token = jwt.sign(
    {
      userId: user._id.toString(),
      email: user.email,
      role: user.role,
      tenantId: authOrg,
      orgId: authOrg
    },
    process.env.JWT_SECRET,
    { expiresIn: '24h' }
  );

  setAccessTokenCookie(res, token, 24 * 60 * 60);

  const userData = {
    id: user._id.toString(),
    name: user.name,
    email: user.email,
    role: user.role,
    avatar: user.avatar || null,
    organization: user.organization || 'WorkPlus Inc.'
  };

  io.to(`tenant_${authOrg}`).emit('employee_created', { ...userData, orgId: authOrg, tenantId: authOrg });

  res.status(201).json({
    success: true,
    message: "Registration successful",
    data: {
      user: userData,
      token: token
    }
  });
}));

// Production traffic guard (skipped in dev unless ENABLE_TRAFFIC_GUARD=true)
app.use("/api", apiTrafficLimiter);
app.use("/api/documents", uploadTrafficLimiter);
app.use("/api/profile", uploadTrafficLimiter);

app.use("/api/auth", authRoutes);

// Create Admin (Super Admin only) — must stay on main app so it is not shadowed by the auth router
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

  const emailNorm = email.toLowerCase().trim();
  const existingUser = await User.findOne({ email: emailNorm });
  if (existingUser) {
    return res.status(400).json({ success: false, message: "User already exists with this email" });
  }

  const hashedPassword = await bcrypt.hash(password, 10);
  const adminOrgId = orgId || decoded.tenantId || decoded.orgId;
  if (!adminOrgId || String(adminOrgId) === 'system') {
    return res.status(400).json({
      success: false,
      message: 'Valid orgId is required when creating an admin',
      code: 'MISSING_ORG_CONTEXT'
    });
  }

  const user = await User.create({
    name,
    email: emailNorm,
    password: hashedPassword,
    role: 'admin',
    organization: organization || 'WorkPlus Inc.',
    orgId: String(adminOrgId)
  });

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

// Dashboard routes (with authentication and role-based authorization)
// Admin/HR dashboard - organization-specific metrics
app.use("/api/dashboard", ...authedTenant, authorize('admin', 'hr'), dashboardRoutes);
// Super Admin dashboard - platform-wide metrics
app.use("/api/dashboard", ...authedTenant, authorize('super_admin'), dashboardSuperAdminRoutes);
// Employee dashboard - self-service employee data only
app.use("/api/dashboard", ...authedTenant, authorize('employee', 'manager', 'accountant'), dashboardEmployeeRoutes);
app.use("/api/employee-dashboard", ...authedTenant, authorize('employee', 'manager', 'accountant'), employeeDashboardRoutes);

// ============================================================================
// PUBLIC CLEANUP ENDPOINTS (for testing/development)
// ============================================================================

// Cleanup endpoint — super_admin only; disabled in production unless explicitly enabled
app.delete("/api/leave-requests/cleanup/all", ...authedTenant, authorize("super_admin"), asyncHandler(async (req, res) => {
  if (process.env.NODE_ENV === "production" && process.env.ALLOW_LEAVE_CLEANUP !== "true") {
    return res.status(403).json({
      success: false,
      message: "Leave cleanup is disabled in production",
    });
  }
  try {
    const orgFilter =
      req.user.role === "super_admin" && req.query.orgId
        ? { orgId: String(req.query.orgId) }
        : req.user.orgId
          ? { orgId: String(req.user.orgId) }
          : {};
    const result = await LeaveRequest.deleteMany(orgFilter);
    logger.info('All leave requests deleted', { deletedCount: result.deletedCount });
    res.json({
      success: true,
      message: `Deleted ${result.deletedCount} leave requests`,
      data: {
        deletedCount: result.deletedCount
      }
    });
  } catch (error) {
    logger.error('Error deleting leave requests', { error: error.message });
    res.status(500).json({
      success: false,
      message: 'Failed to delete leave requests',
      error: error.message
    });
  }
}));

// ============================================================================
// AUTHENTICATED ROUTES
// ============================================================================

// Profile routes (with authentication)
app.use("/api/profile", ...authedTenant, profileRoutes);

// Employees routes (with authentication)
app.use("/api/employees", ...authedTenant, employeesRoutes);

// Document status (legacy path; registered before /api/documents router so it is reachable)
app.patch("/api/documents/:id/status", ...authedTenant, asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).json({ message: "Invalid document ID" });
  }

  const existing = await Document.findById(id);
  if (!existing) {
    return res.status(404).json({ message: "Document not found" });
  }

  const privileged = ["admin", "hr", "super_admin"].includes(req.user.role);
  const isOwner = String(existing.userId) === String(req.user.userId);
  if (!isOwner && !privileged) {
    return res.status(403).json({ message: "Unauthorized access" });
  }
  if (
    req.user.role !== "super_admin" &&
    String(existing.orgId) !== String(req.user.orgId)
  ) {
    return res.status(403).json({ message: "Unauthorized access" });
  }

  const document = await Document.findByIdAndUpdate(id, { status }, { new: true });
  res.json(document);
}));

// Documents routes (with authentication)
app.use("/api/documents", ...authedTenant, documentsRoutes);

// Announcements routes (with authentication)
app.use("/api/announcements", ...authedTenant, announcementsRoutes);

// In-app notifications (navbar, etc.)
app.use("/api/notifications", ...authedTenant, notificationsRoutes);

// Tasks routes (with authentication)
app.use("/api/tasks", ...authedTenant, tasksRoutes);

// Organizations routes (with authentication)
app.use("/api/organizations", ...authedTenant, organizationsRoutes);

// Asset management (assignments, photos, import/export)
app.use("/api/assets", ...authedTenant, assetsRoutes);

// Expenses routes (with authentication)
app.use("/api/expenses", ...authedTenant, expensesRoutes);

// Attendance routes (with authentication)
app.use("/api/attendance", ...authedTenant, attendanceRoutes);

// Attendance History routes (with authentication)
app.use("/api/attendance-history", ...authedTenant, attendanceHistoryRoutes);

// Leave routes (with authentication)
app.use("/api/leave-requests", ...authedTenant, leaveRoutes);

// Leave allocation routes (with authentication)
app.use("/api/leave-allocation", ...authedTenant, leaveAllocationRoutes);

// Leave type settings routes (with authentication)
app.use("/api/leave-type-settings", ...authedTenant, leaveTypeSettingsRoutes);

// Holidays routes (with authentication)
app.use("/api/holidays", ...authedTenant, holidaysRoutes);

// Users routes (with authentication)
app.use("/api/users", ...authedTenant, usersRoutes);
app.use("/api/departments", ...authedTenant, departmentsRoutes);

// Roles routes (with authentication)
app.use("/api/roles", ...authedTenant, rolesRoutes);

// Onboarding routes (mixed authentication - some public, some protected)
// Use multer for file uploads on onboarding routes
app.use("/api/onboarding", upload.any(), onboardingRoutes);

// Sales routes (with authentication)
app.use("/api/sales/calls", ...authedTenant, callsRoutes);
app.use("/api/sales/leads", ...authedTenant, leadsRoutes);
app.use("/api/sales/deals", ...authedTenant, dealsRoutes);
app.use("/api/sales/performance", ...authedTenant, performanceRoutes);
app.use("/api/performance", ...authedTenant, performanceEmployeeRoutes);
app.use("/api/sales/revenue", ...authedTenant, revenueRoutes);

// Chat routes (with authentication)
app.use("/api/chat", ...authedTenant, chatRoutes);

// Currency routes (with authentication)
app.use("/api/currency", ...authedTenant, currencyRoutes);

// Salary routes (with authentication)
app.use("/api/salary", ...authedTenant, salaryRoutes);

// Salary cycle & FNF (HR / admin)
app.use(
  "/api/salary-cycle",
  ...authedTenant,
  authorize("super_admin", "admin", "hr"),
  salaryCycleRoutes
);
app.use("/api/fnf", ...authedTenant, authorize("super_admin", "admin", "hr"), fnfRoutes);

// Payroll routes (with authentication)
app.use("/api/payroll", ...authedTenant, payrollRoutes);

// Admin: org notification integrations (SMTP + Teams) and routing
app.use("/api/admin", organizationNotificationSettingsRoutes);
app.use("/api/admin/bulk", adminBulkOperationsRoutes);

// Experience / HR document bundle for a user (authenticated)
app.get("/api/experience-documents/:userId", ...authedTenant, asyncHandler(async (req, res) => {
  const { userId } = req.params;

  if (!mongoose.Types.ObjectId.isValid(userId)) {
    return res.status(400).json({ message: "Invalid user ID" });
  }

  const privileged = ["admin", "hr", "super_admin", "manager"].includes(req.user.role);
  const isSelf = String(userId) === String(req.user.userId);
  if (!isSelf && !privileged) {
    return res.status(403).json({ message: "Unauthorized access" });
  }

  if (privileged && req.user.role !== "super_admin" && !isSelf) {
    const targetUser = await User.findById(userId).select("orgId").lean();
    if (targetUser?.orgId && String(targetUser.orgId) !== String(req.user.orgId)) {
      return res.status(403).json({ message: "Unauthorized access" });
    }
  }

  const experienceTypes = [
    "experience_letter",
    "offer_letter",
    "relieving_letter",
    "appraisal_letter",
    "salary_slips",
    "bank_statement"
  ];

  const docQuery = { userId, type: { $in: experienceTypes } };
  if (req.user.role !== "super_admin") {
    docQuery.orgId = String(req.user.orgId);
  }

  const documents = await Document.find(docQuery).sort({ uploadedAt: -1 });

  res.json(documents);
}));

// ============================================================================
// SOCKET.IO SETUP
// ============================================================================

io.on('connection', (socket) => {
  try {
    logger.info(`User connected: ${socket.id}`);

    // Validate JWT from Socket.IO auth or httpOnly cookie (browser)
    const cookies = parseCookies(socket.handshake.headers?.cookie);
    const token = socket.handshake.auth?.token || cookies[ACCESS_TOKEN_COOKIE];
    
    if (!token) {
      logger.warn(`Socket connection without token: ${socket.id}`);
      socket.emit('auth_error', { message: 'No token provided' });
      socket.disconnect();
      return;
    }

    // Verify JWT token
    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch (jwtError) {
      logger.warn(`Invalid JWT token: ${jwtError.message}`);
      socket.emit('auth_error', { message: 'Invalid token' });
      socket.disconnect();
      return;
    }

    // Store decoded token info on socket
    socket.userId = decoded.userId;
    socket.role = decoded.role;
    socket.tenantId = socketTenantIdFromDecoded(decoded);
    socket.email = decoded.email;

    if (!socket.tenantId && socket.userId) {
      User.findById(socket.userId)
        .select('orgId tenantId organizationId role')
        .lean()
        .then((u) => {
          const resolved = normalizeAuthOrgId(u);
          if (resolved) {
            socket.tenantId = resolved;
            logger.info(`Socket tenant resolved from user record`, { userId: socket.userId });
          }
        })
        .catch(() => {});
    }

    // Session setup — identity comes only from verified JWT (connection), not client payload
    socket.on('authenticate', async (data) => {
      let sessionError = null;
      try {
        const userId = socket.userId;
        const role = socket.role;
        const tenantId = socket.tenantId;

        if (!userId || !role) {
          logger.warn(`Socket authenticate without JWT identity: ${socket.id}`);
          socket.emit('auth_error', { message: 'Invalid session', code: 'INVALID_AUTH_DATA' });
          socket.disconnect(true);
          return;
        }

        if (data?.userId && String(data.userId) !== String(userId)) {
          logger.warn(`Socket identity spoof attempt: ${socket.id}`);
          socket.emit('auth_error', { message: 'Identity mismatch', code: 'IDENTITY_MISMATCH' });
          socket.disconnect(true);
          return;
        }

        // Allow multiple tabs/devices per user (sibling sockets are not disconnected)

        try {
          const { attachSocketToSession, countActiveSocketUsers } = await import(
            './utils/sessionPresence.js'
          );
          const session = await attachSocketToSession({
            userId,
            orgId: tenantId,
            role,
            socketId: socket.id,
            userAgent: socket.handshake.headers['user-agent'],
            ipAddress: socket.handshake.address,
          });
          socket.sessionId = session._id;
          logger.info(`Socket attached to session`, {
            sessionId: session._id,
            socketId: socket.id,
            socketCount: session.socketIds?.length,
          });
        } catch (err) {
          sessionError = err;
          console.error('❌ Session update error:', err.message);
          logger.error(`Failed to update session: ${err.message}`, { userId, socketId: socket.id });
          // Don't disconnect on session error - allow connection but log the issue
          socket.emit('session_warning', { message: 'Session update failed', code: 'SESSION_UPDATE_FAILED' });
        }

        // Join role-based rooms
        socket.join(`role_${role}`);
        
        if (tenantId) {
          socket.join(`tenant_${tenantId}`);
          console.log(`📍 Socket joined room: tenant_${tenantId}`);
        }

        socket.join(`user_${userId}`);

        if (role === 'admin' || role === 'super_admin') {
          socket.join('management');
          socket.join(`admin_${userId}`);
          socket.join('role_admin');
          if (tenantId) {
            socket.join(`role_admin_${tenantId}`);
          }
        }

        // Join employee room
        if (role === 'employee') {
          socket.join(`employee_${userId}`);
        }

        logger.info(`User ${userId} authenticated`, {
          socketId: socket.id,
          role,
          tenantId: socket.tenantId,
          rooms: socket.rooms
        });

        socket.emit('authenticated', { 
          success: true, 
          message: 'Authentication successful',
          userId,
          role,
          tenantId: socket.tenantId
        });

        // Emit dashboard update to all admins in the tenant
        try {
          if (!tenantId) {
            return;
          }
          const { countActiveSocketUsers } = await import('./utils/sessionPresence.js');
          const activeCount = await countActiveSocketUsers(tenantId);

          io.to(`tenant_${tenantId}`).emit('dashboard_update', {
            type: 'active_users_updated',
            data: {
              activeUsers: activeCount,
              userId,
              role,
              action: 'login'
            }
          });
          
          logger.info(`Dashboard update emitted for tenant ${tenantId}`, { activeUsers: activeCount });
        } catch (dashboardError) {
          logger.warn(`Failed to emit dashboard update: ${dashboardError.message}`);
        }

      } catch (error) {
        logger.error(`Socket authenticate error: ${error.message}`);
        socket.emit('auth_error', { message: error.message });
      }
    });

    // Employee events - broadcast to tenant
    socket.on('employee_created', (data) => {
      try {
        const tenantId = socket.tenantId || data?.tenantId;
        if (tenantId) {
          io.to(`tenant_${tenantId}`).emit('employee_created', data);
          logger.info('Employee created event broadcast', { tenantId, employeeId: data?.id });
        }
      } catch (error) {
        logger.error(`Socket employee_created error: ${error.message}`);
      }
    });

    socket.on('employee_updated', (data) => {
      try {
        const tenantId = socket.tenantId || data?.tenantId;
        if (tenantId) {
          io.to(`tenant_${tenantId}`).emit('employee_updated', data);
          logger.info('Employee updated event broadcast', { tenantId, employeeId: data?.id });
        }
      } catch (error) {
        logger.error(`Socket employee_updated error: ${error.message}`);
      }
    });

    socket.on('employee_deleted', (data) => {
      try {
        const tenantId = socket.tenantId || data?.tenantId;
        if (tenantId) {
          io.to(`tenant_${tenantId}`).emit('employee_deleted', data);
          logger.info('Employee deleted event broadcast', { tenantId, employeeId: data?.id });
        }
      } catch (error) {
        logger.error(`Socket employee_deleted error: ${error.message}`);
      }
    });

    // Leave events
    socket.on('leave_created', (data) => {
      try {
        const tenantId = socket.tenantId || data?.tenantId;
        if (tenantId) {
          io.to(`tenant_${tenantId}`).emit('leave_created', data);
          logger.info('Leave created event broadcast', { tenantId });
        }
      } catch (error) {
        logger.error(`Socket leave_created error: ${error.message}`);
      }
    });

    socket.on('leave_updated', (data) => {
      try {
        const tenantId = socket.tenantId || data?.tenantId;
        if (tenantId) {
          io.to(`tenant_${tenantId}`).emit('leave_updated', data);
          logger.info('Leave updated event broadcast', { tenantId });
        }
      } catch (error) {
        logger.error(`Socket leave_updated error: ${error.message}`);
      }
    });

    socket.on('leave_deleted', (data) => {
      try {
        const tenantId = socket.tenantId || data?.tenantId;
        if (tenantId) {
          io.to(`tenant_${tenantId}`).emit('leave_deleted', data);
        }
      } catch (error) {
        logger.error(`Socket leave_deleted error: ${error.message}`);
      }
    });

    // Expense events
    socket.on('expense_created', (data) => {
      try {
        const tenantId = socket.tenantId || data?.tenantId;
        if (tenantId) {
          io.to(`tenant_${tenantId}`).emit('expense_created', data);
        }
      } catch (error) {
        logger.error(`Socket expense_created error: ${error.message}`);
      }
    });

    socket.on('expense_updated', (data) => {
      try {
        const tenantId = socket.tenantId || data?.tenantId;
        if (tenantId) {
          io.to(`tenant_${tenantId}`).emit('expense_updated', data);
        }
      } catch (error) {
        logger.error(`Socket expense_updated error: ${error.message}`);
      }
    });

    socket.on('expense_deleted', (data) => {
      try {
        const tenantId = socket.tenantId || data?.tenantId;
        if (tenantId) {
          io.to(`tenant_${tenantId}`).emit('expense_deleted', data);
        }
      } catch (error) {
        logger.error(`Socket expense_deleted error: ${error.message}`);
      }
    });

    // Holiday events
    socket.on('holiday:created', (data) => {
      try {
        const tenantId = socket.tenantId || data?.tenantId;
        if (tenantId) {
          io.to(`tenant_${tenantId}`).emit('holiday:created', data);
          logger.info('Holiday created event broadcast', { tenantId });
        }
      } catch (error) {
        logger.error(`Socket holiday:created error: ${error.message}`);
      }
    });

    socket.on('holiday:updated', (data) => {
      try {
        const tenantId = socket.tenantId || data?.tenantId;
        if (tenantId) {
          io.to(`tenant_${tenantId}`).emit('holiday:updated', data);
          logger.info('Holiday updated event broadcast', { tenantId });
        }
      } catch (error) {
        logger.error(`Socket holiday:updated error: ${error.message}`);
      }
    });

    socket.on('holiday:deleted', (data) => {
      try {
        const tenantId = socket.tenantId || data?.tenantId;
        if (tenantId) {
          io.to(`tenant_${tenantId}`).emit('holiday:deleted', data);
          logger.info('Holiday deleted event broadcast', { tenantId });
        }
      } catch (error) {
        logger.error(`Socket holiday:deleted error: ${error.message}`);
      }
    });

    // Task events
    socket.on('task:assigned', (data) => {
      try {
        const tenantId = socket.tenantId || data?.tenantId;
        const assigneeId = data?.assigneeId;
        
        if (tenantId) {
          io.to(`tenant_${tenantId}`).emit('task:assigned', data);
          if (assigneeId) {
            io.to(`user_${assigneeId}`).emit('task:assigned', data);
          }
          logger.info('Task assigned event broadcast', { tenantId, assigneeId });
        }
      } catch (error) {
        logger.error(`Socket task:assigned error: ${error.message}`);
      }
    });

    socket.on('task:updated', (data) => {
      try {
        const tenantId = socket.tenantId || data?.tenantId;
        if (tenantId) {
          io.to(`tenant_${tenantId}`).emit('task:updated', data);
          logger.info('Task updated event broadcast', { tenantId });
        }
      } catch (error) {
        logger.error(`Socket task:updated error: ${error.message}`);
      }
    });

    // Break events - broadcast to tenant so all pages stay in sync
    socket.on('break:started', (data) => {
      try {
        const tenantId = socket.tenantId || data?.tenantId;
        const employeeId = data?.employeeId;
        
        if (tenantId && employeeId) {
          // Broadcast to all users in the tenant
          io.to(`tenant_${tenantId}`).emit('break:started', data);
          // Also broadcast to the specific employee
          io.to(`employee_${employeeId}`).emit('break:started', data);
          logger.info('Break started event broadcast', { tenantId, employeeId });
        }
      } catch (error) {
        logger.error(`Socket break:started error: ${error.message}`);
      }
    });

    socket.on('break:ended', (data) => {
      try {
        const tenantId = socket.tenantId || data?.tenantId;
        const employeeId = data?.employeeId;
        
        if (tenantId && employeeId) {
          // Broadcast to all users in the tenant
          io.to(`tenant_${tenantId}`).emit('break:ended', data);
          // Also broadcast to the specific employee
          io.to(`employee_${employeeId}`).emit('break:ended', data);
          logger.info('Break ended event broadcast', { tenantId, employeeId });
        }
      } catch (error) {
        logger.error(`Socket break:ended error: ${error.message}`);
      }
    });

    // Notification events
    socket.on('notification:send', (data) => {
      try {
        const tenantId = socket.tenantId || data?.tenantId;
        const recipientId = data?.recipientId;
        
        if (recipientId) {
          io.to(`user_${recipientId}`).emit('notification:received', data);
        } else if (tenantId) {
          io.to(`tenant_${tenantId}`).emit('notification:received', data);
        }
        logger.info('Notification sent event broadcast', { tenantId, recipientId });
      } catch (error) {
        logger.error(`Socket notification:send error: ${error.message}`);
      }
    });

    // Join/Leave room handlers — whitelist rooms per JWT identity
    const canJoinRoom = (room) => {
      if (!room || typeof room !== 'string' || room.length > 128) return false;
      const uid = String(socket.userId || '');
      const tenant = String(socket.tenantId || '');
      if (room === `user_${uid}`) return true;
      if (tenant && room === `tenant_${tenant}`) return true;
      if (['admin', 'hr', 'manager', 'super_admin'].includes(socket.role)) {
        if (room === 'management') return true;
        if (tenant && room.startsWith(`tenant_${tenant}`)) return true;
      }
      return false;
    };

    socket.on('join', (room) => {
      try {
        if (!canJoinRoom(room)) {
          logger.warn(`Socket join denied for ${socket.userId}: ${room}`);
          return;
        }
        socket.join(room);
        logger.debug(`User ${socket.userId} joined room: ${room}`);
      } catch (error) {
        logger.error(`Socket join error: ${error.message}`);
      }
    });

    socket.on('leave', (room) => {
      try {
        socket.leave(room);
        logger.debug(`User ${socket.userId} left room: ${room}`);
      } catch (error) {
        logger.error(`Socket leave error: ${error.message}`);
      }
    });

    // Disconnect
    socket.on('disconnect', async () => {
      try {
        logger.info(`User disconnected: ${socket.id}`, {
          userId: socket.userId,
          role: socket.role,
          tenantId: socket.tenantId
        });

        if (socket.sessionId) {
          try {
            const { detachSocketFromSession, countActiveSocketUsers } = await import(
              './utils/sessionPresence.js'
            );
            await detachSocketFromSession(socket.sessionId, socket.id);
            logger.info(`Socket detached from session: ${socket.sessionId}`);
          } catch (sessionError) {
            logger.warn(`Failed to update session: ${sessionError.message}`);
          }
        }

        // Emit dashboard update to all admins in the tenant
        try {
          const tenantId = socket.tenantId;
          if (!tenantId) {
            return;
          }
          const { countActiveSocketUsers } = await import('./utils/sessionPresence.js');
          const activeCount = await countActiveSocketUsers(tenantId);

          io.to(`tenant_${tenantId}`).emit('dashboard_update', {
            type: 'active_users_updated',
            data: {
              activeUsers: activeCount,
              userId: socket.userId,
              role: socket.role,
              action: 'logout'
            }
          });
          
          logger.info(`Dashboard update emitted for tenant ${tenantId}`, { activeUsers: activeCount });
        } catch (dashboardError) {
          logger.warn(`Failed to emit dashboard update on disconnect: ${dashboardError.message}`);
        }
      } catch (error) {
        logger.error(`Socket disconnect error: ${error.message}`);
      }
    });

    // Error handler
    socket.on('error', (error) => {
      logger.error(`Socket error for ${socket.id}: ${error.message}`);
    });
  } catch (error) {
    logger.error(`Socket connection error: ${error.message}`);
  }
});

// Initialize chat handlers
initializeChatHandlers(io);

// Socket.IO error handler
io.on('error', (error) => {
  logger.error(`Socket.IO error: ${error.message}`);
});

// ============================================================================
// DOCUMENT ROUTES
// ============================================================================

// ============================================================================
// ERROR HANDLER (MUST BE LAST)
// ============================================================================

app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: "Route not found"
  });
});

app.use(errorHandler);

// ============================================================================
// GRACEFUL SHUTDOWN
// ============================================================================

const gracefulShutdown = async (signal) => {
  logger.info(`${signal} received. Starting graceful shutdown...`);

  const forceExit = setTimeout(() => {
    logger.error('Graceful shutdown timed out — forcing exit');
    process.exit(1);
  }, 15_000);
  forceExit.unref();

  try {
    await new Promise((resolve) => {
      server.close(() => {
        logger.info('HTTP server closed');
        resolve();
      });
    });

    await new Promise((resolve) => {
      io.close(() => {
        logger.info('Socket.IO closed');
        resolve();
      });
    });

    await mongoose.connection.close();
    logger.info('Database connection closed');

    clearTimeout(forceExit);
    process.exit(0);
  } catch (error) {
    logger.error(`Error during shutdown: ${error.message}`);
    process.exit(1);
  }
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// ============================================================================
// UNCAUGHT EXCEPTION HANDLER
// ============================================================================

process.on('uncaughtException', (error) => {
  logger.error(`Uncaught Exception: ${error.message}`);
  logger.error(error.stack);
  process.exit(1);
});

process.on('unhandledRejection', (reason) => {
  logger.error('Unhandled promise rejection', {
    reason: reason instanceof Error ? reason.message : String(reason),
    stack: reason instanceof Error ? reason.stack : undefined,
  });
});

// ============================================================================
// SERVER STARTUP
// ============================================================================

const startServer = async () => {
  try {
    logger.info('🚀 Starting WorkPlus Backend Server...');
    logger.info(`Environment: ${process.env.NODE_ENV}`);

    // Connect to database
    logger.info('Connecting to MongoDB...');
    const dbConnected = await connectDB();
    
    if (!dbConnected) {
      logger.warn('⚠️  Database connection failed. Server starting in degraded mode.');
    } else {
      logger.info('✅ Database connected successfully');
      
      // Seed super admin after database connection
      logger.info('🌱 Seeding super admin...');
      await seedSuperAdmin();
    }

    // Initialize Redis
    logger.info('Initializing Redis...');
    await redis.initializeRedis();
    if (redis.isRedisConnected()) {
      logger.info('✅ Redis connected successfully');
      await attachSocketIoRedisAdapter(io);
    } else {
      logger.warn('⚠️  Redis not available - caching disabled');
    }

    // Start server
    const PORT = process.env.PORT || 5000;
    server.listen(PORT, () => {
      logger.info(`✅ Server running on port ${PORT}`);
      logger.info(`📊 Health check: http://localhost:${PORT}/health`);
      logger.info(`🔗 API: http://localhost:${PORT}/api`);
    });

  } catch (error) {
    logger.error(`Failed to start server: ${error.message}`);
    process.exit(1);
  }
};

// Start the server
startServer();

export { app, server, io };
