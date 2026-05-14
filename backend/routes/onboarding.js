/**
 * Employee Onboarding Routes
 * 
 * Features:
 * - Generate shareable onboarding links for new employees (JWT + Redis)
 * - Validate and process onboarding links
 * - Submit onboarding form data
 * - Track onboarding status
 * - Send onboarding emails
 */

import express from 'express';
import bcrypt from 'bcrypt';
import { asyncHandler } from '../middleware/errorHandler.js';
import { authenticate, authorize } from '../middleware/auth.js';
import OnboardingLink from '../models/OnboardingLink.js';
import OnboardingSubmission from '../models/OnboardingSubmission.js';
import User from '../models/User.js';
import Employee from '../models/Employee.js';
import logger from '../utils/logger.js';
import OnboardingTokenManager from '../utils/onboardingTokenManager.js';

const router = express.Router();

/**
 * GET /api/onboarding/debug/check-employee
 * Debug endpoint to check if employee was created with correct orgId
 */
router.get('/debug/check-employee',
  authenticate,
  authorize('super_admin', 'admin', 'hr'),
  asyncHandler(async (req, res) => {
    const { email } = req.query;

    if (!email) {
      return res.status(400).json({
        success: false,
        message: 'Email parameter required'
      });
    }

    try {
      const user = await User.findOne({ email }).lean();
      const employee = await Employee.findOne({ 
        $or: [
          { email },
          { userId: user?._id }
        ]
      }).lean();

      res.json({
        success: true,
        data: {
          user: user ? {
            id: user._id,
            email: user.email,
            orgId: user.orgId,
            role: user.role,
            status: user.status
          } : null,
          employee: employee ? {
            id: employee._id,
            firstName: employee.firstName,
            lastName: employee.lastName,
            orgId: employee.orgId,
            status: employee.status,
            employeeCode: employee.employeeCode
          } : null,
          adminOrgId: req.user.orgId,
          match: employee?.orgId === req.user.orgId
        }
      });
    } catch (error) {
      logger.error('Debug check error', { error: error.message, email });
      res.status(500).json({
        success: false,
        message: 'Debug check failed',
        error: error.message
      });
    }
  })
);

/**
 * POST /api/onboarding/generate-link
 * Generate a shareable onboarding link for a new employee (JWT + Redis)
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

      // Determine the correct orgId
      // Priority: 1) organizationId from request body, 2) user's orgId, 3) user's company
      let finalOrgId = organizationId || req.user.orgId;
      
      // Fallback: use a default if still not set
      if (!finalOrgId) {
        finalOrgId = 'ORG-DEFAULT';
      }

      logger.info('Generating onboarding link', {
        employeeEmail,
        employeeName,
        finalOrgId,
        createdBy
      });

      // Invalidate any existing active onboarding links for this employee
      // This allows regenerating links if needed
      const existingLinks = await OnboardingLink.find({
        employeeEmail,
        isUsed: false,
        expiresAt: { $gt: new Date() }
      });

      if (existingLinks.length > 0) {
        // Expire all existing links by setting expiration to now
        await OnboardingLink.updateMany(
          {
            employeeEmail,
            isUsed: false,
            expiresAt: { $gt: new Date() }
          },
          {
            expiresAt: new Date() // Set expiration to now
          }
        );
        
        logger.info('Invalidated existing onboarding links', {
          employeeEmail,
          count: existingLinks.length
        });
      }

      // Generate JWT token using OnboardingTokenManager
      const jwtToken = OnboardingTokenManager.generateToken({
        employeeEmail,
        employeeName,
        department: department || 'General',
        organizationId: finalOrgId,
        organizationName: req.user.orgName || 'WorkPlus'
      });

      // Store token in Redis
      await OnboardingTokenManager.storeToken(jwtToken, {
        employeeEmail,
        employeeName,
        department: department || 'General',
        organizationId: finalOrgId,
        organizationName: req.user.orgName || 'WorkPlus'
      });

      // Generate onboarding URL
      const frontendUrl = process.env.FRONTEND_URL || process.env.CORS_ORIGIN || 'https://workplus-qbshegha8-hexervehrms-8667s-projects.vercel.app';
      const onboardingUrl = `${frontendUrl}/onboarding/${jwtToken}`;

      // Calculate expiration date (30 days from now)
      const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

      logger.info('Onboarding link generated', {
        employeeEmail,
        employeeName,
        token: jwtToken.substring(0, 10) + '...',
        expiresAt,
        createdBy
      });

      res.status(201).json({
        success: true,
        message: 'Onboarding link generated successfully',
        data: {
          token: jwtToken,
          employeeEmail,
          employeeName,
          onboardingUrl,
          expiresAt,
          createdAt: new Date()
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
 * POST /api/onboarding/send-email
 * Send onboarding email with link to employee
 * Only accessible by Super Admin, Admin, and HR
 */
router.post('/send-email',
  authenticate,
  authorize('super_admin', 'admin', 'hr'),
  asyncHandler(async (req, res) => {
    const { token, employeeEmail, employeeName, onboardingUrl } = req.body;

    try {
      // Validate required fields
      if (!token || !employeeEmail || !employeeName || !onboardingUrl) {
        logger.warn('Missing required fields for send-email', {
          hasToken: !!token,
          hasEmail: !!employeeEmail,
          hasName: !!employeeName,
          hasUrl: !!onboardingUrl
        });
        return res.status(400).json({
          success: false,
          message: 'Missing required fields: token, employeeEmail, employeeName, onboardingUrl'
        });
      }

      // Verify token is valid
      const isValid = await OnboardingTokenManager.isTokenValid(token);
      if (!isValid) {
        logger.warn('Invalid or expired token for send-email', {
          employeeEmail,
          tokenPrefix: token.substring(0, 10) + '...'
        });
        return res.status(400).json({
          success: false,
          message: 'Invalid or expired onboarding token'
        });
      }

      logger.info('Sending onboarding email', {
        employeeEmail,
        employeeName,
        tokenPrefix: token.substring(0, 10) + '...'
      });

      // Send email to employee with onboarding link
      const EmailNotificationService = (await import('../utils/emailNotificationService.js')).default;

      const emailSubject = `Welcome to ${req.user.orgName || 'WorkPlus'}! Complete Your Onboarding`;
      
      const emailHtml = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center; border-radius: 8px 8px 0 0;">
            <h1 style="color: white; margin: 0;">Welcome to ${req.user.orgName || 'WorkPlus'}!</h1>
          </div>
          
          <div style="padding: 30px; background-color: #f9f9f9; border: 1px solid #e0e0e0; border-radius: 0 0 8px 8px;">
            <p style="font-size: 16px; color: #333; margin-bottom: 20px;">
              Hi <strong>${employeeName}</strong>,
            </p>
            
            <p style="font-size: 14px; color: #666; line-height: 1.6; margin-bottom: 20px;">
              We're excited to have you join our team! To get started, please complete your onboarding form using the link below. This link will be valid for 30 days.
            </p>
            
            <div style="text-align: center; margin: 30px 0;">
              <a href="${onboardingUrl}" style="display: inline-block; background-color: #667eea; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; font-weight: bold; font-size: 16px;">
                Complete Your Onboarding
              </a>
            </div>
          
            <p style="font-size: 12px; color: #999; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e0e0e0;">
              Or copy and paste this link in your browser:<br>
              <code style="background-color: #f0f0f0; padding: 5px 10px; border-radius: 3px; word-break: break-all;">
                ${onboardingUrl}
              </code>
            </p>
            
            <p style="font-size: 12px; color: #999; margin-top: 20px;">
              If you have any questions, please contact our HR team.
            </p>
            
            <p style="font-size: 12px; color: #999; margin-top: 30px;">
              Best regards,<br>
              <strong>${req.user.orgName || 'WorkPlus'} HR Team</strong>
            </p>
          </div>
        </div>
      `;

      await EmailNotificationService.sendEmail({
        to: employeeEmail,
        subject: emailSubject,
        html: emailHtml,
        from: process.env.FROM_EMAIL || process.env.SMTP_USER
      });

      logger.info('Onboarding email sent successfully', {
        employeeEmail,
        employeeName,
        tokenPrefix: token.substring(0, 10) + '...'
      });

      res.json({
        success: true,
        message: 'Onboarding email sent successfully to employee',
        data: {
          employeeEmail,
          employeeName,
          sentAt: new Date()
        }
      });

    } catch (error) {
      logger.error('Send onboarding email error', {
        error: error.message,
        stack: error.stack,
        body: req.body
      });
      res.status(500).json({
        success: false,
        message: 'Failed to send onboarding email',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
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
      // Verify token is valid
      const isValid = await OnboardingTokenManager.isTokenValid(token);
      if (!isValid) {
        return res.status(400).json({
          success: false,
          message: 'Invalid or expired onboarding link'
        });
      }

      // Get token data from Redis
      const tokenData = await OnboardingTokenManager.getToken(token);
      if (!tokenData) {
        return res.status(404).json({
          success: false,
          message: 'Onboarding link not found'
        });
      }

      res.json({
        success: true,
        data: {
          employeeEmail: tokenData.employeeEmail,
          employeeName: tokenData.employeeName,
          department: tokenData.department,
          organizationName: tokenData.organizationName,
          organizationId: tokenData.organizationId
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
      const isValid = await OnboardingTokenManager.isTokenValid(token);
      if (!isValid) {
        logger.warn('Invalid or expired token for submit', { token: token?.substring(0, 10) + '...' });
        return res.status(400).json({
          success: false,
          message: 'Invalid or expired onboarding link'
        });
      }

      // Get token data from Redis
      const tokenData = await OnboardingTokenManager.getToken(token);
      if (!tokenData) {
        logger.warn('Token data not found in Redis', { token: token?.substring(0, 10) + '...' });
        return res.status(404).json({
          success: false,
          message: 'Onboarding link not found'
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
        logger.warn('Missing password', { email: tokenData.employeeEmail });
        return res.status(400).json({
          success: false,
          message: 'Password is required'
        });
      }

      // Create onboarding submission
      logger.info('Creating onboarding submission', {
        employeeEmail: tokenData.employeeEmail,
        employeeName: tokenData.employeeName
      });

      const submission = await OnboardingSubmission.create({
        employeeId: '', // Will be updated after user creation
        employeeName: tokenData.employeeName,
        email: tokenData.employeeEmail,
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
        email: tokenData.employeeEmail,
        fullName,
        orgId: tokenData.organizationId
      });

      let user;
      try {
        user = await User.create({
          name: fullName,
          email: tokenData.employeeEmail,
          password: hashedPassword, // Store hashed password
          role: 'employee',
          status: 'active',
          orgId: tokenData.organizationId,
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
          email: tokenData.employeeEmail
        });
        throw userError;
      }

      // Create Employee profile
      logger.info('Creating employee profile', {
        userId: user._id,
        firstName: personalInfo.firstName,
        lastName: personalInfo.lastName,
        department: tokenData.department,
        orgId: tokenData.organizationId
      });

      let employee;
      try {
        employee = await Employee.create({
          userId: user._id,
          employeeCode: 'EMP_' + Date.now(),
          firstName: personalInfo.firstName,
          lastName: personalInfo.lastName,
          designation: 'Employee',
          department: tokenData.department,
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
          orgId: tokenData.organizationId
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
      submission.organizationId = tokenData.organizationId;
      await submission.save();

      logger.info('Onboarding submission updated with employee and user IDs', {
        submissionId: submission._id,
        employeeId: employee._id,
        userId: user._id
      });

      // Mark token as used in Redis
      logger.info('Marking onboarding token as used', { tokenPrefix: token.substring(0, 10) + '...' });
      await OnboardingTokenManager.markTokenAsUsed(token);

      logger.info('Employee profile created from onboarding - SUCCESS', {
        submissionId: submission._id,
        userId: user._id,
        employeeId: employee._id,
        employeeEmail: tokenData.employeeEmail,
        employeeName: tokenData.employeeName
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
        }, tokenData.organizationId);
        logger.info('Employee creation event emitted', { 
          employeeId: employee._id,
          orgId: tokenData.organizationId
        });
      }

      // Send confirmation email to employee (async, non-blocking)
      (async () => {
        try {
          const EmailNotificationService = (await import('../utils/emailNotificationService.js')).default;

          const emailSubject = `Welcome to ${tokenData.organizationName || 'WorkPlus'}! Your Account is Ready`;
          
          const emailHtml = `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <div style="background: linear-gradient(135deg, #28a745 0%, #20c997 100%); padding: 30px; text-align: center; border-radius: 8px 8px 0 0;">
                <h1 style="color: white; margin: 0;">✓ Welcome Aboard!</h1>
              </div>
              
              <div style="padding: 30px; background-color: #f9f9f9; border: 1px solid #e0e0e0; border-radius: 0 0 8px 8px;">
                <p style="font-size: 16px; color: #333; margin-bottom: 20px;">
                  Hi <strong>${personalInfo.firstName} ${personalInfo.lastName}</strong>,
                </p>
                
                <p style="font-size: 14px; color: #666; line-height: 1.6; margin-bottom: 20px;">
                  Congratulations! Your onboarding has been completed successfully. Your employee account is now active and ready to use.
                </p>
                
                <div style="background: #d4edda; border-left: 4px solid #28a745; padding: 15px; margin: 20px 0; border-radius: 4px;">
                  <p style="margin: 0; color: #155724;"><strong>✓ Account Created Successfully</strong></p>
                  <p style="margin: 5px 0 0 0; color: #155724; font-size: 12px;">Your profile has been added to the employee directory.</p>
                </div>
                
                <div style="background: #f0f0f0; padding: 20px; margin: 20px 0; border-radius: 8px;">
                  <h3 style="margin-top: 0; color: #333;">Your Account Details:</h3>
                  <div style="font-size: 14px; color: #666; line-height: 1.8;">
                    <p><strong>Name:</strong> ${personalInfo.firstName} ${personalInfo.lastName}</p>
                    <p><strong>Email:</strong> ${tokenData.employeeEmail}</p>
                    <p><strong>Department:</strong> ${tokenData.department}</p>
                    <p><strong>Organization:</strong> ${tokenData.organizationName || 'WorkPlus'}</p>
                  </div>
                </div>
                
                <div style="text-align: center; margin: 30px 0;">
                  <a href="${process.env.FRONTEND_URL || process.env.CORS_ORIGIN || 'https://hexerve.online'}/login" style="display: inline-block; background-color: #28a745; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; font-weight: bold; font-size: 16px;">
                    Login to Your Account
                  </a>
                </div>
                
                <div style="background: #e7f3ff; border-left: 4px solid #0066cc; padding: 15px; margin: 20px 0; border-radius: 4px;">
                  <p style="margin: 0; color: #004085;"><strong>📋 Next Steps:</strong></p>
                  <ul style="margin: 10px 0 0 0; padding-left: 20px; color: #004085; font-size: 13px;">
                    <li>Log in with your email and password</li>
                    <li>Complete your profile information</li>
                    <li>Review company policies and documents</li>
                    <li>Start tracking your attendance</li>
                  </ul>
                </div>
                
                <p style="font-size: 12px; color: #999; margin-top: 30px;">
                  If you have any questions, please contact our HR team at <a href="mailto:${process.env.HR_EMAIL || process.env.FROM_EMAIL}" style="color: #0066cc; text-decoration: none;">${process.env.HR_EMAIL || process.env.FROM_EMAIL}</a>
                </p>
                
                <p style="font-size: 12px; color: #999; margin-top: 20px;">
                  Best regards,<br>
                  <strong>${tokenData.organizationName || 'WorkPlus'} HR Team</strong>
                </p>
              </div>
            </div>
          `;

          await EmailNotificationService.sendEmail({
            to: tokenData.employeeEmail,
            subject: emailSubject,
            html: emailHtml,
            from: process.env.FROM_EMAIL || process.env.SMTP_USER
          });

          logger.info('Onboarding confirmation email sent successfully', {
            employeeEmail: tokenData.employeeEmail,
            employeeName: `${personalInfo.firstName} ${personalInfo.lastName}`,
            employeeId: employee._id
          });
        } catch (emailError) {
          logger.error('Failed to send onboarding confirmation email', {
            error: emailError.message,
            employeeEmail: tokenData.employeeEmail
          });
          // Don't fail the entire request if email fails - employee is already created
        }
      })();  // Execute immediately but don't await

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

/**
 * POST /api/onboarding/send-email
 * Send onboarding link via email to employee
 * Uses configured SMTP settings to send from HR email
 */
// NOTE: This endpoint is already defined earlier in the file with JWT + Redis support
// Keeping this comment for reference - the earlier implementation is the one being used

export default router;
