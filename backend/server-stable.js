/**
 * WorkPlus Backend Server - Production Stable Version
 * 
 * DEPRECATED: Prefer server.js — org scoping aligned with main app where duplicated.
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
  process.env.CORS_ORIGIN,
  process.env.FRONTEND_URL,
  "https://workplus-qbshegha8-hexervehrms-8667s-projects.vercel.app",
  "https://workplus-seven.vercel.app",
  "https://workplus.vercel.app"
  // Note: Local development origins removed for production security
  // Add them in your .env file for local development: CORS_ORIGIN=http://localhost:5173
].filter(Boolean);

const corsOptions = {
  origin: function(origin, callback) {
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
// SOCKET.IO SETUP
// ============================================================================

io.on('connection', (socket) => {
  try {
    logger.info(`User connected: ${socket.id}`);

    // Handle user authentication
    socket.on('authenticate', (data) => {
      try {
        const { userId, role, tenantId } = data;
        
        if (!userId || !tenantId) {
          logger.warn(`Invalid authentication data from ${socket.id}`);
          return;
        }

        socket.join(`tenant_${tenantId}`);
        socket.join(role);
        socket.userId = userId;
        socket.role = role;
        socket.tenantId = tenantId;

        if (role === 'admin' || role === 'superadmin') {
          socket.join('management');
        }

        logger.info(`User ${userId} authenticated for tenant ${tenantId}`);
      } catch (error) {
        logger.error(`Socket authenticate error: ${error.message}`);
      }
    });

    // Employee events
    socket.on('employee_created', (data) => {
      try {
        const tenantId = socket.tenantId || data?.tenantId;
        if (tenantId) {
          io.to(`tenant_${tenantId}`).emit('employee_created', data);
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
        }
      } catch (error) {
        logger.error(`Socket attendance:create error: ${error.message}`);
      }
    });

    // Disconnect
    socket.on('disconnect', () => {
      try {
        logger.info(`User disconnected: ${socket.id}`);
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
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ 
      success: false, 
      message: "Email and password are required" 
    });
  }

  const user = await User.findOne({ email });
  if (!user) {
    return res.status(401).json({ 
      success: false, 
      message: "Invalid credentials" 
    });
  }

  const isPasswordValid = await bcrypt.compare(password, user.password);
  if (!isPasswordValid) {
    return res.status(401).json({ 
      success: false, 
      message: "Invalid credentials" 
    });
  }

  const token = jwt.sign(
    { 
      userId: user._id,
      email: user.email,
      role: user.role,
      tenantId: user.orgId
    },
    process.env.JWT_SECRET,
    { expiresIn: '24h' }
  );

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
      tenantId: user.orgId
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
    orgId: orgId || decoded.tenantId || decoded.orgId
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

  const users = await User.find({}, { password: 0 });
  res.json({
    success: true,
    data: users
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
