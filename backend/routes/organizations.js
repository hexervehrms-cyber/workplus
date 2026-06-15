import express from "express";
import mongoose from "mongoose";
import bcrypt from "bcrypt";
import crypto from "crypto";
import dns from "dns/promises";
import { asyncHandler } from "../middleware/errorHandler.js";
import { authorize } from "../middleware/auth.js";
import Organization from "../models/Organization.js";
import User from "../models/User.js";
import Employee from "../models/Employee.js";
import ActivityLog from "../models/ActivityLog.js";
import logger from "../utils/logger.js";

const router = express.Router();

/**
 * Generate unique verification token for domain
 */
function generateVerificationToken() {
  return crypto.randomBytes(16).toString('hex');
}

/**
 * Helper function to generate DNS records for custom domain
 */
function generateDnsRecords(customDomain) {
  // Get platform domain from environment or use default
  const platformCnameTarget = process.env.PLATFORM_CNAME_TARGET || process.env.PLATFORM_ROOT_DOMAIN || 'workplus.hexerve.online';
  const platformIpAddress = process.env.PLATFORM_IP_ADDRESS || null;
  
  // Generate verification token (will be stored separately)
  const verificationToken = generateVerificationToken();
  
  // Check if it's a root/apex domain (no subdomain)
  const domainParts = customDomain.split('.');
  const isApexDomain = domainParts.length === 2; // e.g., example.com
  
  const records = [];
  
  if (isApexDomain) {
    // For apex domain, we can't use CNAME. Return instructions for common scenarios
    // Option 1: ALIAS/ANAME (supported by some providers)
    records.push({
      type: 'ALIAS/ANAME',
      name: '@',
      value: platformCnameTarget,
      status: 'pending',
      purpose: 'Primary domain routing (select ALIAS or ANAME based on your DNS provider)',
      warning: 'Apex domains may require ALIAS or ANAME records depending on your DNS provider. Some providers (like AWS Route 53) use ALIAS, others support ANAME. Check your DNS provider documentation.'
    });
    
    // Option 2: A record (if platform IP is provided)
    if (platformIpAddress) {
      records.push({
        type: 'A',
        name: '@',
        value: platformIpAddress,
        status: 'pending',
        purpose: 'Alternative: Direct IP routing (if your provider does not support ALIAS/ANAME)'
      });
    }
  } else {
    // For subdomain (e.g., app.example.com or hr.example.com), use CNAME
    const subdomain = customDomain.split('.').slice(0, -2).join('.') || 'www';
    records.push({
      type: 'CNAME',
      name: subdomain,
      value: platformCnameTarget,
      status: 'pending',
      purpose: 'Subdomain routing'
    });
  }
  
  // Add TXT verification record for all domains
  records.push({
    type: 'TXT',
    name: '_workplus-verify' + (isApexDomain ? '' : '.' + customDomain.split('.').slice(0, -2).join('.')),
    value: `workplus-verify=${verificationToken}`,
    status: 'pending',
    purpose: 'Domain ownership verification'
  });
  
  return { records, verificationToken };
}

/**
 * GET /api/organizations
 * Get all organizations (Super Admin only)
 */
router.get("/", authorize('super_admin'), asyncHandler(async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;
  const search = req.query.search || '';
  const status = req.query.status || 'all';
  
  const skip = (page - 1) * limit;
  
  // Build query
  const query = {};
  
  if (search) {
    query.$or = [
      { name: { $regex: search, $options: 'i' } },
      { email: { $regex: search, $options: 'i' } },
      { code: { $regex: search, $options: 'i' } }
    ];
  }
  
  if (status !== 'all') {
    query.isActive = status === 'active';
  }
  
  const organizations = await Organization.find(query)
    .populate('createdBy', 'name email')
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit)
    .lean();
  
  // Get additional stats for each organization
  const orgsWithStats = await Promise.all(
    organizations.map(async (org) => {
      const [employeeCount, adminCount, activeUsers] = await Promise.all([
        Employee.countDocuments({ orgId: org._id.toString(), status: 'active' }),
        User.countDocuments({ 
          orgId: org._id.toString(), 
          role: { $in: ['admin', 'hr', 'manager'] },
          isActive: true 
        }),
        User.countDocuments({
          orgId: org._id.toString(),
          isActive: true,
          lastLogin: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) }
        })
      ]);
      
      return {
        ...org,
        employeeCount,
        adminCount,
        activeUsers,
        status: org.isActive ? 'Active' : 'Inactive'
      };
    })
  );
  
  const total = await Organization.countDocuments(query);
  
  res.json({
    success: true,
    data: orgsWithStats,
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit)
    }
  });
}));

/**
 * GET /api/organizations/:id
 * Get organization by ID (Super Admin only)
 */
router.get("/:id", authorize('super_admin'), asyncHandler(async (req, res) => {
  const { id } = req.params;
  
  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).json({
      success: false,
      message: 'Invalid organization ID'
    });
  }
  
  const organization = await Organization.findById(id)
    .populate('createdBy', 'name email')
    .lean();
  
  if (!organization) {
    return res.status(404).json({
      success: false,
      message: 'Organization not found'
    });
  }
  
  // Get organization statistics
  const [employeeCount, adminCount, activeUsers, totalRevenue] = await Promise.all([
    Employee.countDocuments({ orgId: id, status: 'active' }),
    User.countDocuments({ 
      orgId: id, 
      role: { $in: ['admin', 'hr', 'manager'] },
      isActive: true 
    }),
    User.countDocuments({
      orgId: id,
      isActive: true,
      lastLogin: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) }
    }),
    // Calculate total revenue (sum of payroll costs)
    Employee.aggregate([
      { $match: { orgId: id, status: 'active' } },
      { $group: { _id: null, totalSalary: { $sum: '$baseSalary' } } }
    ])
  ]);
  
  const orgWithStats = {
    ...organization,
    stats: {
      employeeCount,
      adminCount,
      activeUsers,
      monthlyRevenue: totalRevenue[0]?.totalSalary || 0
    }
  };
  
  res.json({
    success: true,
    data: orgWithStats
  });
}));

/**
 * POST /api/organizations
 * Create new organization with admin account (Super Admin only)
 */
router.post("/", authorize('super_admin'), asyncHandler(async (req, res) => {
  const {
    name,
    email,
    phone,
    address,
    website,
    industry,
    subscriptionPlan = 'free',
    adminPassword,
    customDomain
  } = req.body;
  
  // Validate required fields
  if (!name || !email) {
    return res.status(400).json({
      success: false,
      message: 'Organization name and email are required'
    });
  }
  
  if (!adminPassword) {
    return res.status(400).json({
      success: false,
      message: 'Admin password is required'
    });
  }
  
  if (adminPassword.length < 8) {
    return res.status(400).json({
      success: false,
      message: 'Password must be at least 8 characters'
    });
  }
  
  // Validate custom domain if provided
  let normalizedDomain = null;
  let dnsData = null;
  
  if (customDomain) {
    let domain = customDomain.trim().toLowerCase();
    
    // Remove protocol if accidentally included
    domain = domain.replace(/^https?:\/\//, '');
    domain = domain.replace(/\/$/, ''); // Remove trailing slash
    domain = domain.trim();
    
    // Basic domain validation
    if (!/^([a-z0-9]+(-[a-z0-9]+)*\.)+[a-z0-9]+(-[a-z0-9]+)*$/.test(domain)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid custom domain format'
      });
    }
    
    // Check if domain is already in use
    const existingDomain = await Organization.findOne({ customDomain: domain, isActive: true });
    if (existingDomain) {
      return res.status(400).json({
        success: false,
        message: 'This custom domain is already assigned to another organization'
      });
    }
    
    normalizedDomain = domain;
    dnsData = generateDnsRecords(normalizedDomain);
  }
  
  // Check if organization with same email exists
  const existingOrg = await Organization.findOne({ email: email.toLowerCase().trim() });
  if (existingOrg) {
    return res.status(400).json({
      success: false,
      message: 'Organization with this email already exists'
    });
  }
  
  // Check if admin user with same email already exists (active users only)
  const existingAdminUser = await User.findOne({ 
    email: email.toLowerCase().trim(),
    isActive: true
  });
  if (existingAdminUser) {
    return res.status(400).json({
      success: false,
      message: 'Admin user with this email already exists'
    });
  }
  
  // Generate unique organization code
  const code = `ORG-${Date.now().toString().slice(-6)}`;
  
  // Hash admin password with bcrypt
  let hashedPassword;
  try {
    hashedPassword = await bcrypt.hash(adminPassword, 12);
  } catch (error) {
    logger.error('Password hashing failed:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to process password'
    });
  }
  
  // Create organization and admin user atomically
  let organization, adminUser;
  try {
    // Build organization data
    const orgData = {
      name: name.trim(),
      code,
      email: email.toLowerCase().trim(),
      phone: phone?.trim() || undefined,
      address: address ? { ...address } : undefined,
      website: website?.trim() || undefined,
      industry: industry?.trim() || undefined,
      subscriptionPlan,
      subscriptionStatus: 'trial',
      subscriptionExpiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days trial
      isActive: true,
      createdBy: req.user.userId
    };
    
    // Add custom domain fields if provided
    if (normalizedDomain && dnsData) {
      orgData.customDomain = normalizedDomain;
      orgData.customDomainStatus = 'pending_dns';
      orgData.customDomainDnsRecords = dnsData.records;
      orgData.customDomainVerificationToken = dnsData.verificationToken;
    }
    
    // Create organization
    organization = await Organization.create(orgData);
    
    // Create admin user for the organization
    adminUser = await User.create({
      name: name.trim(),
      email: email.toLowerCase().trim(),
      password: hashedPassword,
      role: 'admin',
      orgId: organization._id.toString(),
      isActive: true,
      createdBy: req.user.userId
    });
    
    // Log activity
    try {
      await ActivityLog.logActivity({
        userId: req.user.userId,
        orgId: organization._id,
        action: 'org_create',
        entity: {
          entityType: 'organization',
          entityId: organization._id,
          entityName: organization.name
        },
        details: {
          organizationName: organization.name,
          subscriptionPlan: organization.subscriptionPlan,
          adminUserCreated: true,
          customDomainConfigured: !!normalizedDomain
        },
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
        severity: 'medium',
        category: 'admin'
      });
    } catch (logError) {
      logger.warn('Failed to log activity:', logError);
    }
    
  } catch (error) {
    // Clean up: if any creation fails, remove the organization and admin user
    if (organization) {
      try {
        await Organization.deleteOne({ _id: organization._id });
      } catch (cleanupError) {
        logger.error('Failed to cleanup organization on error:', cleanupError);
      }
    }
    if (adminUser) {
      try {
        await User.deleteOne({ _id: adminUser._id });
      } catch (cleanupError) {
        logger.error('Failed to cleanup admin user on error:', cleanupError);
      }
    }
    throw error;
  }
  
  // Build response (do NOT include password)
  const response = {
    success: true,
    message: 'Organization and admin account created successfully',
    data: {
      organization: {
        _id: organization._id,
        name: organization.name,
        code: organization.code,
        email: organization.email,
        phone: organization.phone,
        subscriptionPlan: organization.subscriptionPlan,
        subscriptionStatus: organization.subscriptionStatus,
        subscriptionExpiresAt: organization.subscriptionExpiresAt,
        customDomain: organization.customDomain,
        customDomainStatus: organization.customDomainStatus,
        isActive: organization.isActive,
        createdAt: organization.createdAt
      },
      adminUser: {
        id: adminUser._id,
        email: adminUser.email,
        name: adminUser.name,
        role: adminUser.role
      },
      tenantId: organization._id.toString(),
      defaultTenantUrl: `${process.env.FRONTEND_URL || 'https://workplus.vercel.app'}/login?org=${organization._id}`
    }
  };
  
  // Add DNS records and custom domain info to response if custom domain was provided
  if (normalizedDomain && dnsData) {
    response.data.customDomain = {
      domain: normalizedDomain,
      status: 'pending_dns',
      dnsRecords: dnsData.records,
      customDomainUrl: `https://${normalizedDomain}`,
      verificationRequired: true,
      warning: 'DNS records must be configured at your domain provider before domain verification can succeed. The custom domain login link will work after DNS is verified.'
    };
  }
  
  res.status(201).json(response);
}));

/**
 * PUT /api/organizations/:id
 * Update organization (Super Admin only)
 * Supports optional admin password reset via adminPassword or newAdminPassword field
 * Supports custom domain configuration with automatic DNS record generation
 */
router.put("/:id", authorize('super_admin'), asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { adminPassword, newAdminPassword, customDomain, ...organizationUpdates } = req.body;
  
  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).json({
      success: false,
      message: 'Invalid organization ID'
    });
  }
  
  const organization = await Organization.findById(id);
  if (!organization) {
    return res.status(404).json({
      success: false,
      message: 'Organization not found'
    });
  }
  
  // Store original data for audit log
  const originalData = organization.toObject();
  
  let updateMessage = 'Organization updated successfully';
  let passwordUpdated = false;
  let dnsData = null;
  let customDomainChanged = false;
  
  // Handle custom domain if provided
  if (customDomain !== undefined) {
    if (customDomain.trim()) {
      let domain = customDomain.trim().toLowerCase();
      
      // Remove protocol if accidentally included
      domain = domain.replace(/^https?:\/\//, '');
      domain = domain.replace(/\/$/, ''); // Remove trailing slash
      domain = domain.trim();
      
      // Basic domain validation
      if (!/^([a-z0-9]+(-[a-z0-9]+)*\.)+[a-z0-9]+(-[a-z0-9]+)*$/.test(domain)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid custom domain format'
        });
      }
      
      // Check if domain is already in use by another organization (if different from current)
      if (domain !== organization.customDomain) {
        const existingDomain = await Organization.findOne({ 
          customDomain: domain, 
          isActive: true,
          _id: { $ne: id }
        });
        if (existingDomain) {
          return res.status(400).json({
            success: false,
            message: 'This custom domain is already assigned to another organization'
          });
        }
        customDomainChanged = true;
      }
      
      // Generate new DNS records if domain is new or changed
      if (customDomainChanged || !organization.customDomain) {
        dnsData = generateDnsRecords(domain);
        organizationUpdates.customDomain = domain;
        organizationUpdates.customDomainStatus = 'pending_dns';
        organizationUpdates.customDomainDnsRecords = dnsData.records;
        organizationUpdates.customDomainVerificationToken = dnsData.verificationToken;
        organizationUpdates.customDomainUrl = `https://${domain}`;
        organizationUpdates.defaultTenantUrl = `${process.env.FRONTEND_URL || 'https://workplus.vercel.app'}/login?org=${organization._id}`;
      }
    } else {
      // Clear custom domain if empty string is provided
      organizationUpdates.customDomain = null;
      organizationUpdates.customDomainStatus = 'not_configured';
      organizationUpdates.customDomainDnsRecords = [];
      organizationUpdates.customDomainVerificationToken = null;
      organizationUpdates.customDomainUrl = null;
      customDomainChanged = true;
    }
  }
  
  // Handle admin password reset if provided
  const passwordToSet = adminPassword || newAdminPassword;
  if (passwordToSet) {
    // Validate password length
    if (passwordToSet.length < 8) {
      return res.status(400).json({
        success: false,
        message: 'Password must be at least 8 characters'
      });
    }
    
    try {
      // Hash password with bcrypt
      const hashedPassword = await bcrypt.hash(passwordToSet, 12);
      
      // Find the admin user for this organization
      let adminUser = await User.findOne({
        orgId: organization._id.toString(),
        role: 'admin'
      });
      
      if (!adminUser) {
        // Create admin user if doesn't exist
        adminUser = await User.create({
          name: organization.name,
          email: organization.email,
          password: hashedPassword,
          role: 'admin',
          orgId: organization._id.toString(),
          isActive: true,
          createdBy: req.user.userId
        });
        updateMessage = 'Organization updated and admin account created with new password';
      } else {
        // Update existing admin password
        adminUser.password = hashedPassword;
        await adminUser.save();
        updateMessage = 'Organization updated and admin password reset';
      }
      
      passwordUpdated = true;
    } catch (error) {
      logger.error('Failed to update admin password:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to update admin password'
      });
    }
  }
  
  // Update organization fields (exclude password fields)
  const updatedOrg = await Organization.findByIdAndUpdate(
    id,
    { ...organizationUpdates, updatedAt: new Date() },
    { new: true, runValidators: true }
  );
  
  // Log activity
  try {
    await ActivityLog.logActivity({
      userId: req.user.userId,
      orgId: id,
      action: 'org_update',
      entity: {
        entityType: 'organization',
        entityId: id,
        entityName: updatedOrg.name
      },
      details: {
        organizationUpdated: true,
        adminPasswordReset: passwordUpdated,
        customDomainChanged: customDomainChanged
      },
      changes: {
        before: originalData,
        after: updatedOrg.toObject()
      },
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
      severity: passwordUpdated ? 'high' : 'medium',
      category: 'admin'
    });
  } catch (logError) {
    logger.warn('Failed to log activity:', logError);
  }
  
  // Build response
  const responseData = {
    _id: updatedOrg._id,
    name: updatedOrg.name,
    code: updatedOrg.code,
    email: updatedOrg.email,
    phone: updatedOrg.phone,
    customDomain: updatedOrg.customDomain,
    customDomainStatus: updatedOrg.customDomainStatus,
    isActive: updatedOrg.isActive,
    subscriptionPlan: updatedOrg.subscriptionPlan,
    subscriptionStatus: updatedOrg.subscriptionStatus,
    updatedAt: updatedOrg.updatedAt
  };
  
  // Add DNS setup info if custom domain is being configured
  if (updatedOrg.customDomain && dnsData) {
    responseData.dnsSetup = {
      domain: updatedOrg.customDomain,
      status: updatedOrg.customDomainStatus,
      dnsRecords: updatedOrg.customDomainDnsRecords,
      customDomainUrl: updatedOrg.customDomainUrl,
      defaultTenantUrl: updatedOrg.defaultTenantUrl,
      verificationRequired: true,
      warning: 'DNS records must be configured at your domain provider before domain verification can succeed. The custom domain login link will work after DNS is verified.'
    };
  }
  
  // Return response WITHOUT exposing password
  res.json({
    success: true,
    message: updateMessage,
    data: responseData
  });
}));

/**
 * DELETE /api/organizations/:id
 * Delete organization (Super Admin only)
 */
router.delete("/:id", authorize('super_admin'), asyncHandler(async (req, res) => {
  const { id } = req.params;
  
  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).json({
      success: false,
      message: 'Invalid organization ID'
    });
  }
  
  const organization = await Organization.findById(id);
  if (!organization) {
    return res.status(404).json({
      success: false,
      message: 'Organization not found'
    });
  }
  
  // Check if organization has active employees
  const employeeCount = await Employee.countDocuments({ orgId: id, status: 'active' });
  if (employeeCount > 0) {
    return res.status(400).json({
      success: false,
      message: `Cannot delete organization with ${employeeCount} active employees. Please deactivate employees first.`
    });
  }
  
  // Soft delete - just mark as inactive
  await Organization.findByIdAndUpdate(id, { 
    isActive: false,
    updatedAt: new Date()
  });
  
  // Log activity
  await ActivityLog.logActivity({
    userId: req.user.userId,
    orgId: id,
    action: 'org_delete',
    entity: {
      entityType: 'organization',
      entityId: id,
      entityName: organization.name
    },
    details: {
      organizationName: organization.name,
      employeeCount
    },
    ipAddress: req.ip,
    userAgent: req.get('User-Agent'),
    severity: 'high',
    category: 'admin'
  });
  
  res.json({
    success: true,
    message: 'Organization deactivated successfully'
  });
}));

/**
 * GET /api/organizations/:id/stats
 * Get detailed organization statistics (Super Admin only)
 */
router.get("/:id/stats", authorize('super_admin'), asyncHandler(async (req, res) => {
  const { id } = req.params;
  const days = parseInt(req.query.days) || 30;
  
  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).json({
      success: false,
      message: 'Invalid organization ID'
    });
  }
  
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);
  
  // Get comprehensive statistics
  const [
    employeeStats,
    attendanceStats,
    leaveStats,
    expenseStats,
    recentActivities
  ] = await Promise.all([
    // Employee statistics
    Employee.aggregate([
      { $match: { orgId: id } },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
          avgSalary: { $avg: '$baseSalary' }
        }
      }
    ]),
    
    // Attendance statistics
    Attendance.aggregate([
      { 
        $lookup: {
          from: 'employees',
          localField: 'employeeId',
          foreignField: '_id',
          as: 'employee'
        }
      },
      { $match: { 'employee.orgId': id, date: { $gte: startDate } } },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
          avgHours: { $avg: '$hoursWorked' }
        }
      }
    ]),
    
    // Leave statistics
    LeaveRequest.aggregate([
      {
        $lookup: {
          from: 'employees',
          localField: 'employeeId',
          foreignField: '_id',
          as: 'employee'
        }
      },
      { $match: { 'employee.orgId': id, createdAt: { $gte: startDate } } },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 }
        }
      }
    ]),
    
    // Expense statistics
    Expense.aggregate([
      {
        $lookup: {
          from: 'employees',
          localField: 'employeeId',
          foreignField: '_id',
          as: 'employee'
        }
      },
      { $match: { 'employee.orgId': id, createdAt: { $gte: startDate } } },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
          totalAmount: { $sum: '$amount' }
        }
      }
    ]),
    
    // Recent activities
    ActivityLog.find({ orgId: id })
      .sort({ createdAt: -1 })
      .limit(20)
      .populate('userId', 'name email')
      .lean()
  ]);
  
  // Send stats response (implementation can be extended based on requirements)
  res.json({
    success: true,
    data: {
      employeeStats,
      attendanceStats,
      leaveStats,
      expenseStats,
      recentActivities
    }
  });
}));

/**
 * POST /api/organizations/:id/verify-domain
 * Verify custom domain DNS records (Super Admin only)
 * Checks if DNS records are properly configured
 */
router.post("/:id/verify-domain", authorize('super_admin'), asyncHandler(async (req, res) => {
  const { id } = req.params;
  
  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).json({
      success: false,
      message: 'Invalid organization ID'
    });
  }
  
  const organization = await Organization.findById(id).select('+customDomainVerificationToken');
  
  if (!organization) {
    return res.status(404).json({
      success: false,
      message: 'Organization not found'
    });
  }
  
  if (!organization.customDomain) {
    return res.status(400).json({
      success: false,
      message: 'This organization does not have a custom domain configured'
    });
  }
  
  const customDomain = organization.customDomain;
  const verificationToken = organization.customDomainVerificationToken;
  
  try {
    // Check DNS records
    const dnsRecords = organization.customDomainDnsRecords || [];
    let allValid = true;
    let verifiedRecords = 0;
    const verificationResults = [];
    
    // Check each record type
    for (const record of dnsRecords) {
      try {
        if (record.type === 'TXT') {
          // Verify TXT record for domain verification
          const lookupName = record.name || `_workplus-verify.${customDomain}`;
          const txtRecords = await dns.resolveTxt(lookupName).catch(() => []);
          
          const recordFound = txtRecords.some(txt => 
            txt.join('').includes(`workplus-verify=${verificationToken}`)
          );
          
          if (recordFound) {
            verifiedRecords++;
            record.status = 'verified';
            verificationResults.push({
              type: 'TXT',
              name: lookupName,
              status: 'verified',
              message: 'Verification token found'
            });
          } else {
            allValid = false;
            record.status = 'failed';
            verificationResults.push({
              type: 'TXT',
              name: lookupName,
              status: 'failed',
              message: 'Verification token not found. Ensure the TXT record is correctly added.'
            });
          }
        } else if (['CNAME', 'A', 'ALIAS', 'ANAME'].includes(record.type)) {
          // For CNAME/A records, check if the target is reachable
          let targetFound = false;
          
          if (record.type === 'CNAME') {
            const cnameRecords = await dns.resolveCname(customDomain).catch(() => []);
            targetFound = cnameRecords.some(cname => 
              cname === record.value || cname.endsWith(record.value)
            );
          } else if (record.type === 'A') {
            const aRecords = await dns.resolve4(customDomain).catch(() => []);
            targetFound = aRecords.includes(record.value);
          } else {
            // ALIAS/ANAME records are not directly queryable via DNS API
            // Just show instruction to manually verify
            verificationResults.push({
              type: record.type,
              name: record.name,
              status: 'pending',
              message: `${record.type} record must be manually verified at your DNS provider`
            });
            continue;
          }
          
          if (targetFound) {
            record.status = 'verified';
            verificationResults.push({
              type: record.type,
              name: record.name,
              status: 'verified',
              message: `${record.type} record correctly points to target`
            });
          } else {
            allValid = false;
            record.status = 'pending';
            verificationResults.push({
              type: record.type,
              name: record.name,
              status: 'pending',
              message: `${record.type} record not yet propagated. DNS changes can take up to 48 hours.`
            });
          }
        }
      } catch (dnsError) {
        logger.warn(`DNS lookup error for ${record.type} record:`, dnsError.message);
        verificationResults.push({
          type: record.type,
          name: record.name,
          status: 'pending',
          message: `Unable to verify via DNS API. DNS records may still be correct.`
        });
      }
    }
    
    // Update organization DNS record statuses
    organization.customDomainDnsRecords = dnsRecords;
    organization.customDomainLastCheckedAt = new Date();
    
    if (verifiedRecords > 0 && allValid) {
      // Domain is verified
      organization.customDomainStatus = 'verified';
      organization.customDomainVerifiedAt = new Date();
      organization.customDomainUrl = `https://${customDomain}`;
      
      await organization.save();
      
      // Log activity
      try {
        await ActivityLog.logActivity({
          userId: req.user.userId,
          orgId: id,
          action: 'domain_verified',
          entity: {
            entityType: 'organization',
            entityId: id,
            entityName: organization.name
          },
          details: {
            customDomain: customDomain,
            verificationResults: verificationResults
          },
          ipAddress: req.ip,
          userAgent: req.get('User-Agent'),
          severity: 'medium',
          category: 'admin'
        });
      } catch (logError) {
        logger.warn('Failed to log domain verification:', logError);
      }
      
      return res.json({
        success: true,
        message: 'Domain verified successfully',
        data: {
          customDomain: customDomain,
          status: 'verified',
          verifiedAt: organization.customDomainVerifiedAt,
          customDomainUrl: organization.customDomainUrl,
          verificationResults: verificationResults
        }
      });
    } else if (verifiedRecords > 0) {
      // Partially verified
      organization.customDomainStatus = 'pending_dns';
      await organization.save();
      
      return res.json({
        success: false,
        message: 'DNS records partially verified. Some records may still be propagating.',
        code: 'PARTIAL_VERIFICATION',
        data: {
          customDomain: customDomain,
          status: 'pending_dns',
          verificationResults: verificationResults,
          nextCheck: 'Check back in a few minutes'
        }
      });
    } else {
      // Not verified
      organization.customDomainStatus = 'pending_dns';
      await organization.save();
      
      return res.status(400).json({
        success: false,
        message: 'DNS records not yet configured or verified. Please ensure all DNS records are added at your domain provider.',
        code: 'DNS_NOT_CONFIGURED',
        data: {
          customDomain: customDomain,
          status: 'pending_dns',
          verificationResults: verificationResults,
          instructions: 'Please add the following DNS records at your domain provider and then try verification again. DNS propagation can take up to 48 hours.'
        }
      });
    }
  } catch (error) {
    logger.error('Domain verification error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to verify domain. Please try again later.',
      error: error.message
    });
  }
}));

export default router;