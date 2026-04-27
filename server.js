import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import bcrypt from "bcrypt";
import connectDB from "./config/db.js";
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
import multer from "multer";
import path from "path";
import { fileURLToPath } from "url";
import { createServer } from "http";
import { Server } from "socket.io";
import { tenantMiddleware, subscriptionMiddleware } from "./middleware/tenant.js";
import jwt from "jsonwebtoken";

// Load environment variables
dotenv.config();

// Connect to database
connectDB();

// Seed Super Admin if not exists
async function seedSuperAdmin() {
  try {
    const superAdminEmail = 'superadmin@admin.com';
    const superAdminPassword = '123456';
    const superAdminName = 'Super Admin';

    // Check if super admin already exists
    const existingSuperAdmin = await User.findOne({ role: 'super_admin' });
    
    if (existingSuperAdmin) {
      console.log('✅ Super admin already exists:', existingSuperAdmin.email);
      return;
    }

    // Hash password before storing
    const hashedPassword = await bcrypt.hash(superAdminPassword, 10);

    // Create super admin
    const superAdmin = await User.create({
      name: superAdminName,
      email: superAdminEmail,
      password: hashedPassword,
      role: 'super_admin',
      isActive: true,
      orgId: 'system'
    });

    console.log('🎉 Super admin created successfully!');
    console.log('   Email:', superAdminEmail);
    console.log('   Password:', superAdminPassword);
    console.log('   Role: super_admin');
  } catch (error) {
    console.error('❌ Error seeding super admin:', error.message);
  }
}

const app = express();

// Get __dirname equivalent in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Create HTTP server for Socket.IO
const server = createServer(app);

// Initialize Socket.IO
const io = new Server(server, {
  cors: {
    origin: function(origin, callback) {
      if (!origin) return callback(null, true);
      if (allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error("Not allowed by CORS"));
      }
    },
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    credentials: true,
    optionsSuccessStatus: 200
  }
});

// CORS Middleware - MUST be before other middleware
// Dynamic CORS whitelist for production
const allowedOrigins = [
  "https://workplus-murex.vercel.app",
  "https://workplus-seven.vercel.app",
  "https://workplus.vercel.app",
  "http://localhost:5173",
  "http://localhost:3000",
  "http://localhost:3001",
  process.env.CORS_ORIGIN
].filter(Boolean);

app.use(cors({
  origin: function(origin, callback) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    
    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      console.warn(`CORS blocked origin: ${origin}`);
      callback(new Error("Not allowed by CORS"));
    }
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
  optionsSuccessStatus: 200
}));

// Preflight requests
app.options("*", cors({
  origin: function(origin, callback) {
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error("Not allowed by CORS"));
    }
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
  optionsSuccessStatus: 200
}));

// Middleware
app.use(express.json());

// Health check routes - MUST be before other routes
app.get("/", (req, res) => {
  res.json({
    success: true,
    message: "WorkPlus backend running",
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || "production"
  });
});

app.get("/health", async (req, res) => {
  try {
    // Check MongoDB connection
    const mongoStatus = require("mongoose").connection.readyState;
    const isConnected = mongoStatus === 1;
    
    res.json({
      success: true,
      status: "healthy",
      database: isConnected ? "connected" : "disconnected",
      timestamp: new Date().toISOString(),
      uptime: process.uptime()
    });
  } catch (error) {
    res.status(503).json({
      success: false,
      status: "unhealthy",
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

app.get("/api/health", async (req, res) => {
  try {
    const mongoStatus = require("mongoose").connection.readyState;
    const isConnected = mongoStatus === 1;
    
    res.json({
      success: true,
      status: "healthy",
      database: isConnected ? "connected" : "disconnected",
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(503).json({
      success: false,
      status: "unhealthy",
      error: error.message
    });
  }
});

// Serve static files
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Apply tenant middleware to protected API routes only (NOT auth routes)
// We'll apply tenant middleware individually to routes that need it
// This allows auth routes (login, register) to work without authentication

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'uploads/');
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + '-' + file.originalname);
  }
});

const upload = multer({ storage: storage });

// Socket.IO connection handling
io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  // Handle user authentication and role assignment
  socket.on('authenticate', (data) => {
    const { userId, role, tenantId } = data;
    
    // Join tenant-specific room
    socket.join(`tenant_${tenantId}`);
    
    // Join role-based room
    socket.join(role);
    
    // Store user info in socket
    socket.userId = userId;
    socket.role = role;
    socket.tenantId = tenantId;
    
    console.log(`User ${userId} joined tenant ${tenantId} as ${role}`);
    
    // Broadcast to relevant rooms
    if (role === 'admin' || role === 'superadmin') {
      socket.join('management');
    }
  });

  // Handle employee events (tenant-scoped)
  socket.on('employee_created', (data) => {
    const tenantId = socket.tenantId || data.tenantId;
    if (tenantId) {
      io.to(`tenant_${tenantId}`).emit('employee_created', data);
    }
    console.log('Employee created:', data);
  });

  socket.on('employee_updated', (data) => {
    const tenantId = socket.tenantId || data.tenantId;
    if (tenantId) {
      io.to(`tenant_${tenantId}`).emit('employee_updated', data);
    }
    console.log('Employee updated:', data);
  });

  socket.on('employee_deleted', (data) => {
    const tenantId = socket.tenantId || data.tenantId;
    if (tenantId) {
      io.to(`tenant_${tenantId}`).emit('employee_deleted', data);
    }
    console.log('Employee deleted:', data);
  });

  // Handle leave request events (tenant-scoped)
  socket.on('leave_created', (data) => {
    const tenantId = socket.tenantId || data.tenantId;
    if (tenantId) {
      io.to(`tenant_${tenantId}`).emit('leave_created', data);
    }
    console.log('Leave created:', data);
  });

  socket.on('leave_updated', (data) => {
    const tenantId = socket.tenantId || data.tenantId;
    if (tenantId) {
      io.to(`tenant_${tenantId}`).emit('leave_updated', data);
    }
    console.log('Leave updated:', data);
  });

  socket.on('leave_deleted', (data) => {
    const tenantId = socket.tenantId || data.tenantId;
    if (tenantId) {
      io.to(`tenant_${tenantId}`).emit('leave_deleted', data);
    }
    console.log('Leave deleted:', data);
  });

  // Handle expense events (tenant-scoped)
  socket.on('expense_created', (data) => {
    const tenantId = socket.tenantId || data.tenantId;
    if (tenantId) {
      io.to(`tenant_${tenantId}`).emit('expense_created', data);
    }
    console.log('Expense created:', data);
  });

  socket.on('expense_updated', (data) => {
    const tenantId = socket.tenantId || data.tenantId;
    if (tenantId) {
      io.to(`tenant_${tenantId}`).emit('expense_updated', data);
    }
    console.log('Expense updated:', data);
  });

  socket.on('expense_deleted', (data) => {
    const tenantId = socket.tenantId || data.tenantId;
    if (tenantId) {
      io.to(`tenant_${tenantId}`).emit('expense_deleted', data);
    }
    console.log('Expense deleted:', data);
  });

  // Handle attendance events (tenant-scoped)
  socket.on('attendance:create', (data) => {
    const tenantId = socket.tenantId || data.tenantId;
    if (tenantId) {
      io.to(`tenant_${tenantId}`).emit('attendance:create', data);
    }
    console.log('Attendance created:', data);
  });

  // Handle disconnection
  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
  });
});

// Test route
app.get("/test", async (req, res) => {
  const user = await User.create({
    name: "Test User",
    email: "test@gmail.com",
    password: "123456",
    role: "employee"
  });

  res.json(user);
});

// Authentication endpoints
app.post("/api/auth/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    // Validate input
    if (!email || !password) {
      return res.status(400).json({ success: false, message: "Email and password are required" });
    }

    // Find user in database
    const user = await User.findOne({ email });
    
    if (!user) {
      return res.status(401).json({ success: false, message: "Invalid credentials" });
    }

    // Verify password using bcrypt
    const isPasswordValid = await bcrypt.compare(password, user.password);
    
    if (!isPasswordValid) {
      return res.status(401).json({ success: false, message: "Invalid credentials" });
    }

    // Generate proper JWT token
    const token = jwt.sign(
      { 
        userId: user._id,
        email: user.email,
        role: user.role,
        tenantId: user.orgId || 'system'
      },
      process.env.JWT_SECRET || 'supersecretkey',
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
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
});

app.post("/api/auth/register", async (req, res) => {
  try {
    const { name, email, password, role, organization } = req.body;

    // Validate input
    if (!name || !email || !password) {
      return res.status(400).json({ success: false, message: "Name, email and password are required" });
    }

    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
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

    // Generate proper JWT token
    const token = jwt.sign(
      { 
        userId: user._id,
        email: user.email,
        role: user.role,
        tenantId: user.orgId || 'system'
      },
      process.env.JWT_SECRET || 'supersecretkey',
      { expiresIn: '24h' }
    );

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

    res.status(201).json({
      success: true,
      message: "Registration successful",
      data: {
        user: userData,
        token: token
      }
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
});

app.get("/api/auth/me", async (req, res) => {
  try {
    // Get token from Authorization header
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return res.status(401).json({ success: false, message: "No token provided" });
    }

    const token = authHeader.replace('Bearer ', '');
    
    // Verify JWT token
    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET || 'supersecretkey');
    } catch (jwtError) {
      return res.status(401).json({ success: false, message: "Invalid or expired token" });
    }
    
    const user = await User.findById(decoded.userId);
    if (!user) {
      return res.status(401).json({ success: false, message: "User not found" });
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
  } catch (error) {
    console.error('Get current user error:', error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
});

app.post("/api/auth/logout", async (req, res) => {
  try {
    // Get token from Authorization header
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return res.status(401).json({ success: false, message: "No token provided" });
    }

    const token = authHeader.replace('Bearer ', '');
    
    // Verify JWT token
    try {
      jwt.verify(token, process.env.JWT_SECRET || 'supersecretkey');
    } catch (jwtError) {
      return res.status(401).json({ success: false, message: "Invalid or expired token" });
    }

    // In production, you would invalidate the token here (e.g., add to blacklist)
    // For demo, just return success
    res.json({ success: true, message: "Logout successful" });
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
});

// Create Admin (Super Admin only)
app.post("/api/auth/create-admin", async (req, res) => {
  try {
    // Get token from Authorization header
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return res.status(401).json({ success: false, message: "No token provided" });
    }

    const token = authHeader.replace('Bearer ', '');
    
    // Verify JWT token and check if user is super_admin
    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET || 'supersecretkey');
    } catch (jwtError) {
      return res.status(401).json({ success: false, message: "Invalid or expired token" });
    }

    // Check if requester is super_admin
    if (decoded.role !== 'super_admin') {
      return res.status(403).json({ success: false, message: "Only super admin can create admin accounts" });
    }

    const { name, email, password, organization, orgId } = req.body;

    // Validate input
    if (!name || !email || !password) {
      return res.status(400).json({ success: false, message: "Name, email and password are required" });
    }

    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ success: false, message: "User already exists with this email" });
    }

    // Hash password using bcrypt
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create admin user
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
  } catch (error) {
    console.error('Create admin error:', error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
});

// Get all users (Admin/Super Admin only)
app.get("/api/users", async (req, res) => {
  try {
    // Get token from Authorization header
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return res.status(401).json({ success: false, message: "No token provided" });
    }

    const token = authHeader.replace('Bearer ', '');
    
    // Verify JWT token
    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET || 'supersecretkey');
    } catch (jwtError) {
      return res.status(401).json({ success: false, message: "Invalid or expired token" });
    }

    // Check if user is admin or super_admin
    if (!['admin', 'super_admin'].includes(decoded.role)) {
      return res.status(403).json({ success: false, message: "Access denied" });
    }

    // Get all users (excluding passwords)
    const users = await User.find({}, { password: 0 });

    res.json({
      success: true,
      data: users
    });
  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
});

// Document routes
// Upload document
app.post("/api/documents/upload", upload.single('document'), async (req, res) => {
  try {
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
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get user documents
app.get("/api/documents/:userId", async (req, res) => {
  try {
    const { userId } = req.params;
    const documents = await Document.find({ userId }).sort({ uploadedAt: -1 });
    res.json(documents);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get experience documents (available for everyone)
app.get("/api/experience-documents/:userId", async (req, res) => {
  try {
    const { userId } = req.params;
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
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Update document status
app.patch("/api/documents/:id/status", async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    
    const document = await Document.findByIdAndUpdate(
      id, 
      { status }, 
      { new: true }
    );
    
    if (!document) {
      return res.status(404).json({ message: "Document not found" });
    }
    
    res.json(document);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Onboarding form submission
app.post("/api/onboarding/submit", upload.array('documents'), async (req, res) => {
  try {
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

    // Validate required fields
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

    // Handle avatar upload (in production, save to file storage/cloud storage)
    let avatarUrl = null;
    if (avatar) {
      // For demo purposes, simulate avatar upload
      avatarUrl = `/avatars/${employeeId}_${Date.now()}.jpg`;
      console.log(`Avatar uploaded for employee ${employeeId}: ${avatarUrl}`);
    }

    // Find or create user
    let user;
    if (employeeId && employeeId.startsWith('new_employee_')) {
      // Create new user
      user = new User({
        name: `${firstName} ${lastName}`,
        email,
        password: 'tempPassword123', // Should be changed on first login
        role: 'employee',
        orgId: 'org_001'
      });
      await user.save();
    } else {
      // Update existing user
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

    // Save onboarding submission to MongoDB
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

  } catch (error) {
    console.error('Onboarding submission error:', error);
    res.status(500).json({ message: error.message });
  }
});

// Generate sharable onboarding link
app.post("/api/onboarding/generate-link", async (req, res) => {
  try {
    const { employeeEmail, employeeName, department, organizationName, organizationId, createdBy } = req.body;
    
    if (!employeeEmail || !employeeName) {
      return res.status(400).json({ message: "Employee email and name are required" });
    }

    // Generate unique token
    const token = require('crypto').randomBytes(32).toString('hex');
    
    // Create onboarding link in MongoDB
    const onboardingLink = await OnboardingLink.create({
      token,
      employeeEmail,
      employeeName,
      department: department || 'General',
      organizationName: organizationName || 'Default Organization',
      organizationId: organizationId || 'ORG-DEFAULT',
      createdBy,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
      isUsed: false
    });
    
    const shareableLink = `${req.protocol}://${req.get('host')}/onboarding/${token}`;
    
    res.status(201).json({
      message: "Onboarding link generated successfully",
      link: shareableLink,
      token,
      expiresAt: onboardingLink.expiresAt
    });
  } catch (error) {
    console.error('Error generating onboarding link:', error);
    res.status(500).json({ message: error.message });
  }
});

// Validate onboarding link
app.get("/api/onboarding/validate/:token", async (req, res) => {
  try {
    const { token } = req.params;
    
    // Check if token exists in MongoDB
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
  } catch (error) {
    console.error('Error validating onboarding link:', error);
    res.status(500).json({ message: error.message });
  }
});

// Generate employee document
app.post("/api/documents/generate", async (req, res) => {
  try {
    const { employeeId, documentType, organizationId, createdBy, documentData } = req.body;
    
    if (!employeeId || !documentType || !organizationId) {
      return res.status(400).json({ message: "Employee ID, document type, and organization ID are required" });
    }

    // Get employee details
    const employee = await Employee.findById(employeeId).populate('userId');
    const employeeName = employee ? employee.userId?.name : 'Unknown';
    const organizationName = organizationId;

    const documentId = `doc_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const documentUrl = `/documents/${documentId}.pdf`;
    
    // Create document in MongoDB
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

  } catch (error) {
    console.error('Error generating document:', error);
    res.status(500).json({ message: error.message });
  }
});

// Get all documents for an employee
app.get("/api/documents/employee/:employeeId", async (req, res) => {
  try {
    const { employeeId } = req.params;
    
    const employeeDocuments = await GeneratedDocument.find({ employeeId })
      .sort({ createdAt: -1 });

    res.json(employeeDocuments);

  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get documents for organization
app.get("/api/documents/organization/:organizationId", async (req, res) => {
  try {
    const { organizationId } = req.params;
    
    const organizationDocuments = await GeneratedDocument.find({ organizationId })
      .sort({ createdAt: -1 });

    res.json(organizationDocuments);

  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get document by ID
app.get("/api/documents/:documentId", async (req, res) => {
  try {
    const { documentId } = req.params;
    
    const document = await GeneratedDocument.findOne({ id: documentId });

    if (!document) {
      return res.status(404).json({ message: "Document not found" });
    }

    res.json(document);

  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Delete document
app.delete("/api/documents/:documentId", async (req, res) => {
  try {
    const { documentId } = req.params;
    
    const deletedDocument = await GeneratedDocument.findOneAndDelete({ id: documentId });

    if (!deletedDocument) {
      return res.status(404).json({ message: "Document not found" });
    }

    res.json({ message: "Document deleted successfully" });

  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Document templates data
const documentTemplates = {
  "Letter of Intent": {
    template: "letter_of_intent",
    requiredFields: ["employeeName", "position", "startDate", "salary", "reportingTo"],
    description: "Formal letter expressing intention to employ"
  },
  "Offer Letter": {
    template: "offer_letter",
    requiredFields: ["employeeName", "position", "salary", "startDate", "benefits"],
    description: "Official employment offer with terms and conditions"
  },
  "Appointment Letter": {
    template: "appointment_letter",
    requiredFields: ["employeeName", "position", "department", "startDate", "employmentType"],
    description: "Formal appointment confirmation"
  },
  "Appraisal Letter": {
    template: "appraisal_letter",
    requiredFields: ["employeeName", "period", "performanceRating", "achievements", "recommendations"],
    description: "Performance evaluation and feedback"
  },
  "Salary Slips": {
    template: "salary_slip",
    requiredFields: ["employeeName", "month", "year", "basicSalary", "allowances", "deductions"],
    description: "Monthly salary statement"
  },
  "Warning Letter": {
    template: "warning_letter",
    requiredFields: ["employeeName", "warningType", "incident", "improvementPlan", "deadline"],
    description: "Official warning for misconduct or performance issues"
  },
  "Corrective Action Plan (CAP)": {
    template: "corrective_action_plan",
    requiredFields: ["employeeName", "issues", "actionItems", "timeline", "expectedOutcomes"],
    description: "Structured plan for performance improvement"
  }
};

// Get document templates
app.get("/api/documents/templates", async (req, res) => {
  try {
    res.json(documentTemplates);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Company Documents API endpoints

// Get company documents
app.get("/api/company-documents", async (req, res) => {
  try {
    const { organizationId, category, status } = req.query;
    
    let query = {};
    if (organizationId) query.organizationId = organizationId;
    if (category) query.category = category;
    if (status) query.status = status;

    const documents = await CompanyDocument.find(query)
      .sort({ createdAt: -1 });

    // Only return published documents for non-admin requests
    if (!req.headers['x-user-role'] || !['admin', 'super_admin'].includes(req.headers['x-user-role'])) {
      documents = documents.filter(doc => doc.status === 'Published' && doc.isPublic);
    }

    res.json(documents);
  } catch (error) {
    console.error('Error fetching company documents:', error);
    res.status(500).json({ message: error.message });
  }
});

// Upload company document
app.post("/api/company-documents/upload", async (req, res) => {
  try {
    const { title, type, category, description, organizationId, uploadedBy, uploadedByName, isPublic, requiresAcknowledgment, acknowledgmentDeadline, assignTo, targetUsers, targetDepartments } = req.body;
    
    if (!title || !type || !organizationId) {
      return res.status(400).json({ message: "Title, type, and organization ID are required" });
    }

    const documentId = `comp_doc_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const document = await CompanyDocument.create({
      id: documentId,
      name: title,
      type,
      category: category || 'General',
      description: description || '',
      organizationId,
      uploadedBy,
      uploadedByName: uploadedByName || 'Unknown',
      status: 'active',
      fileUrl: `/company-documents/${documentId}.pdf`,
      fileName: `${title.replace(/\s+/g, '_')}.pdf`,
      fileSize: '1.2 MB',
      isPublic: isPublic !== false,
      requiresAcknowledgment: requiresAcknowledgment || false,
      acknowledgmentDeadline,
      assignTo: assignTo || 'all',
      targetUsers: targetUsers || [],
      targetDepartments: targetDepartments || []
    });

    res.status(201).json({
      message: "Document uploaded successfully",
      document
    });
  } catch (error) {
    console.error('Error uploading document:', error);
    res.status(500).json({ message: error.message });
  }
});

// Update company document
app.patch("/api/company-documents/:documentId", async (req, res) => {
  try {
    const { documentId } = req.params;
    const updates = req.body;

    const updatedDocument = await CompanyDocument.findOneAndUpdate(
      { id: documentId },
      { ...updates, updatedAt: new Date() },
      { new: true }
    );

    if (!updatedDocument) {
      return res.status(404).json({ message: "Document not found" });
    }

    res.json({
      message: "Document updated successfully",
      document: updatedDocument
    });

  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Delete company document
app.delete("/api/company-documents/:documentId", async (req, res) => {
  try {
    const { documentId } = req.params;

    const deletedDocument = await CompanyDocument.findOneAndDelete({ id: documentId });

    if (!deletedDocument) {
      return res.status(404).json({ message: "Document not found" });
    }

    res.json({ message: "Document deleted successfully" });

  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Increment download count
app.post("/api/company-documents/:documentId/download", async (req, res) => {
  try {
    const { documentId } = req.params;

    const document = await CompanyDocument.findOneAndUpdate(
      { id: documentId },
      { $inc: { downloadCount: 1 } },
      { new: true }
    );

    if (!document) {
      return res.status(404).json({ message: "Document not found" });
    }

    res.json({
      message: "Download count incremented",
      document
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Document Acknowledgment API endpoints

// Submit document acknowledgment
app.post("/api/document-acknowledgments", async (req, res) => {
  try {
    const { documentId, documentName, employeeId, employeeName, organizationId, acknowledgedAt, ipAddress } = req.body;
    
    if (!documentId || !employeeId || !employeeName || !organizationId) {
      return res.status(400).json({ message: "Document ID, employee ID, employee name, and organization ID are required" });
    }

    // Generate unique acknowledgment ID
    const acknowledgmentId = `ack_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // Create acknowledgment in MongoDB
    const acknowledgment = await DocumentAcknowledgment.create({
      id: acknowledgmentId,
      documentId,
      documentName: documentName || 'Unknown Document',
      employeeId,
      employeeName,
      organizationId,
      acknowledgedAt: acknowledgedAt || new Date(),
      status: 'Completed',
      acknowledgmentMethod: 'digital',
      ipAddress: ipAddress || req.ip || '127.0.0.1',
      deviceInfo: req.get('User-Agent')
    });

    // Generate acknowledgment document in MongoDB
    const acknowledgmentDocumentId = `doc_ack_${Date.now()}`;
    const acknowledgmentDocument = await GeneratedDocument.create({
      id: acknowledgmentDocumentId,
      documentType: 'Document Acknowledgment',
      employeeId,
      employeeName,
      organizationId,
      organizationName: organizationId,
      createdBy: 'system',
      content: JSON.stringify({
        originalDocumentId: documentId,
        acknowledgmentId: acknowledgmentId,
        acknowledgedAt: acknowledgment.acknowledgedAt
      }),
      status: 'generated',
      fileUrl: `/acknowledgments/${acknowledgmentId}.pdf`,
      fileName: `Acknowledgment_${documentId}_${employeeId}_${Date.now()}.pdf`
    });

    // Link acknowledgment to document
    await DocumentAcknowledgment.findByIdAndUpdate(
      acknowledgment._id,
      { acknowledgmentDocumentId: acknowledgmentDocumentId }
    );

    res.status(201).json({
      message: "Acknowledgment submitted successfully",
      acknowledgment,
      acknowledgmentDocument
    });

  } catch (error) {
    console.error('Error submitting acknowledgment:', error);
    res.status(500).json({ message: error.message });
  }
});

// Get employee acknowledgments
app.get("/api/document-acknowledgments/employee/:employeeId", async (req, res) => {
  try {
    const { employeeId } = req.params;
    
    const acknowledgments = await DocumentAcknowledgment.find({ employeeId })
      .sort({ acknowledgedAt: -1 });

    res.json(acknowledgments);

  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get document acknowledgments
app.get("/api/document-acknowledgments/document/:documentId", async (req, res) => {
  try {
    const { documentId } = req.params;
    
    const acknowledgments = await DocumentAcknowledgment.find({ documentId })
      .sort({ acknowledgedAt: -1 });

    res.json(acknowledgments);

  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Check if employee has acknowledged a document
app.get("/api/document-acknowledgments/check", async (req, res) => {
  try {
    const { documentId, employeeId } = req.query;
    
    const acknowledgment = await DocumentAcknowledgment.findOne({ documentId, employeeId });

    res.json({ 
      acknowledged: !!acknowledgment,
      acknowledgment: acknowledgment || null
    });

  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Digital Document Generation API

// Generate digital document
app.post("/api/company-documents/digital-generate", async (req, res) => {
  try {
    const { 
      title, 
      description, 
      content, 
      category, 
      organizationId, 
      createdBy, 
      assignTo, 
      targetUsers, 
      requiresAcknowledgment 
    } = req.body;
    
    if (!title || !content || !organizationId) {
      return res.status(400).json({ message: "Title, content, and organization ID are required" });
    }

    const documentId = `dig_doc_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // Create digital document in MongoDB
    const digitalDocument = await CompanyDocument.create({
      id: documentId,
      name: title,
      type: 'Digital Document',
      description: description || '',
      content,
      category: category || 'Company Policies',
      organizationId,
      uploadedBy: createdBy || 'admin',
      uploadedByName: 'Admin',
      status: 'active',
      fileUrl: `/digital-documents/${documentId}.pdf`,
      fileName: `${title.replace(/\s+/g, '_')}_${Date.now()}.pdf`,
      fileSize: `${Math.ceil(content.length / 1024)} KB`,
      isPublic: assignTo === 'all',
      assignTo: assignTo || 'all',
      targetUsers: targetUsers || [],
      requiresAcknowledgment: requiresAcknowledgment !== false
    });

    res.status(201).json({
      message: "Digital document generated successfully",
      document: digitalDocument
    });

  } catch (error) {
    console.error('Error generating digital document:', error);
    res.status(500).json({ message: error.message });
  }
});

// Get digital documents for specific user
app.get("/api/company-documents/user/:userId", async (req, res) => {
  try {
    const { userId } = req.params;
    
    const userDocuments = await CompanyDocument.find({
      $or: [
        { assignTo: 'all', isPublic: true },
        { assignTo: 'specific', targetUsers: userId }
      ]
    }).sort({ createdAt: -1 });

    res.json(userDocuments);

  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Document Tracking and Reminder API endpoints

// Get all acknowledgments for tracking
app.get("/api/document-acknowledgments/all", async (req, res) => {
  try {
    const { organizationId } = req.query;
    
    let query = {};
    if (organizationId) query.organizationId = organizationId;

    const acknowledgments = await DocumentAcknowledgment.find(query)
      .sort({ acknowledgedAt: -1 });

    res.json(acknowledgments);

  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get document tracking statistics
app.get("/api/document-acknowledgments/tracking/:documentId", async (req, res) => {
  try {
    const { documentId } = req.params;
    
    const documentAcknowledgments = await DocumentAcknowledgment.find({ documentId });

    // Get all employees from MongoDB
    const employees = await Employee.find({}).populate('userId', 'name email');
    const employeeList = employees.map(emp => ({
      id: emp._id.toString(),
      name: emp.userId?.name || 'Unknown',
      email: emp.userId?.email || 'Unknown',
      department: emp.department,
      position: emp.designation
    }));

    const completedCount = documentAcknowledgments.filter(ack => ack.status === 'Completed').length;
    const pendingCount = employeeList.length - completedCount;

    res.json({
      total: employeeList.length,
      completed: completedCount,
      pending: pendingCount,
      acknowledgments: documentAcknowledgments,
      employees: employeeList
    });

  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Send reminder for document acknowledgment
app.post("/api/document-acknowledgments/remind", async (req, res) => {
  try {
    const { documentId, employeeId, organizationId } = req.body;
    
    if (!documentId || !organizationId) {
      return res.status(400).json({ message: "Document ID and organization ID are required" });
    }

    const reminderId = `rem_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // Create reminder in MongoDB
    const reminder = await Reminder.create({
      id: reminderId,
      documentId,
      employeeId: employeeId || 'all',
      organizationId,
      sentAt: new Date(),
      method: 'email',
      status: 'sent'
    });

    // Increment reminder count for the acknowledgment
    if (employeeId && employeeId !== 'all') {
      await DocumentAcknowledgment.findOneAndUpdate(
        { documentId, employeeId },
        { $inc: { reminderCount: 1 }, lastRemindedAt: new Date() }
      );
    }

    console.log(`Reminder sent for document ${documentId} to ${employeeId || 'all employees'} in organization ${organizationId}`);

    res.json({
      message: "Reminder sent successfully",
      reminder
    });

  } catch (error) {
    console.error('Error sending reminder:', error);
    res.status(500).json({ message: error.message });
  }
});

// Get reminder history
app.get("/api/document-acknowledgments/reminders/:documentId", async (req, res) => {
  try {
    const { documentId } = req.params;
    
    const reminders = await Reminder.find({ documentId })
      .sort({ sentAt: -1 });

    res.json(reminders);

  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Force acknowledgment (admin override)
app.post("/api/document-acknowledgments/force", async (req, res) => {
  try {
    const { documentId, documentName, employeeId, employeeName, organizationId, adminId } = req.body;
    
    if (!documentId || !employeeId || !organizationId) {
      return res.status(400).json({ message: "Document ID, employee ID, and organization ID are required" });
    }

    const acknowledgmentId = `ack_forced_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // Create forced acknowledgment in MongoDB
    const acknowledgment = await DocumentAcknowledgment.create({
      id: acknowledgmentId,
      documentId,
      documentName: documentName || 'Unknown Document',
      employeeId,
      employeeName,
      organizationId,
      acknowledgedAt: new Date(),
      status: 'Forced',
      acknowledgmentMethod: 'forced',
      ipAddress: 'admin_override',
      deviceInfo: 'admin_system',
      forcedBy: adminId
    });

    // Generate acknowledgment document in MongoDB
    const acknowledgmentDocumentId = `doc_ack_forced_${Date.now()}`;
    const acknowledgmentDocument = await GeneratedDocument.create({
      id: acknowledgmentDocumentId,
      documentType: 'Forced Document Acknowledgment',
      employeeId,
      employeeName,
      organizationId,
      organizationName: organizationId,
      createdBy: adminId || 'admin',
      content: JSON.stringify({
        originalDocumentId: documentId,
        acknowledgmentId: acknowledgmentId,
        acknowledgedAt: acknowledgment.acknowledgedAt,
        forcedBy: adminId
      }),
      status: 'generated',
      fileUrl: `/acknowledgments/${acknowledgmentId}.pdf`,
      fileName: `Forced_Acknowledgment_${documentId}_${employeeId}_${Date.now()}.pdf`
    });

    // Link acknowledgment to document
    await DocumentAcknowledgment.findByIdAndUpdate(
      acknowledgment._id,
      { acknowledgmentDocumentId: acknowledgmentDocumentId }
    );

    res.status(201).json({
      message: "Forced acknowledgment created successfully",
      acknowledgment,
      acknowledgmentDocument
    });

  } catch (error) {
    console.error('Error creating forced acknowledgment:', error);
    res.status(500).json({ message: error.message });
  }
});

// Super Admin User Information API endpoints

// Get complete user information including documents and onboarding data
app.get("/api/super-admin/user/:userId", async (req, res) => {
  try {
    const { userId } = req.params;
    
    // Find user in MongoDB
    const user = await User.findById(userId).select('-password');
    
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Get user documents from MongoDB
    const userDocuments = await Document.find({ userId });

    // Get onboarding data from MongoDB
    const onboardingData = await OnboardingSubmission.findOne({ employeeId: userId });

    // Get user acknowledgments from MongoDB
    const acknowledgments = await DocumentAcknowledgment.find({ employeeId: userId });

    res.json({
      user,
      documents: userDocuments,
      onboarding: onboardingData,
      acknowledgments,
      totalDocuments: userDocuments.length,
      totalAcknowledgments: acknowledgments.length
    });

  } catch (error) {
    console.error('Error fetching user information:', error);
    res.status(500).json({ message: error.message });
  }
});

// Get user documents with detailed information
app.get("/api/super-admin/user/:userId/documents", async (req, res) => {
  try {
    const { userId } = req.params;
    
    // Get all documents related to the user from MongoDB
    const userDocuments = await Document.find({ userId })
      .sort({ createdAt: -1 });

    // Categorize documents
    const categorizedDocs = {
      general: userDocuments.filter(doc => doc.type === 'general'),
      experience_letter: userDocuments.filter(doc => doc.type === 'experience_letter'),
      offer_letter: userDocuments.filter(doc => doc.type === 'offer_letter'),
      relieving_letter: userDocuments.filter(doc => doc.type === 'relieving_letter'),
      appraisal_letter: userDocuments.filter(doc => doc.type === 'appraisal_letter'),
      salary_slips: userDocuments.filter(doc => doc.type === 'salary_slips'),
      bank_statement: userDocuments.filter(doc => doc.type === 'bank_statement'),
      otherDocuments: userDocuments.filter(doc => !['general', 'experience_letter', 'offer_letter', 'relieving_letter', 'appraisal_letter', 'salary_slips', 'bank_statement'].includes(doc.type))
    };

    res.json({
      documents: userDocuments,
      categorized: categorizedDocs,
      total: userDocuments.length
    });

  } catch (error) {
    console.error('Error fetching user documents:', error);
    res.status(500).json({ message: error.message });
  }
});

// Get user onboarding data
app.get("/api/super-admin/user/:userId/onboarding", async (req, res) => {
  try {
    const { userId } = req.params;
    
    // Get onboarding submission from MongoDB
    const onboardingData = await OnboardingSubmission.findOne({ employeeId: userId });

    if (!onboardingData) {
      return res.status(404).json({ message: "Onboarding data not found" });
    }

    res.json({
      onboarding: onboardingData,
      submittedAt: onboardingData.submittedAt,
      status: onboardingData.status,
      documents: onboardingData.documents || []
    });

  } catch (error) {
    console.error('Error fetching onboarding data:', error);
    res.status(500).json({ message: error.message });
  }
});

// Get user acknowledgment history
app.get("/api/super-admin/user/:userId/acknowledgments", async (req, res) => {
  try {
    const { userId } = req.params;
    
    // Get acknowledgments from MongoDB
    const acknowledgments = await DocumentAcknowledgment.find({ employeeId: userId })
      .sort({ acknowledgedAt: -1 });

    res.json({
      acknowledgments,
      total: acknowledgments.length
    });

  } catch (error) {
    console.error('Error fetching acknowledgment history:', error);
    res.status(500).json({ message: error.message });
  }
});

// Holiday Calendar API endpoints

// Get all holidays (for frontend compatibility)
app.get("/api/holidays", async (req, res) => {
  try {
    const { organizationId } = req.query;
    
    let query = {};
    if (organizationId) query.organizationId = organizationId;

    const holidays = await Holiday.find(query)
      .sort({ date: 1 });

    res.json(holidays);
  } catch (error) {
    console.error('Error fetching holidays:', error);
    res.status(500).json({ message: error.message });
  }
});

// Get all holidays for an organization
app.get("/api/holidays/organization/:organizationId", async (req, res) => {
  try {
    const { organizationId } = req.params;
    
    const holidays = await Holiday.find({ organizationId })
      .sort({ date: 1 });

    res.json(holidays);
  } catch (error) {
    console.error('Error fetching holidays:', error);
    res.status(500).json({ message: error.message });
  }
});

// Create new holiday
app.post("/api/holidays", async (req, res) => {
  try {
    const { name, date, type, description, isRecurring, organizationId, createdBy } = req.body;
    
    if (!name || !date || !type || !organizationId) {
      return res.status(400).json({ message: "Name, date, type, and organization ID are required" });
    }

    const holiday = await Holiday.create({
      name,
      date,
      type,
      description: description || '',
      isRecurring: isRecurring || false,
      organizationId,
      createdBy
    });

    res.status(201).json({
      message: "Holiday created successfully",
      holiday
    });
  } catch (error) {
    console.error('Error creating holiday:', error);
    res.status(500).json({ message: error.message });
  }
});

// Update holiday
app.put("/api/holidays/:holidayId", async (req, res) => {
  try {
    const { holidayId } = req.params;
    const { name, date, type, description, isRecurring } = req.body;

    const updatedHoliday = await Holiday.findByIdAndUpdate(
      holidayId,
      { 
        name: name, 
        date: date, 
        type: type, 
        description: description, 
        isRecurring: isRecurring 
      },
      { new: true, runValidators: true }
    );

    if (!updatedHoliday) {
      return res.status(404).json({ message: "Holiday not found" });
    }

    res.json({
      message: "Holiday updated successfully",
      holiday: updatedHoliday
    });
  } catch (error) {
    console.error('Error updating holiday:', error);
    res.status(500).json({ message: error.message });
  }
});

// Delete holiday
app.delete("/api/holidays/:holidayId", async (req, res) => {
  try {
    const { holidayId } = req.params;

    const deletedHoliday = await Holiday.findByIdAndDelete(holidayId);

    if (!deletedHoliday) {
      return res.status(404).json({ message: "Holiday not found" });
    }

    res.json({ message: "Holiday deleted successfully" });
  } catch (error) {
    console.error('Error deleting holiday:', error);
    res.status(500).json({ message: error.message });
  }
});

// Get holiday calendars for an organization
app.get("/api/holiday-calendars/organization/:organizationId", async (req, res) => {
  try {
    const { organizationId } = req.params;
    
    const calendars = await HolidayCalendar.find({ organizationId })
      .sort({ createdAt: -1 });

    res.json(calendars);
  } catch (error) {
    console.error('Error fetching holiday calendars:', error);
    res.status(500).json({ message: error.message });
  }
});

// Create holiday calendar
app.post("/api/holiday-calendars", async (req, res) => {
  try {
    const { name, year, organizationId, holidays, isPublished, createdBy } = req.body;
    
    if (!name || !year || !organizationId) {
      return res.status(400).json({ message: "Name, year, and organization ID are required" });
    }

    const calendar = await HolidayCalendar.create({
      name,
      year,
      organizationId,
      holidays: holidays || [],
      isPublished: isPublished || false,
      publishedAt: isPublished ? new Date() : null,
      publishedBy: isPublished ? createdBy : null,
      createdBy
    });

    res.status(201).json({
      message: "Holiday calendar created successfully",
      calendar
    });
  } catch (error) {
    console.error('Error creating holiday calendar:', error);
    res.status(500).json({ message: error.message });
  }
});

// Publish holiday calendar
app.post("/api/holiday-calendars/:calendarId/publish", async (req, res) => {
  try {
    const { calendarId } = req.params;
    const { publishedBy } = req.body;

    const updatedCalendar = await HolidayCalendar.findByIdAndUpdate(
      calendarId,
      { 
        isPublished: true, 
        publishedAt: new Date(), 
        publishedBy 
      },
      { new: true }
    );

    if (!updatedCalendar) {
      return res.status(404).json({ message: "Calendar not found" });
    }

    res.json({
      message: "Holiday calendar published successfully",
      calendar: updatedCalendar
    });
  } catch (error) {
    console.error('Error publishing holiday calendar:', error);
    res.status(500).json({ message: error.message });
  }
});

// Download holiday calendar
app.get("/api/holiday-calendars/:calendarId/download", async (req, res) => {
  try {
    const { calendarId } = req.params;

    const calendar = await HolidayCalendar.findById(calendarId);

    if (!calendar) {
      return res.status(404).json({ message: "Calendar not found" });
    }

    // In production, you would generate a PDF or Excel file
    res.json({
      message: "Calendar download link generated",
      downloadUrl: `/downloads/calendars/${calendarId}.pdf`,
      calendar
    });
  } catch (error) {
    console.error('Error downloading holiday calendar:', error);
    res.status(500).json({ message: error.message });
  }
});

// Helper function to format date
function formatDate(dateString) {
  return new Date(dateString).toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
}

// Advance and Loan Management API endpoints
app.get("/api/advances-loans", async (req, res) => {
  try {
    const advancesLoans = await AdvanceLoan.find()
      .populate('employeeId')
      .populate('userId', '-password')
      .sort({ createdAt: -1 });
    res.json(advancesLoans);
  } catch (error) {
    console.error('Error fetching advances and loans:', error);
    res.status(500).json({ message: "Internal server error" });
  }
});

app.post("/api/advances-loans", async (req, res) => {
  try {
    const {
      employeeId,
      employeeName,
      type,
      amount,
      reason,
      installmentAmount,
      totalInstallments
    } = req.body;

    // Validate required fields
    if (!employeeId || !employeeName || !type || !amount || !reason) {
      return res.status(400).json({ message: "Please fill in all required fields" });
    }

    if (!['advance', 'loan'].includes(type)) {
      return res.status(400).json({ message: "Invalid type. Must be 'advance' or 'loan'" });
    }

    const newAdvanceLoan = await AdvanceLoan.create({
      employeeId,
      userId: employeeId, // Will need to be fetched from employee record
      type,
      amount: parseFloat(amount),
      reason,
      installmentAmount: installmentAmount ? parseFloat(installmentAmount) : 0,
      numberOfInstallments: totalInstallments ? parseInt(totalInstallments) : 1,
      status: 'Pending'
    });

    res.status(201).json({
      message: "Advance/loan request submitted successfully",
      advanceLoan: newAdvanceLoan
    });
  } catch (error) {
    console.error('Error creating advance/loan:', error);
    res.status(500).json({ message: "Internal server error" });
  }
});

app.put("/api/advances-loans/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { status, approvedBy } = req.body;

    if (!['pending', 'approved', 'rejected'].includes(status)) {
      return res.status(400).json({ message: "Invalid status" });
    }

    const advanceLoan = await AdvanceLoan.findByIdAndUpdate(
      id,
      { 
        status,
        approvedBy,
        approvedAt: status === 'approved' ? new Date() : null,
        rejectedAt: status === 'rejected' ? new Date() : null
      },
      { new: true }
    );

    if (!advanceLoan) {
      return res.status(404).json({ message: "Advance/loan not found" });
    }

    res.json({
      message: "Advance/loan updated successfully",
      advanceLoan
    });
  } catch (error) {
    console.error('Error updating advance/loan:', error);
    res.status(500).json({ message: "Internal server error" });
  }
});

app.delete("/api/advances-loans/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const deletedLoan = await AdvanceLoan.findByIdAndDelete(id);
    if (!deletedLoan) {
      return res.status(404).json({ message: "Advance/loan not found" });
    }
    res.json({ message: "Advance/loan deleted successfully" });
  } catch (error) {
    console.error('Error deleting advance/loan:', error);
    res.status(500).json({ message: "Internal server error" });
  }
});

app.get("/api/advances-loans/employee/:employeeId", async (req, res) => {
  try {
    const { employeeId } = req.params;
    const employeeAdvancesLoans = await AdvanceLoan.find({ employeeId })
      .sort({ createdAt: -1 });
    res.json(employeeAdvancesLoans);
  } catch (error) {
    console.error('Error fetching employee advance loans:', error);
    res.status(500).json({ message: "Internal server error" });
  }
});

app.get("/api/advances-loans/organization/:organizationId", async (req, res) => {
  try {
    const { organizationId } = req.params;
    const advancesLoans = await AdvanceLoan.find()
      .populate('employeeId')
      .sort({ createdAt: -1 });
    res.json(advancesLoans);
  } catch (error) {
    console.error('Error fetching organization advances and loans:', error);
    res.status(500).json({ message: "Internal server error" });
  }
});

app.get("/api/advances-loans/statistics", async (req, res) => {
  try {
    const advancesLoans = await AdvanceLoan.find();
    
    const totalAdvances = advancesLoans
      .filter(al => al.type === 'advance' && al.status === 'approved')
      .reduce((sum, al) => sum + al.amount, 0);
    
    const totalLoans = advancesLoans
      .filter(al => al.type === 'loan' && al.status === 'approved')
      .reduce((sum, al) => sum + al.amount, 0);
    
    const pendingCount = advancesLoans.filter(al => al.status === 'Pending').length;
    
    const monthlyDeductions = advancesLoans
      .filter(al => al.status === 'approved' && al.installmentAmount)
      .reduce((sum, al) => sum + al.installmentAmount, 0);

    res.json({
      totalAdvances,
      totalLoans,
      pendingCount,
      monthlyDeductions
    });
  } catch (error) {
    console.error('Error fetching advances and loans statistics:', error);
    res.status(500).json({ message: "Internal server error" });
  }
});

// Expense Management API endpoints
app.get("/api/expenses", async (req, res) => {
  try {
    const expenses = await Expense.find()
      .populate('userId', 'name email')
      .populate('employeeId', 'designation department')
      .sort({ createdAt: -1 });
    res.json({ success: true, data: expenses });
  } catch (error) {
    console.error('Error fetching expenses:', error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
});

app.get("/api/expenses/user/:userId", async (req, res) => {
  try {
    const { userId } = req.params;
    const userExpenses = await Expense.find({ userId })
      .populate('userId', 'name email')
      .populate('employeeId', 'designation department')
      .sort({ createdAt: -1 });
    res.json({ success: true, data: userExpenses });
  } catch (error) {
    console.error('Error fetching user expenses:', error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
});

app.post("/api/expenses", async (req, res) => {
  try {
    const expenseData = {
      userId: req.body.userId || req.body.employeeId,
      employeeId: req.body.employeeId,
      employeeName: req.body.employeeName || 'Unknown Employee',
      category: req.body.category,
      amount: parseFloat(req.body.amount),
      description: req.body.description,
      date: req.body.date || new Date(),
      receipt: req.body.receiptUrl || req.body.receipt || null,
      status: 'pending',
      orgId: req.body.orgId || 'system'
    };

    const expense = await Expense.create(expenseData);
    const populatedExpense = await Expense.findById(expense._id)
      .populate('userId', 'name email')
      .populate('employeeId', 'designation department');

    // Emit Socket.IO event for real-time updates
    io.emit('expense_created', populatedExpense);

    res.status(201).json({
      success: true,
      message: "Expense created successfully",
      data: populatedExpense
    });
  } catch (error) {
    console.error('Error creating expense:', error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
});

app.put("/api/expenses/:expenseId", async (req, res) => {
  try {
    const { expenseId } = req.params;
    const updateData = req.body;

    const expense = await Expense.findByIdAndUpdate(
      expenseId,
      { ...updateData, updatedAt: new Date() },
      { new: true }
    ).populate('userId', 'name email').populate('employeeId', 'designation department');
    
    if (!expense) {
      return res.status(404).json({ success: false, message: "Expense not found" });
    }

    io.emit('expense_updated', expense);

    res.json({
      success: true,
      message: "Expense updated successfully",
      data: expense
    });
  } catch (error) {
    console.error('Error updating expense:', error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
});

app.delete("/api/expenses/:expenseId", async (req, res) => {
  try {
    const { expenseId } = req.params;

    const expense = await Expense.findByIdAndDelete(expenseId);
    
    if (!expense) {
      return res.status(404).json({ success: false, message: "Expense not found" });
    }

    io.emit('expense_deleted', { id: expenseId });

    res.json({
      success: true,
      message: "Expense deleted successfully"
    });
  } catch (error) {
    console.error('Error deleting expense:', error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
});

app.patch("/api/expenses/:expenseId/approve", async (req, res) => {
  try {
    const { expenseId } = req.params;

    const expense = await Expense.findByIdAndUpdate(
      expenseId,
      {
        status: 'approved',
        approvedDate: new Date(),
        approvedBy: req.body.approvedBy
      },
      { new: true }
    ).populate('userId', 'name email').populate('employeeId', 'designation department');
    
    if (!expense) {
      return res.status(404).json({ success: false, message: "Expense not found" });
    }

    // Emit Socket.IO event for real-time updates
    io.emit('expense_updated', expense);

    res.json({
      success: true,
      message: "Expense approved successfully",
      data: expense
    });
  } catch (error) {
    console.error('Error approving expense:', error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
});

app.patch("/api/expenses/:expenseId/reject", async (req, res) => {
  try {
    const { expenseId } = req.params;

    const expense = await Expense.findByIdAndUpdate(
      expenseId,
      {
        status: 'rejected',
        rejectedDate: new Date(),
        rejectedBy: req.body.rejectedBy,
        rejectionReason: req.body.rejectionReason || 'Rejected by admin'
      },
      { new: true }
    ).populate('userId', 'name email').populate('employeeId', 'designation department');
    
    if (!expense) {
      return res.status(404).json({ success: false, message: "Expense not found" });
    }

    // Emit Socket.IO event for real-time updates
    io.emit('expense_updated', expense);

    res.json({
      success: true,
      message: "Expense rejected successfully",
      data: expense
    });
  } catch (error) {
    console.error('Error rejecting expense:', error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
});

app.post("/api/expenses/bulk-approve", async (req, res) => {
  try {
    const { expenseIds, approvedBy } = req.body;

    const result = await Expense.updateMany(
      { _id: { $in: expenseIds } },
      {
        status: 'approved',
        approvedDate: new Date(),
        approvedBy: approvedBy
      }
    );

    const approvedExpenses = await Expense.find({ _id: { $in: expenseIds } })
      .populate('userId', 'name email')
      .populate('employeeId', 'designation department');

    // Emit Socket.IO event for real-time updates
    io.emit('expense_updated', approvedExpenses);

    res.json({
      success: true,
      message: "Expenses approved successfully",
      data: approvedExpenses
    });
  } catch (error) {
    console.error('Error bulk approving expenses:', error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
});

app.post("/api/expenses/bulk-reject", async (req, res) => {
  try {
    const { expenseIds, rejectedBy, rejectionReason } = req.body;

    const result = await Expense.updateMany(
      { _id: { $in: expenseIds } },
      {
        status: 'rejected',
        rejectedDate: new Date(),
        rejectedBy: rejectedBy,
        rejectionReason: rejectionReason || 'Bulk rejected'
      }
    );

    const rejectedExpenses = await Expense.find({ _id: { $in: expenseIds } })
      .populate('userId', 'name email')
      .populate('employeeId', 'designation department');

    // Emit Socket.IO event for real-time updates
    io.emit('expense_updated', rejectedExpenses);

    res.json({
      success: true,
      message: "Expenses rejected successfully",
      data: rejectedExpenses
    });
  } catch (error) {
    console.error('Error bulk rejecting expenses:', error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
});

// Leave Request Management API endpoints
// Leave Request Management API endpoints
app.get("/api/leave-requests", async (req, res) => {
  try {
    const leaveRequests = await LeaveRequest.find()
      .populate('userId', 'name email')
      .populate('employeeId', 'designation department')
      .sort({ createdAt: -1 });
    res.json({ success: true, data: leaveRequests });
  } catch (error) {
    console.error('Error fetching leave requests:', error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
});

app.get("/api/leave-requests/user/:userId", async (req, res) => {
  try {
    const { userId } = req.params;
    const userLeaveRequests = await LeaveRequest.find({ userId })
      .populate('userId', 'name email')
      .populate('employeeId', 'designation department')
      .sort({ createdAt: -1 });
    res.json({ success: true, data: userLeaveRequests });
  } catch (error) {
    console.error('Error fetching user leave requests:', error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
});

app.post("/api/leave-requests", async (req, res) => {
  try {
    const leaveData = {
      userId: req.body.userId || req.body.employeeId,
      employeeId: req.body.employeeId,
      employeeName: req.body.employeeName || 'Unknown Employee',
      startDate: req.body.startDate,
      endDate: req.body.endDate,
      reason: req.body.reason,
      type: req.body.type || 'Vacation',
      status: 'pending',
      orgId: req.body.orgId || 'system'
    };

    const leaveRequest = await LeaveRequest.create(leaveData);
    const populatedLeave = await LeaveRequest.findById(leaveRequest._id)
      .populate('userId', 'name email')
      .populate('employeeId', 'designation department');

    // Emit Socket.IO event for real-time updates
    io.emit('leave_created', populatedLeave);

    res.status(201).json({
      success: true,
      message: "Leave request created successfully",
      data: populatedLeave
    });
  } catch (error) {
    console.error('Error creating leave request:', error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
});

app.patch("/api/leave-requests/:requestId/approve", async (req, res) => {
  try {
    const { requestId } = req.params;

    const leaveRequest = await LeaveRequest.findByIdAndUpdate(
      requestId,
      {
        status: 'approved',
        approvedDate: new Date(),
        approvedBy: req.body.approvedBy
      },
      { new: true }
    ).populate('userId', 'name email').populate('employeeId', 'designation department');
    
    if (!leaveRequest) {
      return res.status(404).json({ success: false, message: "Leave request not found" });
    }

    // Emit Socket.IO event for real-time updates
    io.emit('leave_updated', leaveRequest);

    res.json({
      success: true,
      message: "Leave request approved successfully",
      data: leaveRequest
    });
  } catch (error) {
    console.error('Error approving leave request:', error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
});

app.patch("/api/leave-requests/:requestId/reject", async (req, res) => {
  try {
    const { requestId } = req.params;

    const leaveRequest = await LeaveRequest.findByIdAndUpdate(
      requestId,
      {
        status: 'rejected',
        rejectedDate: new Date(),
        rejectedBy: req.body.rejectedBy,
        rejectionReason: req.body.rejectionReason || 'Rejected by admin'
      },
      { new: true }
    ).populate('userId', 'name email').populate('employeeId', 'designation department');
    
    if (!leaveRequest) {
      return res.status(404).json({ success: false, message: "Leave request not found" });
    }

    // Emit Socket.IO event for real-time updates
    io.emit('leave_updated', leaveRequest);

    res.json({
      success: true,
      message: "Leave request rejected successfully",
      data: leaveRequest
    });
  } catch (error) {
    console.error('Error rejecting leave request:', error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
});

app.post("/api/leave-requests/bulk-approve", async (req, res) => {
  try {
    const { requestIds, approvedBy } = req.body;

    const result = await LeaveRequest.updateMany(
      { _id: { $in: requestIds } },
      {
        status: 'approved',
        approvedDate: new Date(),
        approvedBy: approvedBy
      }
    );

    const approvedRequests = await LeaveRequest.find({ _id: { $in: requestIds } })
      .populate('userId', 'name email')
      .populate('employeeId', 'designation department');

    // Emit Socket.IO event for real-time updates
    io.emit('leave_updated', approvedRequests);

    res.json({
      success: true,
      message: "Leave requests approved successfully",
      data: approvedRequests
    });
  } catch (error) {
    console.error('Error bulk approving leave requests:', error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
});

app.post("/api/leave-requests/bulk-reject", async (req, res) => {
  try {
    const { requestIds, rejectedBy, rejectionReason } = req.body;

    const result = await LeaveRequest.updateMany(
      { _id: { $in: requestIds } },
      {
        status: 'rejected',
        rejectedDate: new Date(),
        rejectedBy: rejectedBy,
        rejectionReason: rejectionReason || 'Bulk rejected'
      }
    );

    const rejectedRequests = await LeaveRequest.find({ _id: { $in: requestIds } })
      .populate('userId', 'name email')
      .populate('employeeId', 'designation department');

    // Emit Socket.IO event for real-time updates
    io.emit('leave_updated', rejectedRequests);

    res.json({
      success: true,
      message: "Leave requests rejected successfully",
      data: rejectedRequests
    });
  } catch (error) {
    console.error('Error bulk rejecting leave requests:', error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
});

// User Management API endpoints - Using MongoDB only
app.post("/api/users", async (req, res) => {
  try {
    const { name, email, password, role, organization, orgId } = req.body;
    
    // Create user in MongoDB
    const user = await User.create({
      name,
      email,
      password,
      role: role || 'employee',
      organization,
      orgId: orgId || 'system',
      isActive: true
    });

    const userData = {
      id: user._id.toString(),
      name: user.name,
      email: user.email,
      role: user.role,
      organization: user.organization,
      orgId: user.orgId,
      isActive: user.isActive,
      createdAt: user.createdAt
    };

    // Emit Socket.IO event for real-time updates
    io.emit('employee_created', userData);

    res.status(201).json({
      success: true,
      message: "User created successfully",
      data: userData
    });
  } catch (error) {
    console.error('Error creating user:', error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
});

app.get("/api/users/:userId", async (req, res) => {
  try {
    const { userId } = req.params;
    const user = await User.findById(userId).select('-password');
    
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    res.json({ success: true, data: user });
  } catch (error) {
    console.error('Error fetching user:', error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
});

app.put("/api/users/:userId", async (req, res) => {
  try {
    const { userId } = req.params;
    const updateData = req.body;

    // Remove password from update if present (should use separate endpoint)
    delete updateData.password;
    delete updateData._id;

    const updatedUser = await User.findByIdAndUpdate(
      userId,
      { ...updateData, updatedAt: new Date() },
      { new: true, runValidators: true }
    ).select('-password');
    
    if (!updatedUser) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    // Emit Socket.IO event for real-time updates
    io.emit('employee_updated', updatedUser);

    res.json({
      success: true,
      message: "User updated successfully",
      data: updatedUser
    });
  } catch (error) {
    console.error('Error updating user:', error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
});

app.delete("/api/users/:userId", async (req, res) => {
  try {
    const { userId } = req.params;

    const deletedUser = await User.findByIdAndDelete(userId);
    
    if (!deletedUser) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    // Also delete associated employee record if exists
    await Employee.deleteOne({ userId: userId });

    // Emit Socket.IO event for real-time updates
    io.emit('employee_deleted', { userId, deletedUser });

    res.json({
      success: true,
      message: "User deleted successfully"
    });
  } catch (error) {
    console.error('Error deleting user:', error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
});

// Currency Preferences API endpoints - Using MongoDB only
app.get("/api/user/currency/:userId", async (req, res) => {
  try {
    const { userId } = req.params;
    
    const userPreference = await CurrencyPreference.findOne({ userId });
    
    if (userPreference) {
      res.json({ currencyCode: userPreference.currencyCode });
    } else {
      // Return default currency if no preference set
      res.json({ currencyCode: 'USD' });
    }
  } catch (error) {
    console.error('Error fetching user currency preference:', error);
    res.status(500).json({ message: "Internal server error" });
  }
});

app.put("/api/user/currency/:userId", async (req, res) => {
  try {
    const { userId } = req.params;
    const { currencyCode } = req.body;

    // Validate currency code
    const validCurrencies = [
      'USD', 'EUR', 'GBP', 'JPY', 'CNY', 'INR', 'CAD', 'AUD', 'CHF', 'SGD',
      'HKD', 'SEK', 'NOK', 'DKK', 'PLN', 'CZK', 'HUF', 'RUB', 'BRL', 'MXN',
      'ZAR', 'KRW', 'IDR', 'THB', 'MYR', 'PHP', 'VND', 'SAR', 'AED', 'EGP',
      'NGN', 'KES', 'GHS', 'TZS', 'UGX', 'RWF', 'BWP', 'ZMW', 'NAD', 'MZN',
      'AOA', 'XAF', 'XOF', 'XPF', 'SCR', 'MUR', 'LKR', 'PKR', 'BDT', 'NPR',
      'MMK', 'LAK', 'KHR', 'VUV', 'WST', 'TOP', 'FJD', 'PGK', 'NZD'
    ];

    if (!validCurrencies.includes(currencyCode)) {
      return res.status(400).json({ message: "Invalid currency code" });
    }

    // Save or update user preference in MongoDB
    await CurrencyPreference.findOneAndUpdate(
      { userId },
      { userId, currencyCode },
      { upsert: true, new: true }
    );

    res.json({
      message: "Currency preference updated successfully",
      currencyCode
    });
  } catch (error) {
    console.error('Error updating user currency preference:', error);
    res.status(500).json({ message: "Internal server error" });
  }
});

app.get("/api/currencies", async (req, res) => {
  try {
    const currencies = [
      { code: 'USD', name: 'US Dollar', symbol: '$', exchangeRate: 1 },
      { code: 'EUR', name: 'Euro', symbol: 'â¬', exchangeRate: 0.85 },
      { code: 'GBP', name: 'British Pound', symbol: 'Â£', exchangeRate: 0.73 },
      { code: 'JPY', name: 'Japanese Yen', symbol: 'Â¥', exchangeRate: 110.5 },
      { code: 'CNY', name: 'Chinese Yuan', symbol: 'Â¥', exchangeRate: 6.45 },
      { code: 'INR', name: 'Indian Rupee', symbol: 'â¨', exchangeRate: 74.5 },
      { code: 'CAD', name: 'Canadian Dollar', symbol: 'C$', exchangeRate: 1.25 },
      { code: 'AUD', name: 'Australian Dollar', symbol: 'A$', exchangeRate: 1.35 },
      { code: 'CHF', name: 'Swiss Franc', symbol: 'Fr', exchangeRate: 0.92 },
      { code: 'SGD', name: 'Singapore Dollar', symbol: 'S$', exchangeRate: 1.35 },
      { code: 'HKD', name: 'Hong Kong Dollar', symbol: 'HK$', exchangeRate: 7.8 },
      { code: 'SEK', name: 'Swedish Krona', symbol: 'kr', exchangeRate: 8.6 },
      { code: 'NOK', name: 'Norwegian Krone', symbol: 'kr', exchangeRate: 8.5 },
      { code: 'DKK', name: 'Danish Krone', symbol: 'kr', exchangeRate: 6.3 },
      { code: 'PLN', name: 'Polish Zloty', symbol: 'zÅ', exchangeRate: 3.9 },
      { code: 'CZK', name: 'Czech Koruna', symbol: 'KÄ', exchangeRate: 21.5 },
      { code: 'HUF', name: 'Hungarian Forint', symbol: 'Ft', exchangeRate: 310 },
      { code: 'RUB', name: 'Russian Ruble', symbol: 'â½', exchangeRate: 73 },
      { code: 'BRL', name: 'Brazilian Real', symbol: 'R$', exchangeRate: 5.2 },
      { code: 'MXN', name: 'Mexican Peso', symbol: '$', exchangeRate: 20 },
      { code: 'ZAR', name: 'South African Rand', symbol: 'R', exchangeRate: 15 },
      { code: 'KRW', name: 'South Korean Won', symbol: 'â©', exchangeRate: 1180 },
      { code: 'IDR', name: 'Indonesian Rupiah', symbol: 'Rp', exchangeRate: 14300 },
      { code: 'THB', name: 'Thai Baht', symbol: 'à¸¿', exchangeRate: 33 },
      { code: 'MYR', name: 'Malaysian Ringgit', symbol: 'RM', exchangeRate: 4.2 },
      { code: 'PHP', name: 'Philippine Peso', symbol: 'â±', exchangeRate: 50 },
      { code: 'VND', name: 'Vietnamese Dong', symbol: 'â«', exchangeRate: 23000 },
      { code: 'SAR', name: 'Saudi Riyal', symbol: 'ï·¼', exchangeRate: 3.75 },
      { code: 'AED', name: 'UAE Dirham', symbol: 'Ø¯.Ø¥', exchangeRate: 3.67 },
      { code: 'EGP', name: 'Egyptian Pound', symbol: 'EÂ£', exchangeRate: 15.7 },
      { code: 'NGN', name: 'Nigerian Naira', symbol: 'â¦', exchangeRate: 410 },
      { code: 'KES', name: 'Kenyan Shilling', symbol: 'KSh', exchangeRate: 110 },
      { code: 'GHS', name: 'Ghanaian Cedi', symbol: 'GHâµ', exchangeRate: 6.1 },
      { code: 'TZS', name: 'Tanzanian Shilling', symbol: 'TSh', exchangeRate: 2320 },
      { code: 'UGX', name: 'Ugandan Shilling', symbol: 'USh', exchangeRate: 3600 },
      { code: 'RWF', name: 'Rwandan Franc', symbol: 'RWF', exchangeRate: 1000 },
      { code: 'BWP', name: 'Botswana Pula', symbol: 'P', exchangeRate: 11.2 },
      { code: 'ZMW', name: 'Zambian Kwacha', symbol: 'ZK', exchangeRate: 16.5 },
      { code: 'NAD', name: 'Namibian Dollar', symbol: 'N$', exchangeRate: 15.2 },
      { code: 'MZN', name: 'Mozambican Metical', symbol: 'MT', exchangeRate: 63 },
      { code: 'AOA', name: 'Angolan Kwanza', symbol: 'Kz', exchangeRate: 650 },
      { code: 'XAF', name: 'CFA Franc BEAC', symbol: 'FCFA', exchangeRate: 550 },
      { code: 'XOF', name: 'CFA Franc BCEAO', symbol: 'CFA', exchangeRate: 550 },
      { code: 'XPF', name: 'CFP Franc', symbol: 'Fr', exchangeRate: 100 },
      { code: 'SCR', name: 'Seychellois Rupee', symbol: 'â¨', exchangeRate: 13.5 },
      { code: 'MUR', name: 'Mauritian Rupee', symbol: 'â¨', exchangeRate: 43 },
      { code: 'LKR', name: 'Sri Lankan Rupee', symbol: 'â¨', exchangeRate: 200 },
      { code: 'PKR', name: 'Pakistani Rupee', symbol: 'â¨', exchangeRate: 160 },
      { code: 'BDT', name: 'Bangladeshi Taka', symbol: 'à§³', exchangeRate: 85 },
      { code: 'NPR', name: 'Nepalese Rupee', symbol: 'â¨', exchangeRate: 120 },
      { code: 'MMK', name: 'Myanmar Kyat', symbol: 'K', exchangeRate: 1650 },
      { code: 'LAK', name: 'Lao Kip', symbol: 'â­', exchangeRate: 10000 },
      { code: 'KHR', name: 'Cambodian Riel', symbol: 'áÛ', exchangeRate: 4100 },
      { code: 'VUV', name: 'Vanuatu Vatu', symbol: 'VT', exchangeRate: 100 },
      { code: 'WST', name: 'Samoan Tala', symbol: 'SAT', exchangeRate: 2.5 },
      { code: 'TOP', name: 'Tongan PaÊ»anga', symbol: 'T$', exchangeRate: 2.3 },
      { code: 'FJD', name: 'Fijian Dollar', symbol: 'F$', exchangeRate: 2.1 },
      { code: 'PGK', name: 'Papua New Guinea Kina', symbol: 'K', exchangeRate: 3.5 },
      { code: 'NZD', name: 'New Zealand Dollar', symbol: 'NZ$', exchangeRate: 1.45 }
    ];

    res.json(currencies);
  } catch (error) {
    console.error('Error fetching currencies:', error);
    res.status(500).json({ message: "Internal server error" });
  }
});

// Employee Management APIs

// Middleware to verify token and attach user info
const verifyToken = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return res.status(401).json({ success: false, message: "No token provided" });
    }

    const token = authHeader.replace('Bearer ', '');
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'supersecretkey');
    req.userId = decoded.userId;
    req.userRole = decoded.role;
    next();
  } catch (error) {
    return res.status(401).json({ success: false, message: "Invalid token" });
  }
};

// Get all employees
app.get("/api/employees", verifyToken, async (req, res) => {
  try {
    const employees = await Employee.find().populate('userId', '-password');
    res.json({ success: true, data: employees });
  } catch (error) {
    console.error('Error fetching employees:', error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
});

// Get employee by ID
app.get("/api/employees/:id", verifyToken, async (req, res) => {
  try {
    const employee = await Employee.findById(req.params.id).populate('userId', '-password');
    if (!employee) {
      return res.status(404).json({ success: false, message: "Employee not found" });
    }
    res.json({ success: true, data: employee });
  } catch (error) {
    console.error('Error fetching employee:', error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
});

// Get employee by user ID
app.get("/api/employees/user/:userId", verifyToken, async (req, res) => {
  try {
    const employee = await Employee.findOne({ userId: req.params.userId }).populate('userId', '-password');
    if (!employee) {
      return res.status(404).json({ success: false, message: "Employee not found" });
    }
    res.json({ success: true, data: employee });
  } catch (error) {
    console.error('Error fetching employee:', error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
});

// Create new employee (Admin only) - creates User + Employee records
app.post("/api/employees", verifyToken, async (req, res) => {
  try {
    // Only admin or super_admin can create employees
    if (!['admin', 'super_admin'].includes(req.userRole)) {
      return res.status(403).json({ success: false, message: "Access denied" });
    }

    const { name, email, password, department, designation, baseSalary, phone, joiningDate, hra, bonus, allowances } = req.body;

    // Validate required fields
    if (!name || !email || !password) {
      return res.status(400).json({ success: false, message: "Name, email, and password are required" });
    }

    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ success: false, message: "User already exists with this email" });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create User record
    const user = await User.create({
      name,
      email,
      password: hashedPassword,
      role: 'employee',
      isActive: true,
      organization: req.body.organization || 'WorkPlus Inc.'
    });

    // Create Employee record
    const employee = await Employee.create({
      userId: user._id,
      employeeCode: req.body.employeeCode || `EMP${Date.now()}`,
      department: department || '',
      designation: designation || '',
      baseSalary: baseSalary || 0,
      hra: hra || 0,
      bonus: bonus || 0,
      allowances: allowances || 0,
      phone: phone || '',
      joiningDate: joiningDate ? new Date(joiningDate) : new Date(),
      status: 'active'
    });

    // Return populated employee data
    const populatedEmployee = await Employee.findById(employee._id).populate('userId', '-password');

    // Emit Socket.IO event for real-time updates
    io.emit('employee_created', populatedEmployee);

    res.status(201).json({
      success: true,
      message: "Employee created successfully",
      data: populatedEmployee
    });
  } catch (error) {
    console.error('Error creating employee:', error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
});

// Update employee
app.put("/api/employees/:id", verifyToken, async (req, res) => {
  try {
    if (!['admin', 'super_admin'].includes(req.userRole)) {
      return res.status(403).json({ success: false, message: "Access denied" });
    }

    const employee = await Employee.findById(req.params.id);
    if (!employee) {
      return res.status(404).json({ success: false, message: "Employee not found" });
    }

    // Update employee fields
    const updateFields = ['department', 'designation', 'baseSalary', 'hra', 'bonus', 'incentives', 'allowances', 'phone', 'address', 'status', 'providentFund', 'tax', 'insurance', 'otherDeductions'];
    updateFields.forEach(field => {
      if (req.body[field] !== undefined) {
        employee[field] = req.body[field];
      }
    });

    await employee.save();

    // Update user fields if provided
    if (req.body.name || req.body.email || req.body.isActive !== undefined) {
      const userUpdate = {};
      if (req.body.name) userUpdate.name = req.body.name;
      if (req.body.email) userUpdate.email = req.body.email;
      if (req.body.isActive !== undefined) userUpdate.isActive = req.body.isActive;
      await User.findByIdAndUpdate(employee.userId, userUpdate);
    }

    const updatedEmployee = await Employee.findById(employee._id).populate('userId', '-password');

    res.json({
      success: true,
      message: "Employee updated successfully",
      data: updatedEmployee
    });
  } catch (error) {
    console.error('Error updating employee:', error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
});

// Delete employee
app.delete("/api/employees/:id", verifyToken, async (req, res) => {
  try {
    if (!['admin', 'super_admin'].includes(req.userRole)) {
      return res.status(403).json({ success: false, message: "Access denied" });
    }

    const employee = await Employee.findById(req.params.id);
    if (!employee) {
      return res.status(404).json({ success: false, message: "Employee not found" });
    }

    // Delete associated user
    await User.findByIdAndDelete(employee.userId);

    // Delete employee record
    await Employee.findByIdAndDelete(req.params.id);

    res.json({ success: true, message: "Employee deleted successfully" });
  } catch (error) {
    console.error('Error deleting employee:', error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
});

// Payroll / Payslip APIs

// Get all payslips
app.get("/api/payslips", verifyToken, async (req, res) => {
  try {
    const payslips = await Payslip.find()
      .populate('employeeId')
      .populate('userId', '-password')
      .sort({ year: -1, month: -1 });
    res.json({ success: true, data: payslips });
  } catch (error) {
    console.error('Error fetching payslips:', error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
});

// Get payslips for specific employee
app.get("/api/payslips/employee/:employeeId", verifyToken, async (req, res) => {
  try {
    const payslips = await Payslip.find({ employeeId: req.params.employeeId })
      .populate('employeeId')
      .sort({ year: -1, month: -1 });
    res.json({ success: true, data: payslips });
  } catch (error) {
    console.error('Error fetching employee payslips:', error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
});

// Get payslips for current user
app.get("/api/payslips/my-payslips", verifyToken, async (req, res) => {
  try {
    // Find employee record for current user
    const employee = await Employee.findOne({ userId: req.userId });
    if (!employee) {
      return res.status(404).json({ success: false, message: "Employee record not found" });
    }

    const payslips = await Payslip.find({ employeeId: employee._id })
      .sort({ year: -1, month: -1 });
    res.json({ success: true, data: payslips });
  } catch (error) {
    console.error('Error fetching my payslips:', error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
});

// Create payslip (Admin only)
app.post("/api/payslips", verifyToken, async (req, res) => {
  try {
    if (!['admin', 'super_admin'].includes(req.userRole)) {
      return res.status(403).json({ success: false, message: "Access denied" });
    }

    const { employeeId, month, year } = req.body;

    // Get employee data
    const employee = await Employee.findById(employeeId).populate('userId');
    if (!employee) {
      return res.status(404).json({ success: false, message: "Employee not found" });
    }

    // AUTOMATED SALARY CALCULATION ENGINE
    const baseSalary = employee.baseSalary || 0;
    const hra = employee.hra || baseSalary * 0.4; // 40% of base salary
    const allowances = employee.allowances || baseSalary * 0.1; // 10% of base salary
    
    // Get attendance for the month
    const monthStart = new Date(year, new Date(`${month} 1, ${year}`).getMonth(), 1);
    const monthEnd = new Date(year, monthStart.getMonth() + 1, 0);
    
    const attendance = await Attendance.find({
      userId: employee.userId._id,
      date: { $gte: monthStart, $lte: monthEnd }
    });
    
    // Calculate working days and absences
    const workingDays = 22; // Standard working days
    const presentDays = attendance.filter(a => a.status === 'present').length;
    const absentDays = workingDays - presentDays;
    
    // Get approved leaves
    const approvedLeaves = await LeaveRequest.find({
      userId: employee.userId._id,
      status: 'approved',
      startDate: { $gte: monthStart },
      endDate: { $lte: monthEnd }
    });
    const approvedLeaveDays = approvedLeaves.reduce((total, leave) => {
      const start = new Date(leave.startDate);
      const end = new Date(leave.endDate);
      return total + Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    }, 0);
    
    // Calculate deductions
    const perDaySalary = baseSalary / workingDays;
    const absentDeduction = Math.max(0, absentDays - approvedLeaveDays) * perDaySalary;
    
    // Get advances/loans for deduction
    const activeAdvances = await AdvanceLoan.find({
      employeeId,
      status: 'approved',
      monthlyDeduction: { $gt: 0 }
    });
    const advanceDeduction = activeAdvances.reduce((sum, adv) => sum + adv.monthlyDeduction, 0);
    
    // Calculate bonuses based on attendance
    let bonus = employee.bonus || 0;
    if (presentDays >= workingDays * 0.95) {
      bonus += baseSalary * 0.05; // 5% bonus for >95% attendance
    }
    
    // Calculate incentives
    const incentives = employee.incentives || 0;
    
    // Calculate deductions
    const providentFund = employee.providentFund || baseSalary * 0.12; // 12% PF
    const tax = employee.tax || 0;
    const insurance = employee.insurance || 0;
    const otherDeductions = employee.otherDeductions || 0;
    const loanDeductions = 0;
    
    // Calculate gross and net salary
    const grossSalary = baseSalary + hra + bonus + incentives + allowances;
    const totalDeductions = providentFund + tax + insurance + otherDeductions + absentDeduction + advanceDeduction + loanDeductions;
    const netPay = grossSalary - totalDeductions;

    // Check if payslip already exists for this month/year
    const existingPayslip = await Payslip.findOne({ employeeId, month, year });
    if (existingPayslip) {
      return res.status(400).json({ success: false, message: "Payslip already exists for this month" });
    }

    const payslip = await Payslip.create({
      employeeId,
      userId: employee.userId._id,
      month,
      year,
      baseSalary,
      hra,
      bonus,
      incentives,
      allowances,
      providentFund,
      tax,
      insurance,
      otherDeductions,
      advanceDeductions: advanceDeduction,
      loanDeductions,
      grossSalary,
      totalDeductions,
      netPay,
      status: 'draft'
    });

    const populatedPayslip = await Payslip.findById(payslip._id)
      .populate('employeeId')
      .populate('userId', 'name email');

    // Emit real-time event
    io.emit('payroll_updated', populatedPayslip);

    res.status(201).json({
      success: true,
      message: "Payslip created successfully with automated calculations",
      data: {
        payslip: populatedPayslip,
        calculations: {
          workingDays,
          presentDays,
          absentDays,
          approvedLeaveDays,
          absentDeduction,
          advanceDeduction,
          bonusAdded: presentDays >= workingDays * 0.95 ? baseSalary * 0.05 : 0
        }
      }
    });
  } catch (error) {
    console.error('Error creating payslip:', error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
});

// Update payslip status (mark as paid)
app.patch("/api/payslips/:id/pay", verifyToken, async (req, res) => {
  try {
    if (!['admin', 'super_admin'].includes(req.userRole)) {
      return res.status(403).json({ success: false, message: "Access denied" });
    }

    const payslip = await Payslip.findByIdAndUpdate(
      req.params.id,
      { status: 'paid', paidDate: new Date(), paidBy: req.userId },
      { new: true }
    ).populate('employeeId');

    if (!payslip) {
      return res.status(404).json({ success: false, message: "Payslip not found" });
    }

    res.json({ success: true, message: "Payslip marked as paid", data: payslip });
  } catch (error) {
    console.error('Error updating payslip:', error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
});

// Delete payslip
app.delete("/api/payslips/:id", verifyToken, async (req, res) => {
  try {
    if (!['admin', 'super_admin'].includes(req.userRole)) {
      return res.status(403).json({ success: false, message: "Access denied" });
    }

    const payslip = await Payslip.findByIdAndDelete(req.params.id);
    if (!payslip) {
      return res.status(404).json({ success: false, message: "Payslip not found" });
    }

    res.json({ success: true, message: "Payslip deleted successfully" });
  } catch (error) {
    console.error('Error deleting payslip:', error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
});

// Advance and Loan Management APIs

// Get all advances/loans
app.get("/api/advances-loans", verifyToken, async (req, res) => {
  try {
    const advancesLoans = await AdvanceLoan.find()
      .populate('employeeId')
      .populate('userId', '-password')
      .sort({ requestedDate: -1 });
    res.json({ success: true, data: advancesLoans });
  } catch (error) {
    console.error('Error fetching advances/loans:', error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
});

// Get advances/loans for specific employee
app.get("/api/advances-loans/employee/:employeeId", verifyToken, async (req, res) => {
  try {
    const advancesLoans = await AdvanceLoan.find({ employeeId: req.params.employeeId })
      .sort({ requestedDate: -1 });
    res.json({ success: true, data: advancesLoans });
  } catch (error) {
    console.error('Error fetching employee advances/loans:', error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
});

// Get my advances/loans (for current user)
app.get("/api/advances-loans/my-requests", verifyToken, async (req, res) => {
  try {
    const employee = await Employee.findOne({ userId: req.userId });
    if (!employee) {
      return res.status(404).json({ success: false, message: "Employee record not found" });
    }

    const advancesLoans = await AdvanceLoan.find({ employeeId: employee._id })
      .sort({ requestedDate: -1 });
    res.json({ success: true, data: advancesLoans });
  } catch (error) {
    console.error('Error fetching my advances/loans:', error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
});

// Create advance/loan request (Employee can create, Admin can also create)
app.post("/api/advances-loans", verifyToken, async (req, res) => {
  try {
    const { employeeId, type, amount, reason, installmentAmount, totalInstallments, monthlyDeduction } = req.body;

    // Get employee data
    const employee = await Employee.findById(employeeId);
    if (!employee) {
      return res.status(404).json({ success: false, message: "Employee not found" });
    }

    // Get user data for employeeName
    const user = await User.findById(employee.userId);

    const advanceLoan = await AdvanceLoan.create({
      employeeId,
      userId: employee.userId,
      employeeName: user ? user.name : 'Unknown',
      type,
      amount,
      reason,
      installmentAmount: installmentAmount || 0,
      totalInstallments: totalInstallments || 0,
      monthlyDeduction: monthlyDeduction || 0,
      status: 'pending'
    });

    res.status(201).json({
      success: true,
      message: "Request submitted successfully",
      data: advanceLoan
    });
  } catch (error) {
    console.error('Error creating advance/loan:', error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
});

// Approve advance/loan (Admin only)
app.patch("/api/advances-loans/:id/approve", verifyToken, async (req, res) => {
  try {
    if (!['admin', 'super_admin'].includes(req.userRole)) {
      return res.status(403).json({ success: false, message: "Access denied" });
    }

    const advanceLoan = await AdvanceLoan.findByIdAndUpdate(
      req.params.id,
      { status: 'approved', approvedBy: req.userId, approvedDate: new Date() },
      { new: true }
    );

    if (!advanceLoan) {
      return res.status(404).json({ success: false, message: "Request not found" });
    }

    res.json({ success: true, message: "Request approved", data: advanceLoan });
  } catch (error) {
    console.error('Error approving request:', error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
});

// Reject advance/loan (Admin only)
app.patch("/api/advances-loans/:id/reject", verifyToken, async (req, res) => {
  try {
    if (!['admin', 'super_admin'].includes(req.userRole)) {
      return res.status(403).json({ success: false, message: "Access denied" });
    }

    const { rejectionReason } = req.body;

    const advanceLoan = await AdvanceLoan.findByIdAndUpdate(
      req.params.id,
      { status: 'rejected', rejectionReason },
      { new: true }
    );

    if (!advanceLoan) {
      return res.status(404).json({ success: false, message: "Request not found" });
    }

    res.json({ success: true, message: "Request rejected", data: advanceLoan });
  } catch (error) {
    console.error('Error rejecting request:', error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
});

// Update installment payment
app.patch("/api/advances-loans/:id/pay-installment", verifyToken, async (req, res) => {
  try {
    if (!['admin', 'super_admin'].includes(req.userRole)) {
      return res.status(403).json({ success: false, message: "Access denied" });
    }

    const advanceLoan = await AdvanceLoan.findById(req.params.id);
    if (!advanceLoan) {
      return res.status(404).json({ success: false, message: "Request not found" });
    }

    if (advanceLoan.paidInstallments < advanceLoan.totalInstallments) {
      advanceLoan.paidInstallments += 1;
      
      // Mark as completed if all installments paid
      if (advanceLoan.paidInstallments >= advanceLoan.totalInstallments) {
        advanceLoan.status = 'completed';
      }
      
      await advanceLoan.save();
    }

    res.json({ success: true, message: "Installment recorded", data: advanceLoan });
  } catch (error) {
    console.error('Error recording installment:', error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
});

// Delete advance/loan
app.delete("/api/advances-loans/:id", verifyToken, async (req, res) => {
  try {
    if (!['admin', 'super_admin'].includes(req.userRole)) {
      return res.status(403).json({ success: false, message: "Access denied" });
    }

    const advanceLoan = await AdvanceLoan.findByIdAndDelete(req.params.id);
    if (!advanceLoan) {
      return res.status(404).json({ success: false, message: "Request not found" });
    }

    res.json({ success: true, message: "Request deleted" });
  } catch (error) {
    console.error('Error deleting request:', error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
});

// Biometric Attendance Sync API endpoint
app.post("/api/biometric/sync", async (req, res) => {
  try {
    const { tenantId } = req.query;
    
    // Check tenant subscription
    const subscription = await Subscription.findOne({ tenantId, status: 'active' });
    if (!subscription || !subscription.features.biometric) {
      return res.status(403).json({ 
        success: false, 
        message: 'Biometric feature not enabled for this tenant' 
      });
    }
    
    res.json({
      success: true,
      data: {
        deviceConnected: true,
        lastSync: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('Biometric status error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

app.get('/api/biometric/logs', async (req, res) => {
  try {
    const { tenantId, startDate, endDate } = req.query;
    
    // Check tenant subscription
    const subscription = await Subscription.findOne({ tenantId, status: 'active' });
    if (!subscription || !subscription.features.biometric) {
      return res.status(403).json({ 
        success: false, 
        message: 'Biometric feature not enabled for this tenant' 
      });
    }
    
    // Simulate fetching logs from biometric device
    const mockLogs = [
      {
        id: `log_${Date.now()}`,
        deviceUserId: 'DEV001',
        employeeId: 'emp_001',
        type: 'check-in',
        timestamp: new Date().toISOString(),
        location: 'Main Office',
        deviceType: 'fingerprint'
      },
      {
        id: `log_${Date.now() + 1}`,
        deviceUserId: 'DEV002',
        employeeId: 'emp_002',
        type: 'check-out',
        timestamp: new Date(Date.now() - 8 * 60 * 60 * 1000).toISOString(),
        location: 'Main Office',
        deviceType: 'fingerprint'
      }
    ];
    
    res.json({
      success: true,
      data: mockLogs
    });
  } catch (error) {
    console.error('Biometric logs error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

app.post('/api/biometric/sync', async (req, res) => {
  try {
    const { tenantId, logs } = req.body;
    
    // Check tenant subscription
    const subscription = await Subscription.findOne({ tenantId, status: 'active' });
    if (!subscription || !subscription.features.biometric) {
      return res.status(403).json({ 
        success: false, 
        message: 'Biometric feature not enabled for this tenant' 
      });
    }
    
    // Process attendance logs
    const processedLogs = [];
    for (const log of logs) {
      // Find employee by device user ID
      const employee = await User.findOne({ 
        tenantId, 
        deviceUserId: log.deviceUserId 
      });
      
      if (employee) {
        const attendanceRecord = {
          id: `att_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          tenantId,
          employeeId: employee.id,
          employeeName: employee.name,
          checkIn: log.type === 'check-in',
          checkOut: log.type === 'check-out',
          timestamp: log.timestamp,
          deviceType: log.deviceType || 'fingerprint',
          location: log.location || 'Main Office',
          status: 'present'
        };
        
        console.log(`Processed attendance for employee ${employee.name}:`, attendanceRecord);
        processedLogs.push(attendanceRecord);
      }
    }
    
    // Emit real-time attendance event
    if (global.io) {
      global.io.to(`tenant_${tenantId}`).emit('attendance:create', processedLogs);
    }
    
    res.json({
      success: true,
      data: { processed: processedLogs.length }
    });
  } catch (error) {
    console.error('Biometric sync error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// Attendance Management Endpoints
app.post("/api/attendance/check-in", verifyToken, async (req, res) => {
  try {
    const { userId, employeeId, employeeName, orgId } = req.body;
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    // Check if already checked in today
    const existingAttendance = await Attendance.findOne({
      userId,
      date: { $gte: today, $lt: tomorrow }
    });
    
    if (existingAttendance) {
      return res.status(400).json({ 
        success: false, 
        message: "Already checked in today" 
      });
    }
    
    // Create attendance record
    const attendance = await Attendance.create({
      userId,
      employeeId,
      employeeName,
      date: today,
      checkIn: new Date(),
      status: 'present',
      orgId: orgId || 'system'
    });
    
    // Emit real-time event
    io.emit('attendance:create', attendance);
    
    res.status(201).json({
      success: true,
      message: "Checked in successfully",
      data: attendance
    });
  } catch (error) {
    console.error('Error checking in:', error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
});

app.post("/api/attendance/check-out", verifyToken, async (req, res) => {
  try {
    const { userId } = req.body;
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    // Find today's attendance
    const attendance = await Attendance.findOne({
      userId,
      date: { $gte: today, $lt: tomorrow }
    });
    
    if (!attendance) {
      return res.status(404).json({ 
        success: false, 
        message: "No check-in record found for today" 
      });
    }
    
    if (attendance.checkOut) {
      return res.status(400).json({ 
        success: false, 
        message: "Already checked out today" 
      });
    }
    
    // Update check-out time and calculate hours worked
    const checkOut = new Date();
    const hoursWorked = (checkOut.getTime() - attendance.checkIn.getTime()) / (1000 * 60 * 60);
    
    attendance.checkOut = checkOut;
    attendance.hoursWorked = Math.round(hoursWorked * 100) / 100;
    await attendance.save();
    
    // Emit real-time event
    io.emit('attendance:update', attendance);
    
    res.json({
      success: true,
      message: "Checked out successfully",
      data: attendance
    });
  } catch (error) {
    console.error('Error checking out:', error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
});

app.get("/api/attendance/today", verifyToken, async (req, res) => {
  try {
    const { userId } = req.query;
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    const attendance = await Attendance.findOne({
      userId,
      date: { $gte: today, $lt: tomorrow }
    });
    
    res.json({
      success: true,
      data: attendance || null
    });
  } catch (error) {
    console.error('Error fetching attendance:', error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
});

// Dashboard Statistics Endpoints
app.get("/api/dashboard/stats", verifyToken, async (req, res) => {
  try {
    const orgId = req.userOrgId || 'system';
    const role = req.userRole;

    // Get employee count
    const totalEmployees = await Employee.countDocuments();
    
    // Get expenses for current month
    const currentMonth = new Date().getMonth();
    const currentYear = new Date().getFullYear();
    const monthlyExpenses = await Expense.aggregate([
      {
        $match: {
          date: {
            $gte: new Date(currentYear, currentMonth, 1),
            $lt: new Date(currentYear, currentMonth + 1, 1)
          },
          status: 'approved'
        }
      },
      {
        $group: {
          _id: null,
          total: { $sum: '$amount' }
        }
      }
    ]);

    // Get payroll cost for current month
    const payrollCost = await Payslip.aggregate([
      {
        $match: {
          month: new Date().toLocaleString('default', { month: 'long' }),
          year: currentYear,
          status: { $in: ['paid', 'pending'] }
        }
      },
      {
        $group: {
          _id: null,
          total: { $sum: '$netPay' }
        }
      }
    ]);

    // Get pending leave requests
    const pendingLeaveRequests = await LeaveRequest.countDocuments({ status: 'pending' });

    // Get attendance for today
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    const todayAttendance = await Attendance.countDocuments({
      date: { $gte: today, $lt: tomorrow },
      status: 'present'
    });

    res.json({
      success: true,
      data: {
        totalEmployees,
        monthlyExpenses: monthlyExpenses[0]?.total || 0,
        payrollCost: payrollCost[0]?.total || 0,
        pendingLeaveRequests,
        todayAttendance,
        avgProductivity: 87 // This would be calculated from actual attendance/performance data
      }
    });
  } catch (error) {
    console.error('Error fetching dashboard stats:', error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
});

// Get recent leave requests for dashboard
app.get("/api/dashboard/recent-leave-requests", verifyToken, async (req, res) => {
  try {
    const leaveRequests = await LeaveRequest.find({ status: 'pending' })
      .populate('userId', 'name email')
      .populate('employeeId', 'designation department')
      .sort({ createdAt: -1 })
      .limit(10);
    
    res.json({ success: true, data: leaveRequests });
  } catch (error) {
    console.error('Error fetching recent leave requests:', error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
});

// Get today's attendance for dashboard
app.get("/api/dashboard/todays-attendance", verifyToken, async (req, res) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    const attendance = await Attendance.find({
      date: { $gte: today, $lt: tomorrow }
    })
      .populate('userId', 'name email')
      .populate('employeeId', 'designation department')
      .sort({ checkIn: -1 });
    
    res.json({ success: true, data: attendance });
  } catch (error) {
    console.error('Error fetching today\'s attendance:', error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
});

// Get expense trends for dashboard charts
app.get("/api/dashboard/expense-trends", verifyToken, async (req, res) => {
  try {
    const currentYear = new Date().getFullYear();
    const expenses = await Expense.aggregate([
      {
        $match: {
          date: {
            $gte: new Date(currentYear, 0, 1),
            $lt: new Date(currentYear + 1, 0, 1)
          },
          status: 'approved'
        }
      },
      {
        $group: {
          _id: { $month: '$date' },
          amount: { $sum: '$amount' }
        }
      },
      {
        $sort: { _id: 1 }
      }
    ]);

    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const expenseData = expenses.map(e => ({
      month: monthNames[e._id - 1],
      amount: e.amount
    }));

    res.json({ success: true, data: expenseData });
  } catch (error) {
    console.error('Error fetching expense trends:', error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
});

const PORT = process.env.PORT || 5000;

server.listen(PORT, async () => {
  console.log(`✅ Server running on port ${PORT}`);
  console.log('✅ Socket.IO server initialized');
  console.log('✅ Multi-tenant SaaS architecture enabled');
  console.log(`✅ Environment: ${process.env.NODE_ENV || "production"}`);
  console.log(`✅ CORS Origins: ${allowedOrigins.join(", ")}`);
  
  // Seed super admin on server start
  await seedSuperAdmin();
});

// Handle server errors
server.on('error', (error) => {
  console.error('❌ Server error:', error);
  if (error.code === 'EADDRINUSE') {
    console.error(`❌ Port ${PORT} is already in use`);
  }
  process.exit(1);
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught Exception:', error);
  process.exit(1);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});
