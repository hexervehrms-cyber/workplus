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
import { tenantMiddleware, subscriptionMiddleware } from "./middleware/tenant.js";
import fileValidator from "./middleware/fileValidator.js";
import { loginLimiter, registerLimiter } from "./middleware/rateLimiter.js";

// Import logger
import logger from "./utils/logger.js";

// Import KPI updater
import { emitKPIUpdate, emitAttendanceKPIUpdate, emitLeaveKPIUpdate, emitExpenseKPIUpdate, emitEmployeeKPIUpdate } from "./utils/kpiUpdater.js";

// Import seeders
import seedSuperAdmin from "./seeders/superAdminSeeder.js";

// Import socket handlers
import { initializeChatHandlers } from "./utils/chatSocketHandlers.js";

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
import holidaysRoutes from "./routes/holidays.js";
import profileRoutes from "./routes/profile.js";
import rolesRoutes from "./routes/roles.js";
import chatRoutes from "./routes/chat.js";
import onboardingRoutes from "./routes/onboarding.js";
import salaryRoutes from "./routes/salary.js";
import payrollRoutes from "./routes/payroll.js";
import announcementsRoutes from "./routes/announcements.js";
import tasksRoutes from "./routes/tasks.js";
import organizationsRoutes from "./routes/organizations.js";

// Import sales routes
import callsRoutes from "./routes/sales/calls.js";
import leadsRoutes from "./routes/sales/leads.js";
import dealsRoutes from "./routes/sales/deals.js";
import performanceRoutes from "./routes/sales/performance.js";
import revenueRoutes from "./routes/sales/revenue.js";

// Setup __dirname for ES modules (must be before dotenv.config)
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
dotenv.config({ path: path.join(__dirname, '.env') });

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
    'workplus-pro-production-jwt-secret-key-32-chars-minimum-2024'
  ];
  
  if (defaultSecrets.includes(jwtSecret) || jwtSecret.length < 32) {
    console.error('❌ CRITICAL SECURITY ERROR: JWT_SECRET must be set to a secure value (minimum 32 characters)');
    console.error('   Current JWT_SECRET length:', jwtSecret.length);
    console.error('   Please set a strong, unique JWT_SECRET in your environment variables');
    process.exit(1);
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

// Create HTTP server for Socket.IO
const server = createServer(app);

// CORS whitelist - MUST be defined BEFORE Socket.IO initialization
// Use CORS_ORIGIN from environment variable, with fallbacks for common domains
const allowedOrigins = [
  process.env.CORS_ORIGIN, // Primary frontend URL from env
  process.env.FRONTEND_URL, // Alternative env variable name
  // Common Vercel deployment patterns
  "https://workplus-murex.vercel.app",
  "https://workplus-seven.vercel.app",
  "https://workplus.vercel.app"
  // Note: Local development origins removed for production security
  // Add them in your .env file for local development: CORS_ORIGIN=http://localhost:5173
].filter(Boolean); // Remove undefined/null values

const corsOptions = {
  origin: allowedOrigins,
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
  optionsSuccessStatus: 200
};

// Initialize Socket.IO with CORS options
const io = new Server(server, {
  cors: corsOptions,
  transports: ['websocket', 'polling'],
  pingInterval: 25000,
  pingTimeout: 60000,
});

// Make io globally accessible for routes
global.io = io;

// ============================================================================
// MIDDLEWARE SETUP
// ============================================================================

// Security middleware
app.use(helmet());

// Request logging
app.use(morgan('combined', {
  stream: {
    write: (message) => logger.http(message.trim())
  }
}));

// CORS
app.use(cors(corsOptions));
app.options('*', cors(corsOptions));

// Request ID middleware
app.use(requestIdMiddleware);

// Body parsing with size limits
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));

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

// Static files
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

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

// Apply CSRF protection middleware
app.use(generateCSRFToken);
app.use(verifyCSRFToken);

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
import { authenticate } from "./middleware/auth.js";

// Dashboard routes (with authentication)
app.use("/api/dashboard", authenticate, dashboardRoutes);
app.use("/api/dashboard", authenticate, dashboardSuperAdminRoutes);
app.use("/api/dashboard", authenticate, dashboardEmployeeRoutes);

// ============================================================================
// PUBLIC CLEANUP ENDPOINTS (for testing/development)
// ============================================================================

// Cleanup endpoint to delete all leave requests - PROTECTED with authentication
app.delete("/api/leave-requests/cleanup/all", authenticate, asyncHandler(async (req, res) => {
  try {
    const result = await LeaveRequest.deleteMany({});
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
app.use("/api/profile", authenticate, profileRoutes);

// Employees routes (with authentication)
app.use("/api/employees", authenticate, employeesRoutes);

// Documents routes (with authentication)
app.use("/api/documents", authenticate, documentsRoutes);

// Announcements routes (with authentication)
app.use("/api/announcements", authenticate, announcementsRoutes);

// Tasks routes (with authentication)
app.use("/api/tasks", authenticate, tasksRoutes);

// Organizations routes (with authentication)
app.use("/api/organizations", authenticate, organizationsRoutes);

// Expenses routes (with authentication)
app.use("/api/expenses", authenticate, expensesRoutes);

// Attendance routes (with authentication)
app.use("/api/attendance", authenticate, attendanceRoutes);

// Attendance History routes (with authentication)
app.use("/api/attendance-history", authenticate, attendanceHistoryRoutes);

// Leave routes (with authentication)
app.use("/api/leave-requests", authenticate, leaveRoutes);

// Leave allocation routes (with authentication)
app.use("/api/leave-allocation", authenticate, leaveAllocationRoutes);

// Leave type settings routes (with authentication)
app.use("/api/leave-type-settings", authenticate, leaveTypeSettingsRoutes);

// Holidays routes (with authentication)
app.use("/api/holidays", authenticate, holidaysRoutes);

// Users routes (with authentication)
app.use("/api/users", authenticate, usersRoutes);

// Roles routes (with authentication)
app.use("/api/roles", authenticate, rolesRoutes);

// Onboarding routes (mixed authentication - some public, some protected)
app.use("/api/onboarding", onboardingRoutes);

// Sales routes (with authentication)
app.use("/api/sales/calls", authenticate, callsRoutes);
app.use("/api/sales/leads", authenticate, leadsRoutes);
app.use("/api/sales/deals", authenticate, dealsRoutes);
app.use("/api/sales/performance", authenticate, performanceRoutes);
app.use("/api/sales/revenue", authenticate, revenueRoutes);

// Chat routes (with authentication)
app.use("/api/chat", authenticate, chatRoutes);

// Salary routes (with authentication)
app.use("/api/salary", authenticate, salaryRoutes);

// Payroll routes (with authentication)
app.use("/api/payroll", authenticate, payrollRoutes);

// ============================================================================
// SOCKET.IO SETUP
// ============================================================================

io.on('connection', (socket) => {
  try {
    logger.info(`User connected: ${socket.id}`);

    // Validate JWT token from Socket.IO auth
    const token = socket.handshake.auth?.token;
    
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
    socket.tenantId = decoded.tenantId || 'system';
    socket.email = decoded.email;

    // Handle user authentication with JWT
    socket.on('authenticate', async (data) => {
      try {
        const { userId, role, tenantId } = data;
        
        console.log('🔐 Authenticate event received:', { userId, role, tenantId });
        
        if (!userId || !role) {
          logger.warn(`Invalid authentication data from ${socket.id}`);
          socket.emit('auth_error', { message: 'Invalid authentication data' });
          return;
        }

        // Store user info on socket
        socket.userId = userId;
        socket.role = role;
        socket.tenantId = tenantId || 'system';

        // Create or update session record
        try {
          console.log('📝 Updating session for user:', userId);
          
          // Try to find existing session from login
          let session = await Session.findOne({
            userId,
            orgId: tenantId || 'system',
            isActive: true,
            socketId: null // Session created during login without socketId
          });
          
          if (session) {
            // Update existing session with socketId
            session.socketId = socket.id;
            session.connectTime = new Date();
            await session.save();
            console.log('✅ Session updated with socketId:', session._id);
            logger.info(`Session updated for user ${userId}`, { sessionId: session._id, socketId: socket.id });
          } else {
            // Create new session if not found (fallback)
            session = await Session.create({
              userId,
              orgId: tenantId || 'system',
              socketId: socket.id,
              role,
              isActive: true,
              connectTime: new Date()
            });
            console.log('✅ New session created:', session._id);
            logger.info(`New session created for user ${userId}`, { sessionId: session._id });
          }
          
          socket.sessionId = session._id;
        } catch (sessionError) {
          console.error('❌ Session update error:', sessionError.message);
          logger.warn(`Failed to update session: ${sessionError.message}`);
        }

        // Join role-based rooms
        socket.join(`role_${role}`);
        
        // Join tenant room - ALWAYS join with 'system' as fallback
        const finalTenantId = tenantId || 'system';
        socket.join(`tenant_${finalTenantId}`);
        console.log(`📍 Socket joined room: tenant_${finalTenantId}`);

        // Join user-specific room
        socket.join(`user_${userId}`);

        // Join management room for admins and super admins
        if (role === 'admin' || role === 'super_admin') {
          socket.join('management');
          socket.join(`admin_${userId}`);
          socket.join('role_admin');
          socket.join(`role_admin_${finalTenantId}`);
          console.log(`📍 Admin joined rooms: management, admin_${userId}, role_admin, role_admin_${finalTenantId}`);
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
          const activeCount = await Session.countDocuments({
            orgId: tenantId || 'system',
            isActive: true
          });
          
          io.to(`tenant_${tenantId || 'system'}`).emit('dashboard_update', {
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

    // Join/Leave room handlers
    socket.on('join', (room) => {
      try {
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

        // Mark session as inactive
        if (socket.sessionId) {
          try {
            await Session.findByIdAndUpdate(socket.sessionId, {
              isActive: false
            });
            logger.info(`Session marked inactive: ${socket.sessionId}`);
          } catch (sessionError) {
            logger.warn(`Failed to update session: ${sessionError.message}`);
          }
        }

        // Emit dashboard update to all admins in the tenant
        try {
          const tenantId = socket.tenantId || 'system';
          const activeCount = await Session.countDocuments({
            orgId: tenantId,
            isActive: true
          });
          
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
// AUTHENTICATION ROUTES
// ============================================================================

// Handle preflight for login
app.options("/api/auth/login", cors(corsOptions));

app.post("/api/auth/login", loginLimiter, asyncHandler(async (req, res) => {
  try {
    const { email, password } = req.body;

    // Validate input
    if (!email || !password) {
      console.error("LOGIN ERROR: Missing email or password");
      return res.status(400).json({ 
        success: false, 
        message: "Email and password are required",
        code: "MISSING_CREDENTIALS"
      });
    }

    // Find user by email
    const user = await User.findOne({ email: email.toLowerCase().trim() }).select('+password');
    if (!user) {
      console.error(`LOGIN ERROR: User not found - ${email}`);
      return res.status(401).json({ 
        success: false, 
        message: "Invalid credentials",
        code: "INVALID_CREDENTIALS"
      });
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      console.error(`LOGIN ERROR: Invalid password for ${email}`);
      return res.status(401).json({ 
        success: false, 
        message: "Invalid credentials",
        code: "INVALID_CREDENTIALS"
      });
    }

    // Generate JWT token
    const token = jwt.sign(
      { 
        userId: user._id.toString(),
        email: user.email,
        role: user.role,
        tenantId: user.orgId || 'system'
      },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );

    logger.info('User logged in successfully', {
      userId: user._id,
      email: user.email,
      role: user.role
    });

    // Return standardized response
    return res.status(200).json({
      success: true,
      message: "Login successful",
      token: token,
      user: {
        id: user._id.toString(),
        name: user.name,
        email: user.email,
        role: user.role,
        avatar: user.avatar || null,
        organization: user.organization || 'WorkPlus Inc.',
        tenantId: user.orgId || 'system'
      }
    });

  } catch (error) {
    console.error("LOGIN ERROR:", error);
    logger.error('Login endpoint error', {
      error: error.message,
      stack: error.stack
    });
    
    return res.status(500).json({
      success: false,
      message: "Server error during login",
      code: "LOGIN_ERROR"
    });
  }
}));

app.post("/api/auth/register", registerLimiter, asyncHandler(async (req, res) => {
  const { name, email, password, role, organization } = req.body;

  if (!name || !email || !password) {
    return res.status(400).json({ 
      success: false, 
      message: "Name, email and password are required" 
    });
  }

  const existingUser = await User.findOne({ email });
  if (existingUser) {
    return res.status(400).json({ 
      success: false, 
      message: "User already exists" 
    });
  }

  const hashedPassword = await bcrypt.hash(password, 10);
  const user = await User.create({
    name,
    email,
    password: hashedPassword,
    role: role || 'employee',
    organization: organization || 'WorkPlus Inc.'
  });

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

  io.emit('employee_created', userData);

  res.status(201).json({
    success: true,
    message: "Registration successful",
    data: {
      user: userData,
      token: token
    }
  });
}));

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
  
  const user = await User.findById(decoded.userId);
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

app.post("/api/auth/logout", asyncHandler(async (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(401).json({ 
      success: false, 
      message: "No token provided" 
    });
  }

  const token = authHeader.replace('Bearer ', '');
  
  try {
    jwt.verify(token, process.env.JWT_SECRET);
  } catch (jwtError) {
    return res.status(401).json({ 
      success: false, 
      message: "Invalid or expired token" 
    });
  }

  res.json({ 
    success: true, 
    message: "Logout successful" 
  });
}));

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
  
  try {
    // Close server
    server.close(() => {
      logger.info('HTTP server closed');
    });

    // Close Socket.IO
    io.close();
    logger.info('Socket.IO closed');

    // Close database connection
    await mongoose.connection.close();
    logger.info('Database connection closed');

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

process.on('unhandledRejection', (reason, promise) => {
  logger.error(`Unhandled Rejection at ${promise}: ${reason}`);
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


// ============================================================================
// ADDITIONAL ROUTES (Preserved from original)
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

  const existingUser = await User.findOne({ email });
  if (existingUser) {
    return res.status(400).json({ success: false, message: "User already exists with this email" });
  }

  const hashedPassword = await bcrypt.hash(password, 10);
  const user = await User.create({
    name,
    email,
    password: hashedPassword,
    role: 'admin',
    organization: organization || 'WorkPlus Inc.',
    orgId: orgId || decoded.tenantId || 'system'
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

// Get experience documents
app.get("/api/experience-documents/:userId", asyncHandler(async (req, res) => {
  const { userId } = req.params;
  
  if (!mongoose.Types.ObjectId.isValid(userId)) {
    return res.status(400).json({ message: "Invalid user ID" });
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
  }).sort({ uploadedAt: -1 });
  
  res.json(documents);
}));

// Update document status
app.patch("/api/documents/:id/status", asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;
  
  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).json({ message: "Invalid document ID" });
  }
  
  const document = await Document.findByIdAndUpdate(
    id, 
    { status }, 
    { new: true }
  );
  
  if (!document) {
    return res.status(404).json({ message: "Document not found" });
  }
  
  res.json(document);
}));


// Generate employee document
// NOTE: This endpoint is now handled by the documents router at POST /api/documents/digital-generate

// Get all documents for an employee
// NOTE: This endpoint is now handled by the documents router at GET /api/documents/employee/:employeeId

// Get documents for organization
// NOTE: This endpoint is now handled by the documents router at GET /api/documents/organization/:organizationId

// Get document by ID
// NOTE: This endpoint is now handled by the documents router at GET /api/documents/generated/:documentId

// Delete document
// NOTE: This endpoint is now handled by the documents router at DELETE /api/documents/generated/:documentId
