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
import { errorHandler, requestIdMiddleware, asyncHandler } from "./middleware/errorHandler.js";
import { tenantMiddleware, subscriptionMiddleware } from "./middleware/tenant.js";
import fileValidator from "./middleware/fileValidator.js";
import { loginLimiter, registerLimiter } from "./middleware/rateLimiter.js";

// Import logger
import logger from "./utils/logger.js";

// Import seeders
import seedSuperAdmin from "./seeders/superAdminSeeder.js";

// Import routes
import dashboardRoutes from "./routes/dashboard.js";
import dashboardSuperAdminRoutes from "./routes/dashboard-superadmin.js";
import dashboardEmployeeRoutes from "./routes/dashboard-employee.js";
import documentsRoutes from "./routes/documents.js";
import expensesRoutes from "./routes/expenses.js";
import employeesRoutes from "./routes/employees.js";
import attendanceRoutes from "./routes/attendance.js";
import leaveRoutes from "./routes/leave.js";
import usersRoutes from "./routes/users.js";
import holidaysRoutes from "./routes/holidays.js";
import profileRoutes from "./routes/profile.js";

// Load environment variables
dotenv.config({ path: './backend/.env' });

// ============================================================================
// ENVIRONMENT VALIDATION
// ============================================================================

const validateEnvironment = () => {
  const requiredVars = ['MONGODB_URI', 'JWT_SECRET', 'NODE_ENV'];
  const missing = requiredVars.filter(v => !process.env[v]);
  
  if (missing.length > 0) {
    console.error('❌ Missing required environment variables:', missing.join(', '));
    process.exit(1);
  }

  // Validate JWT_SECRET is not default
  if (process.env.JWT_SECRET === 'supersecretkey') {
    console.warn('⚠️  WARNING: JWT_SECRET is using default value. Change this in production!');
  }

  console.log('✅ Environment validation passed');
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

// CORS whitelist - MUST be defined BEFORE Socket.IO initialization
const allowedOrigins = [
  "https://workplus-murex.vercel.app",
  "https://workplus-seven.vercel.app",
  "https://workplus.vercel.app",
  "http://localhost:5173",
  "http://localhost:5174",
  "http://localhost:3000",
  "http://localhost:3001",
  process.env.CORS_ORIGIN
].filter(Boolean);

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
  // Emit attendance updates to Socket.IO
  req.emitAttendanceUpdate = (attendance, orgId) => {
    if (io) {
      io.to(`org_${orgId}`).emit('attendance:update', {
        attendance,
        timestamp: new Date(),
        orgId
      });
    }
  };

  // Emit leave updates to Socket.IO
  req.emitLeaveUpdate = (action, leaveRequest, orgId) => {
    if (io) {
      io.to(`org_${orgId}`).emit('leave:update', {
        action,
        leaveRequest,
        timestamp: new Date(),
        orgId
      });
    }
  };

  // Emit dashboard updates to Socket.IO
  req.emitDashboardUpdate = (action, type, data, orgId) => {
    if (io) {
      io.to(`org_${orgId}`).emit('dashboard:update', {
        action,
        type,
        data,
        timestamp: new Date(),
        orgId
      });
    }
  };

  // Emit activity updates to Socket.IO
  req.emitActivityUpdate = (activity, orgId) => {
    if (io) {
      io.to(`org_${orgId}`).emit('activity:update', {
        activity,
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
        io.to(`org_${orgId}`).emit('notification', {
          ...notification,
          timestamp: new Date()
        });
      }
    }
  };

  // Emit employee updates to Socket.IO
  req.emitEmployeeUpdate = (action, employee, orgId) => {
    if (io) {
      io.to(`org_${orgId}`).emit('employee:update', {
        action,
        employee,
        timestamp: new Date(),
        orgId
      });
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
// API ROUTES REGISTRATION
// ============================================================================

// Import auth middleware
import { authenticate } from "./middleware/auth.js";

// Dashboard routes (with authentication)
app.use("/api/dashboard", authenticate, dashboardRoutes);
app.use("/api/dashboard", authenticate, dashboardSuperAdminRoutes);
app.use("/api/dashboard", authenticate, dashboardEmployeeRoutes);

// Profile routes (with authentication)
app.use("/api/profile", authenticate, profileRoutes);

// Employees routes (with authentication)
app.use("/api/employees", authenticate, employeesRoutes);

// Documents routes (with authentication)
app.use("/api/documents", authenticate, documentsRoutes);

// Expenses routes (with authentication)
app.use("/api/expenses", authenticate, expensesRoutes);

// Attendance routes (with authentication)
app.use("/api/attendance", authenticate, attendanceRoutes);

// Leave routes (with authentication)
app.use("/api/leave-requests", authenticate, leaveRoutes);

// Holidays routes (with authentication)
app.use("/api/holidays", authenticate, holidaysRoutes);

// Users routes (with authentication)
app.use("/api/users", authenticate, usersRoutes);

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
    socket.on('authenticate', (data) => {
      try {
        const { userId, role, tenantId } = data;
        
        if (!userId || !role) {
          logger.warn(`Invalid authentication data from ${socket.id}`);
          socket.emit('auth_error', { message: 'Invalid authentication data' });
          return;
        }

        // Store user info on socket
        socket.userId = userId;
        socket.role = role;
        socket.tenantId = tenantId || 'system';

        // Join role-based rooms
        socket.join(`role_${role}`);
        
        // Join tenant room
        if (tenantId) {
          socket.join(`tenant_${tenantId}`);
        }

        // Join user-specific room
        socket.join(`user_${userId}`);

        // Join management room for admins and super admins
        if (role === 'admin' || role === 'super_admin') {
          socket.join('management');
          socket.join(`admin_${userId}`);
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

    // Attendance events
    socket.on('attendance:create', (data) => {
      try {
        const tenantId = socket.tenantId || data?.tenantId;
        if (tenantId) {
          io.to(`tenant_${tenantId}`).emit('attendance:create', data);
          logger.info('Attendance created event broadcast', { tenantId });
        }
      } catch (error) {
        logger.error(`Socket attendance:create error: ${error.message}`);
      }
    });

    socket.on('attendance:update', (data) => {
      try {
        const tenantId = socket.tenantId || data?.tenantId;
        if (tenantId) {
          io.to(`tenant_${tenantId}`).emit('attendance:update', data);
          logger.info('Attendance updated event broadcast', { tenantId });
        }
      } catch (error) {
        logger.error(`Socket attendance:update error: ${error.message}`);
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
    socket.on('disconnect', () => {
      try {
        logger.info(`User disconnected: ${socket.id}`, {
          userId: socket.userId,
          role: socket.role,
          tenantId: socket.tenantId
        });
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

// Socket.IO error handler
io.on('error', (error) => {
  logger.error(`Socket.IO error: ${error.message}`);
});

// ============================================================================
// AUTHENTICATION ROUTES
// ============================================================================

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

app.post("/api/documents/upload", upload.single('document'), fileValidator, asyncHandler(async (req, res) => {
  const { userId, name, type } = req.body;
  
  if (!req.file) {
    return res.status(400).json({ message: "No file uploaded" });
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
  res.status(201).json(document);
}));

app.get("/api/documents/:userId", asyncHandler(async (req, res) => {
  const { userId } = req.params;
  
  // Validate ObjectId
  if (!mongoose.Types.ObjectId.isValid(userId)) {
    return res.status(400).json({ message: "Invalid user ID" });
  }

  const documents = await Document.find({ userId }).sort({ uploadedAt: -1 });
  res.json(documents);
}));

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

// Onboarding form submission
app.post("/api/onboarding/submit", upload.array('documents'), asyncHandler(async (req, res) => {
  const {
    firstName,
    lastName,
    email,
    phone,
    dateOfBirth,
    gender,
    address,
    avatar,
    employeeId,
    joiningDate,
    department,
    designation,
    employmentType,
    workLocation,
    aadharNumber,
    panNumber,
    bankAccount,
    ifscCode,
    emergencyName,
    emergencyRelation,
    emergencyPhone,
    documents
  } = req.body;

  if (!firstName || !lastName || !email || !phone || !dateOfBirth || !gender || !address) {
    return res.status(400).json({ message: "Please fill in all required personal information fields" });
  }

  if (!employeeId) {
    return res.status(400).json({ message: "Employee ID is required" });
  }

  if (!joiningDate || !department || !designation || !employmentType || !workLocation) {
    return res.status(400).json({ message: "Please fill in all official information fields" });
  }

  if (!aadharNumber || !panNumber || !bankAccount || !ifscCode) {
    return res.status(400).json({ message: "Please fill in all banking information fields" });
  }

  if (!emergencyName || !emergencyRelation || !emergencyPhone) {
    return res.status(400).json({ message: "Please fill in all emergency contact fields" });
  }

  let avatarUrl = null;
  if (avatar) {
    avatarUrl = `/avatars/${employeeId}_${Date.now()}.jpg`;
    logger.info(`Avatar uploaded for employee ${employeeId}: ${avatarUrl}`);
  }

  let uploadedDocuments = [];
  if (req.files && req.files.length > 0) {
    uploadedDocuments = req.files.map(file => ({
      fileName: file.originalname,
      filePath: file.path,
      size: `${(file.size / 1024).toFixed(1)} KB`,
      uploadedAt: new Date()
    }));
  }

  let user;
  if (employeeId && employeeId.startsWith('new_employee_')) {
    user = new User({
      name: `${firstName} ${lastName}`,
      email,
      password: 'tempPassword123',
      role: 'employee',
      orgId: 'org_001'
    });
    await user.save();
  } else {
    user = await User.findByIdAndUpdate(
      employeeId,
      {
        name: `${firstName} ${lastName}`,
        email,
        role: 'employee'
      },
      { new: true }
    );
  }

  const onboardingSubmission = await OnboardingSubmission.create({
    employeeId: user._id.toString(),
    employeeName: `${firstName} ${lastName}`,
    email,
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

  res.status(201).json({
    message: "Onboarding form submitted successfully",
    userId: user._id,
    onboardingData: onboardingSubmission
  });
}));

// Generate sharable onboarding link
app.post("/api/onboarding/generate-link", asyncHandler(async (req, res) => {
  const { employeeEmail, employeeName, department, organizationName, organizationId, createdBy } = req.body;
  
  if (!employeeEmail || !employeeName) {
    return res.status(400).json({ message: "Employee email and name are required" });
  }

  const token = crypto.randomBytes(32).toString('hex');
  
  const onboardingLink = await OnboardingLink.create({
    token,
    employeeEmail,
    employeeName,
    department: department || 'General',
    organizationName: organizationName || 'Default Organization',
    organizationId: organizationId || 'ORG-DEFAULT',
    createdBy,
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    isUsed: false
  });
  
  const shareableLink = `${req.protocol}://${req.get('host')}/onboarding/${token}`;
  
  res.status(201).json({
    message: "Onboarding link generated successfully",
    link: shareableLink,
    token,
    expiresAt: onboardingLink.expiresAt
  });
}));

// Validate onboarding link
app.get("/api/onboarding/validate/:token", asyncHandler(async (req, res) => {
  const { token } = req.params;
  
  const onboardingLink = await OnboardingLink.findOne({ token });
  
  if (!onboardingLink) {
    return res.status(400).json({ message: "Invalid or expired link" });
  }

  if (onboardingLink.isUsed) {
    return res.status(400).json({ message: "Link already used" });
  }

  if (onboardingLink.expiresAt && new Date(onboardingLink.expiresAt) < new Date()) {
    return res.status(400).json({ message: "Link expired" });
  }

  res.json({
    valid: true,
    employeeEmail: onboardingLink.employeeEmail,
    employeeName: onboardingLink.employeeName,
    department: onboardingLink.department,
    organizationName: onboardingLink.organizationName
  });
}));

// Generate employee document
app.post("/api/documents/generate", asyncHandler(async (req, res) => {
  const { employeeId, documentType, organizationId, createdBy, documentData } = req.body;
  
  if (!employeeId || !documentType || !organizationId) {
    return res.status(400).json({ message: "Employee ID, document type, and organization ID are required" });
  }

  if (!mongoose.Types.ObjectId.isValid(employeeId)) {
    return res.status(400).json({ message: "Invalid employee ID" });
  }

  const employee = await Employee.findById(employeeId).populate('userId');
  const employeeName = employee ? employee.userId?.name : 'Unknown';
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

  res.status(201).json({
    message: "Document generated successfully",
    document
  });
}));

// Get all documents for an employee
app.get("/api/documents/employee/:employeeId", asyncHandler(async (req, res) => {
  const { employeeId } = req.params;
  
  if (!mongoose.Types.ObjectId.isValid(employeeId)) {
    return res.status(400).json({ message: "Invalid employee ID" });
  }
  
  const employeeDocuments = await GeneratedDocument.find({ employeeId })
    .sort({ createdAt: -1 });

  res.json(employeeDocuments);
}));

// Get documents for organization
app.get("/api/documents/organization/:organizationId", asyncHandler(async (req, res) => {
  const { organizationId } = req.params;
  
  const organizationDocuments = await GeneratedDocument.find({ organizationId })
    .sort({ createdAt: -1 });

  res.json(organizationDocuments);
}));

// Get document by ID
app.get("/api/documents/:documentId", asyncHandler(async (req, res) => {
  const { documentId } = req.params;
  
  const document = await GeneratedDocument.findOne({ id: documentId });

  if (!document) {
    return res.status(404).json({ message: "Document not found" });
  }

  res.json(document);
}));

// Delete document
app.delete("/api/documents/:documentId", asyncHandler(async (req, res) => {
  const { documentId } = req.params;
  
  const deletedDocument = await GeneratedDocument.findOneAndDelete({ id: documentId });

  if (!deletedDocument) {
    return res.status(404).json({ message: "Document not found" });
  }

  res.json({ message: "Document deleted successfully" });
}));
