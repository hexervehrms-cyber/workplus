/**
 * Employee Onboarding Routes
 * 
 * Features:
 * - Generate shareable onboarding links for new employees
 * - Validate and process onboarding links
 * - Submit onboarding form data
 * - Track onboarding status
 * - Send onboarding emails
 */

import express from 'express';
import crypto from 'crypto';
import bcrypt from 'bcrypt';
import { asyncHandler } from '../middleware/errorHandler.js';
import { authenticate, authorize } from '../middleware/auth.js';
import OnboardingLink from '../models/OnboardingLink.js';
import OnboardingSubmission from '../models/OnboardingSubmission.js';
import User from '../models/User.js';
import Employee from '../models/Employee.js';
import logger from '../utils/logger.js';

const router = express.Router();

/**
 * POST /api/onboarding/generate-link
 * Generate a shareable onboarding link for a new employee
 * Only accessible by Super Admin, Admin, and HR
 */
router.post('/generate-link',
  authenticate,
  authorize('super_admin', 'admin', 'hr'),
  asyncHandler(async (req, res) => {
    const { employeeEmail, employeeName, department, organizationId } = req.body;
    const createdBy = req.user.userId;

    try {
      // Validate required fields
      if (!employeeEmail || !employeeName) {
        return res.status(400).json({
          success: false,
          message: 'Employee email and name are required'
        });
      }

      // Check if employee already has an active onboarding link
      const existingLink = await OnboardingLink.findOne({
        employeeEmail,
        isUsed: false,
        expiresAt: { $gt: new Date() }
      });

      if (existingLink) {
        return res.status(400).json({
          success: false,
          message: 'An active onboarding link already exists for this employee'
        });
      }

      // Generate unique token
      const token = crypto.randomBytes(32).toString('hex');

      // Set expiration to 30 days from now
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 30);

      // Create onboarding link
      const onboardingLink = await OnboardingLink.create({
        token,
        employeeEmail,
        employeeName,
        department: department || 'General',
        organizationId: organizationId || req.user.orgId,
        organizationName: req.user.orgName || 'WorkPlus',
        createdBy,
        expiresAt
      });

      // Generate onboarding URL
      // Use FRONTEND_URL from environment variable (set in production)
      const frontendUrl = process.env.FRONTEND_URL || process.env.CORS_ORIGIN || 'https://workplus-qbshegha8-hexervehrms-8667s-projects.vercel.app';
      const onboardingUrl = `${frontendUrl}/onboarding/${token}`;

      // TODO: Send email to employee with onboarding link
      logger.info('Onboarding link generated', {
        employeeEmail,
        employeeName,
        token: token.substring(0, 10) + '...',
        expiresAt,
        createdBy
      });

      res.status(201).json({
        success: true,
        message: 'Onboarding link generated successfully',
        data: {
          id: onboardingLink._id,
          token,
          employeeEmail,
          employeeName,
          onboardingUrl,
          expiresAt,
          createdAt: onboardingLink.createdAt
        }
      });

    } catch (error) {
      logger.error('Generate onboarding link error', {
        error: error.message,
        stack: error.stack,
        body: req.body
      });
      res.status(500).json({
        success: false,
        message: 'Failed to generate onboarding link'
      });
    }
  })
);

/**
 * GET /api/onboarding/validate/:token
 * Validate an onboarding link and get employee details
 * Public endpoint - no authentication required
 */
router.get('/validate/:token',
  asyncHandler(async (req, res) => {
    const { token } = req.params;

    try {
      // Find onboarding link
      const onboardingLink = await OnboardingLink.findOne({ token });

      if (!onboardingLink) {
        return res.status(404).json({
          success: false,
          message: 'Invalid onboarding link'
        });
      }

      // Check if link has expired
      if (onboardingLink.expiresAt < new Date()) {
        return res.status(400).json({
          success: false,
          message: 'Onboarding link has expired'
        });
      }

      // Check if link has already been used
      if (onboardingLink.isUsed) {
        return res.status(400).json({
          success: false,
          message: 'Onboarding link has already been used'
        });
      }

      res.json({
        success: true,
        data: {
          employeeEmail: onboardingLink.employeeEmail,
          employeeName: onboardingLink.employeeName,
          department: onboardingLink.department,
          organizationName: onboardingLink.organizationName,
          organizationId: onboardingLink.organizationId
        }
      });

    } catch (error) {
      logger.error('Validate onboarding link error', {
        error: error.message,
        token: req.params.token.substring(0, 10) + '...'
      });
      res.status(500).json({
        success: false,
        message: 'Failed to validate onboarding link'
      });
    }
  })
);

/**
 * POST /api/onboarding/submit
 * Submit onboarding form data and create employee profile
 * Public endpoint - no authentication required
 */
router.post('/submit',
  asyncHandler(async (req, res) => {
    const { token, profilePhoto, personalInfo, sensitiveInfo, emergencyContact, educationalDocuments, employmentDocuments, password } = req.body;

    try {
      logger.info('Onboarding submit request received', {
        token: token?.substring(0, 10) + '...',
        personalInfo: personalInfo ? { firstName: personalInfo.firstName, lastName: personalInfo.lastName } : null,
        hasProfilePhoto: !!profilePhoto,
        hasPassword: !!password
      });

      // Validate token
      const onboardingLink = await OnboardingLink.findOne({ token });

      if (!onboardingLink) {
        logger.warn('Invalid onboarding token', { token: token?.substring(0, 10) + '...' });
        return res.status(404).json({
          success: false,
          message: 'Invalid onboarding link'
        });
      }

      if (onboardingLink.expiresAt < new Date()) {
        logger.warn('Onboarding link expired', { 
          token: token?.substring(0, 10) + '...',
          expiresAt: onboardingLink.expiresAt
        });
        return res.status(400).json({
          success: false,
          message: 'Onboarding link has expired'
        });
      }

      if (onboardingLink.isUsed) {
        logger.warn('Onboarding link already used', { 
          token: token?.substring(0, 10) + '...',
          employeeEmail: onboardingLink.employeeEmail
        });
        return res.status(400).json({
          success: false,
          message: 'Onboarding link has already been used'
        });
      }

      // Validate required fields
      if (!personalInfo || !personalInfo.firstName || !personalInfo.lastName) {
        logger.warn('Missing required personal info', { personalInfo });
        return res.status(400).json({
          success: false,
          message: 'First name and last name are required'
        });
      }

      // Validate password
      if (!password) {
        logger.warn('Missing password', { email: onboardingLink.employeeEmail });
        return res.status(400).json({
          success: false,
          message: 'Password is required'
        });
      }

      // Create onboarding submission
      logger.info('Creating onboarding submission', {
        employeeEmail: onboardingLink.employeeEmail,
        employeeName: onboardingLink.employeeName
      });

      const submission = await OnboardingSubmission.create({
        employeeId: '', // Will be updated after user creation
        employeeName: onboardingLink.employeeName,
        email: onboardingLink.employeeEmail,
        phone: personalInfo.phone,
        personalInfo: {
          firstName: personalInfo.firstName,
          lastName: personalInfo.lastName,
          dateOfBirth: personalInfo.dateOfBirth,
          gender: personalInfo.gender,
          address: personalInfo.address
        },
        sensitiveInfo: {
          aadharNumber: sensitiveInfo?.aadharNumber,
          panNumber: sensitiveInfo?.panNumber,
          bankAccount: sensitiveInfo?.bankAccount,
          ifscCode: sensitiveInfo?.ifscCode
        },
        emergencyContact: {
          name: emergencyContact?.name,
          relation: emergencyContact?.relation,
          phone: emergencyContact?.phone
        },
        educationalDocuments: educationalDocuments || {},
        employmentDocuments: employmentDocuments || [],
        documents: employmentDocuments || [],
        status: 'pending'
      });

      logger.info('Onboarding submission created', { submissionId: submission._id });

      // Hash password
      const hashedPassword = await bcrypt.hash(password, 10);
      logger.info('Password hashed successfully');

      // Create User account
      const fullName = `${personalInfo.firstName} ${personalInfo.lastName}`;
      logger.info('Creating user account', {
        email: onboardingLink.employeeEmail,
        fullName,
        orgId: onboardingLink.organizationId
      });

      let user;
      try {
        user = await User.create({
          name: fullName,
          email: onboardingLink.employeeEmail,
          password: hashedPassword, // Store hashed password
          role: 'employee',
          status: 'active',
          orgId: onboardingLink.organizationId,
          avatar: profilePhoto || null, // Store the base64 photo as avatar
          lastLogin: null,
          profile: {
            firstName: personalInfo.firstName,
            lastName: personalInfo.lastName
          }
        });
        logger.info('User account created successfully', { userId: user._id, email: user.email });
      } catch (userError) {
        logger.error('Failed to create user account', {
          error: userError.message,
          stack: userError.stack,
          email: onboardingLink.employeeEmail
        });
        throw userError;
      }

      // Create Employee profile
      logger.info('Creating employee profile', {
        userId: user._id,
        firstName: personalInfo.firstName,
        lastName: personalInfo.lastName,
        department: onboardingLink.department,
        orgId: onboardingLink.organizationId
      });

      let employee;
      try {
        employee = await Employee.create({
          userId: user._id,
          employeeCode: 'EMP_' + Date.now(),
          firstName: personalInfo.firstName,
          lastName: personalInfo.lastName,
          designation: 'Employee',
          department: onboardingLink.department,
          baseSalary: 0, // Will be set by HR
          hra: 0,
          bonus: 0,
          incentives: 0,
          allowances: 0,
          providentFund: 0,
          tax: 0,
          insurance: 0,
          otherDeductions: 0,
          joiningDate: new Date(),
          phone: personalInfo.phone,
          address: personalInfo.address,
          dateOfBirth: personalInfo.dateOfBirth,
          gender: personalInfo.gender,
          aadharNumber: sensitiveInfo?.aadharNumber,
          panNumber: sensitiveInfo?.panNumber,
          bankAccount: sensitiveInfo?.bankAccount,
          ifscCode: sensitiveInfo?.ifscCode,
          bankDetails: {
            accountNumber: sensitiveInfo?.bankAccount,
            bankName: '', // Can be extracted from IFSC if needed
            ifscCode: sensitiveInfo?.ifscCode,
            accountHolderName: fullName
          },
          status: 'active',
          createdViaOnboarding: true, // Mark as created via onboarding
          orgId: onboardingLink.organizationId
        });
        logger.info('Employee profile created successfully', { 
          employeeId: employee._id, 
          userId: user._id,
          employeeCode: employee.employeeCode
        });
      } catch (employeeError) {
        logger.error('Failed to create employee profile', {
          error: employeeError.message,
          stack: employeeError.stack,
          userId: user._id,
          firstName: personalInfo.firstName,
          lastName: personalInfo.lastName
        });
        throw employeeError;
      }

      // Update onboarding submission with employee and user IDs
      submission.employeeId = employee._id.toString();
      submission.submittedBy = user._id;
      submission.organizationId = onboardingLink.organizationId;
      await submission.save();

      logger.info('Onboarding submission updated with employee and user IDs', {
        submissionId: submission._id,
        employeeId: employee._id,
        userId: user._id
      });

      // Mark onboarding link as used
      logger.info('Marking onboarding link as used', { linkId: onboardingLink._id });
      await OnboardingLink.findByIdAndUpdate(
        onboardingLink._id,
        { isUsed: true },
        { new: true }
      );

      logger.info('Employee profile created from onboarding - SUCCESS', {
        submissionId: submission._id,
        userId: user._id,
        employeeId: employee._id,
        employeeEmail: onboardingLink.employeeEmail,
        employeeName: onboardingLink.employeeName
      });

      // Emit real-time employee creation event
      if (req.emitEmployeeUpdate) {
        req.emitEmployeeUpdate('created', {
          _id: employee._id,
          userId: user._id,
          employeeCode: employee.employeeCode,
          firstName: employee.firstName,
          lastName: employee.lastName,
          designation: employee.designation,
          department: employee.department,
          status: employee.status,
          createdViaOnboarding: true
        }, onboardingLink.organizationId);
        logger.info('Employee creation event emitted', { 
          employeeId: employee._id,
          orgId: onboardingLink.organizationId
        });
      }

      res.status(201).json({
        success: true,
        message: 'Onboarding form submitted successfully and employee profile created',
        data: {
          submissionId: submission._id,
          userId: user._id,
          employeeId: employee._id,
          status: submission.status,
          submittedAt: submission.submittedAt,
          profileCreated: true
        }
      });

    } catch (error) {
      logger.error('Submit onboarding form error - CRITICAL', {
        error: error.message,
        stack: error.stack,
        code: error.code,
        name: error.name,
        body: req.body
      });
      res.status(500).json({
        success: false,
        message: 'Failed to submit onboarding form',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  })
);

/**
 * GET /api/onboarding/links
 * Get all onboarding links (for HR/Admin)
 */
router.get('/links',
  authenticate,
  authorize('super_admin', 'admin', 'hr'),
  asyncHandler(async (req, res) => {
    const { status, page = 1, limit = 20 } = req.query;
    const orgId = req.user.orgId;

    try {
      const query = { organizationId: orgId };

      // Filter by status
      if (status === 'active') {
        query.isUsed = false;
        query.expiresAt = { $gt: new Date() };
      } else if (status === 'used') {
        query.isUsed = true;
      } else if (status === 'expired') {
        query.expiresAt = { $lt: new Date() };
      }

      const skip = (page - 1) * limit;

      const [links, totalCount] = await Promise.all([
        OnboardingLink.find(query)
          .populate('createdBy', 'name email')
          .sort({ createdAt: -1 })
          .limit(parseInt(limit))
          .skip(skip)
          .lean(),
        OnboardingLink.countDocuments(query)
      ]);

      res.json({
        success: true,
        data: {
          links: links.map(link => ({
            id: link._id,
            employeeEmail: link.employeeEmail,
            employeeName: link.employeeName,
            department: link.department,
            status: link.isUsed ? 'used' : (link.expiresAt < new Date() ? 'expired' : 'active'),
            expiresAt: link.expiresAt,
            createdBy: link.createdBy?.name,
            createdAt: link.createdAt
          })),
          pagination: {
            page: parseInt(page),
            limit: parseInt(limit),
            total: totalCount,
            pages: Math.ceil(totalCount / limit)
          }
        }
      });

    } catch (error) {
      logger.error('Get onboarding links error', {
        error: error.message,
        orgId: req.user.orgId
      });
      res.status(500).json({
        success: false,
        message: 'Failed to fetch onboarding links'
      });
    }
  })
);

/**
 * GET /api/onboarding/submissions
 * Get all onboarding submissions (for HR/Admin)
 */
router.get('/submissions',
  authenticate,
  authorize('super_admin', 'admin', 'hr'),
  asyncHandler(async (req, res) => {
    const { status, page = 1, limit = 20 } = req.query;

    try {
      const query = {};

      if (status) {
        query.status = status;
      }

      const skip = (page - 1) * limit;

      const [submissions, totalCount] = await Promise.all([
        OnboardingSubmission.find(query)
          .populate('submittedBy', 'name email')
          .sort({ submittedAt: -1 })
          .limit(parseInt(limit))
          .skip(skip)
          .lean(),
        OnboardingSubmission.countDocuments(query)
      ]);

      res.json({
        success: true,
        data: {
          submissions: submissions.map(sub => ({
            id: sub._id,
            employeeName: sub.employeeName,
            email: sub.email,
            department: sub.officialInfo?.department,
            status: sub.status,
            submittedAt: sub.submittedAt,
            submittedBy: sub.submittedBy?.name
          })),
          pagination: {
            page: parseInt(page),
            limit: parseInt(limit),
            total: totalCount,
            pages: Math.ceil(totalCount / limit)
          }
        }
      });

    } catch (error) {
      logger.error('Get onboarding submissions error', {
        error: error.message
      });
      res.status(500).json({
        success: false,
        message: 'Failed to fetch onboarding submissions'
      });
    }
  })
);

/**
 * GET /api/onboarding/submissions/:id
 * Get a specific onboarding submission
 */
router.get('/submissions/:id',
  authenticate,
  authorize('super_admin', 'admin', 'hr'),
  asyncHandler(async (req, res) => {
    const { id } = req.params;

    try {
      const submission = await OnboardingSubmission.findById(id)
        .populate('submittedBy', 'name email');

      if (!submission) {
        return res.status(404).json({
          success: false,
          message: 'Submission not found'
        });
      }

      res.json({
        success: true,
        data: submission
      });

    } catch (error) {
      logger.error('Get onboarding submission error', {
        error: error.message,
        submissionId: req.params.id
      });
      res.status(500).json({
        success: false,
        message: 'Failed to fetch submission'
      });
    }
  })
);

/**
 * PUT /api/onboarding/submissions/:id/approve
 * Approve an onboarding submission and create user account
 */
router.put('/submissions/:id/approve',
  authenticate,
  authorize('super_admin', 'admin', 'hr'),
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const approvedBy = req.user.userId;

    try {
      const submission = await OnboardingSubmission.findById(id);

      if (!submission) {
        return res.status(404).json({
          success: false,
          message: 'Submission not found'
        });
      }

      if (submission.status === 'verified') {
        return res.status(400).json({
          success: false,
          message: 'Submission has already been approved'
        });
      }

      // Update submission status
      submission.status = 'verified';
      await submission.save();

      logger.info('Onboarding submission approved', {
        submissionId: id,
        employeeEmail: submission.email,
        approvedBy
      });

      res.json({
        success: true,
        message: 'Onboarding submission approved successfully',
        data: {
          submissionId: submission._id,
          status: submission.status
        }
      });

    } catch (error) {
      logger.error('Approve onboarding submission error', {
        error: error.message,
        submissionId: req.params.id
      });
      res.status(500).json({
        success: false,
        message: 'Failed to approve submission'
      });
    }
  })
);

/**
 * PUT /api/onboarding/submissions/:id/reject
 * Reject an onboarding submission
 */
router.put('/submissions/:id/reject',
  authenticate,
  authorize('super_admin', 'admin', 'hr'),
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { reason } = req.body;
    const rejectedBy = req.user.userId;

    try {
      const submission = await OnboardingSubmission.findById(id);

      if (!submission) {
        return res.status(404).json({
          success: false,
          message: 'Submission not found'
        });
      }

      // Update submission status
      submission.status = 'rejected';
      await submission.save();

      logger.info('Onboarding submission rejected', {
        submissionId: id,
        employeeEmail: submission.email,
        reason,
        rejectedBy
      });

      res.json({
        success: true,
        message: 'Onboarding submission rejected',
        data: {
          submissionId: submission._id,
          status: submission.status
        }
      });

    } catch (error) {
      logger.error('Reject onboarding submission error', {
        error: error.message,
        submissionId: req.params.id
      });
      res.status(500).json({
        success: false,
        message: 'Failed to reject submission'
      });
    }
  })
);

/**
 * GET /api/onboarding/documents/employee/:employeeId
 * Get submitted onboarding documents for an employee
 * Returns documents in format expected by EmployeeDocuments component
 */
router.get('/documents/employee/:employeeId',
  authenticate,
  asyncHandler(async (req, res) => {
    const { employeeId } = req.params;

    try {
      logger.info('Fetching onboarding documents for employee', { employeeId });

      // Find onboarding submission by employee ID (try both string and ObjectId)
      let submission = await OnboardingSubmission.findOne({
        employeeId: employeeId
      });

      // If not found, try searching by email (for backward compatibility)
      if (!submission && req.user?.email) {
        logger.info('Employee ID not found, trying by email', { email: req.user.email });
        submission = await OnboardingSubmission.findOne({
          email: req.user.email
        });
      }

      if (!submission) {
        logger.info('No onboarding submission found for employee', { employeeId, userEmail: req.user?.email });
        return res.json({
          success: true,
          data: []
        });
      }

      logger.info('Found onboarding submission', {
        submissionId: submission._id,
        employeeId: submission.employeeId,
        employmentDocsCount: submission.employmentDocuments?.length || 0,
        educationalDocsCount: Object.keys(submission.educationalDocuments || {}).length
      });

      // Transform documents into format expected by EmployeeDocuments component
      const documents = [];

      // Process employment documents
      if (submission.employmentDocuments && Array.isArray(submission.employmentDocuments)) {
        submission.employmentDocuments.forEach((doc, index) => {
          if (doc && doc.name) {
            documents.push({
              id: `onboarding_emp_${index}_${submission._id}`,
              employeeId: employeeId,
              documentType: doc.category || 'Employment Document',
              organizationId: submission.organizationId || 'ORG-001',
              createdBy: 'employee',
              documentData: {},
              generatedAt: submission.submittedAt || new Date().toISOString(),
              status: submission.status === 'verified' ? 'Verified' : 'Pending',
              documentUrl: '#',
              fileName: doc.name || `Document_${index + 1}`
            });
          }
        });
      }

      // Process educational documents
      if (submission.educationalDocuments && typeof submission.educationalDocuments === 'object') {
        Object.entries(submission.educationalDocuments).forEach(([level, docs], levelIndex) => {
          if (docs && typeof docs === 'object') {
            Object.entries(docs).forEach(([docType, docData], docIndex) => {
              if (docData && docData.name) {
                documents.push({
                  id: `onboarding_edu_${levelIndex}_${docIndex}_${submission._id}`,
                  employeeId: employeeId,
                  documentType: `${level} - ${docType}`,
                  organizationId: submission.organizationId || 'ORG-001',
                  createdBy: 'employee',
                  documentData: {},
                  generatedAt: submission.submittedAt || new Date().toISOString(),
                  status: submission.status === 'verified' ? 'Verified' : 'Pending',
                  documentUrl: '#',
                  fileName: docData.name || `${level}_${docType}`
                });
              }
            });
          }
        });
      }

      logger.info('Onboarding documents retrieved successfully', {
        employeeId,
        documentCount: documents.length,
        submissionStatus: submission.status
      });

      res.json({
        success: true,
        data: documents
      });

    } catch (error) {
      logger.error('Get onboarding documents error', {
        error: error.message,
        stack: error.stack,
        employeeId: req.params.employeeId
      });
      res.status(500).json({
        success: false,
        message: 'Failed to fetch onboarding documents'
      });
    }
  })
);

export default router;
