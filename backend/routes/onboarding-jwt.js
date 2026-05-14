/**
 * Employee Onboarding Routes - JWT + Redis Version
 * Uses JWT tokens stored in Redis for secure onboarding link management
 */

import express from 'express';
import bcrypt from 'bcrypt';
import { asyncHandler } from '../middleware/errorHandler.js';
import { authenticate, authorize } from '../middleware/auth.js';
import OnboardingSubmission from '../models/OnboardingSubmission.js';
import User from '../models/User.js';
import Employee from '../models/Employee.js';
import logger from '../utils/logger.js';
import OnboardingTokenManager from '../utils/onboardingTokenManager.js';

const router = express.Router();

/**
 * POST /api/onboarding/generate-link
 * Generate a shareable onboarding link using JWT + Redis
 */
router.post('/generate-link',
  authenticate,
  authorize('super_admin', 'admin', 'hr'),
  asyncHandler(async (req, res) => {
    const { employeeEmail, employeeName, department } = req.body;
    const createdBy = req.user.userId;

    try {
      // Validate required fields
      if (!employeeEmail || !employeeName) {
        return res.status(400).json({
          success: false,
          message: 'Employee email and name are required'
        });
      }

      const finalOrgId = req.user.orgId || 'ORG-DEFAULT';

      logger.info('Generating onboarding link', {
        employeeEmail,
        employeeName,
        finalOrgId,
        createdBy
      });

      // Invalidate any existing active tokens for this employee
      const existingToken = await OnboardingTokenManager.getTokenByEmail(employeeEmail);
      if (existingToken && !existingToken.isUsed) {
        await OnboardingTokenManager.invalidateToken(existingToken.token);
        logger.info('Invalidated existing onboarding token', { employeeEmail });
      }

      // Generate JWT token
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
      const frontendUrl = process.env.FRONTEND_URL || process.env.CORS_ORIGIN || 'https://hexerve.online';
      const onboardingUrl = `${frontendUrl}/onboarding/${jwtToken}`;

      logger.info('Onboarding JWT token generated', {
        employeeEmail,
        employeeName,
        tokenPrefix: jwtToken.substring(0, 20)
      });

      // Send email asynchronously
      (async () => {
        try {
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
            employeeName
          });
        } catch (emailError) {
          logger.error('Failed to send onboarding email', {
            error: emailError.message,
            employeeEmail
          });
        }
      })();

      res.status(201).json({
        success: true,
        message: 'Onboarding link generated successfully',
        data: {
          token: jwtToken,
          employeeEmail,
          employeeName,
          onboardingUrl,
          expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
          createdAt: new Date()
        }
      });

    } catch (error) {
      logger.error('Generate onboarding link error', {
        error: error.message,
        stack: error.stack
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
 * Validate onboarding token
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

      // Get token data
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
      logger.error('Validate onboarding token error', {
        error: error.message
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
 * Submit onboarding form and create employee
 */
router.post('/submit',
  asyncHandler(async (req, res) => {
    const { token, profilePhoto, personalInfo, sensitiveInfo, emergencyContact, educationalDocuments, employmentDocuments, password } = req.body;

    try {
      // Validate token
      const isValid = await OnboardingTokenManager.isTokenValid(token);

      if (!isValid) {
        return res.status(400).json({
          success: false,
          message: 'Invalid or expired onboarding link'
        });
      }

      // Get token data
      const tokenData = await OnboardingTokenManager.getToken(token);

      if (!tokenData) {
        return res.status(404).json({
          success: false,
          message: 'Onboarding link not found'
        });
      }

      // Validate password
      if (!password) {
        return res.status(400).json({
          success: false,
          message: 'Password is required'
        });
      }

      // Create onboarding submission
      const submission = await OnboardingSubmission.create({
        employeeName: tokenData.employeeName,
        email: tokenData.employeeEmail,
        phone: personalInfo?.phone,
        personalInfo,
        sensitiveInfo,
        emergencyContact,
        educationalDocuments,
        employmentDocuments,
        organizationId: tokenData.organizationId,
        status: 'submitted',
        submittedAt: new Date()
      });

      // Hash password
      const hashedPassword = await bcrypt.hash(password, 10);

      // Create user account
      let user = await User.findOne({ email: tokenData.employeeEmail });

      if (!user) {
        user = await User.create({
          name: tokenData.employeeName,
          email: tokenData.employeeEmail,
          password: hashedPassword,
          role: 'employee',
          status: 'active',
          orgId: tokenData.organizationId,
          avatar: profilePhoto || null,
          lastLogin: null,
          isActive: true,
          isVerified: true
        });
      }

      // Create employee profile
      let employee = await Employee.findOne({ userId: user._id, orgId: tokenData.organizationId });

      if (!employee) {
        employee = await Employee.create({
          userId: user._id,
          firstName: personalInfo?.firstName,
          lastName: personalInfo?.lastName,
          department: tokenData.department,
          orgId: tokenData.organizationId,
          status: 'active',
          createdViaOnboarding: true
        });
      }

      // Update submission with IDs
      submission.employeeId = employee._id.toString();
      submission.submittedBy = user._id;
      await submission.save();

      // Mark token as used
      await OnboardingTokenManager.markTokenAsUsed(token);

      logger.info('Onboarding submission completed', {
        submissionId: submission._id,
        userId: user._id,
        employeeId: employee._id,
        employeeEmail: tokenData.employeeEmail
      });

      // Send confirmation email
      (async () => {
        try {
          const EmailNotificationService = (await import('../utils/emailNotificationService.js')).default;

          const emailSubject = `Welcome to ${tokenData.organizationName}! Your Account is Ready`;
          
          const emailHtml = `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <div style="background: linear-gradient(135deg, #28a745 0%, #20c997 100%); padding: 30px; text-align: center; border-radius: 8px 8px 0 0;">
                <h1 style="color: white; margin: 0;">✓ Welcome Aboard!</h1>
              </div>
              
              <div style="padding: 30px; background-color: #f9f9f9; border: 1px solid #e0e0e0; border-radius: 0 0 8px 8px;">
                <p style="font-size: 16px; color: #333; margin-bottom: 20px;">
                  Hi <strong>${personalInfo?.firstName} ${personalInfo?.lastName}</strong>,
                </p>
                
                <p style="font-size: 14px; color: #666; line-height: 1.6; margin-bottom: 20px;">
                  Congratulations! Your onboarding has been completed successfully. Your employee account is now active and ready to use.
                </p>
                
                <div style="background: #d4edda; border-left: 4px solid #28a745; padding: 15px; margin: 20px 0; border-radius: 4px;">
                  <p style="margin: 0; color: #155724;"><strong>✓ Account Created Successfully</strong></p>
                </div>
                
                <div style="text-align: center; margin: 30px 0;">
                  <a href="${process.env.FRONTEND_URL || process.env.CORS_ORIGIN || 'https://hexerve.online'}/login" style="display: inline-block; background-color: #28a745; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; font-weight: bold; font-size: 16px;">
                    Login to Your Account
                  </a>
                </div>
                
                <p style="font-size: 12px; color: #999; margin-top: 30px;">
                  Best regards,<br>
                  <strong>${tokenData.organizationName} HR Team</strong>
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

          logger.info('Onboarding confirmation email sent', {
            employeeEmail: tokenData.employeeEmail
          });
        } catch (emailError) {
          logger.error('Failed to send confirmation email', {
            error: emailError.message
          });
        }
      })();

      res.status(201).json({
        success: true,
        message: 'Onboarding completed successfully',
        data: {
          submissionId: submission._id,
          userId: user._id,
          employeeId: employee._id,
          employeeEmail: tokenData.employeeEmail
        }
      });

    } catch (error) {
      logger.error('Submit onboarding error', {
        error: error.message,
        stack: error.stack
      });
      res.status(500).json({
        success: false,
        message: 'Failed to submit onboarding form'
      });
    }
  })
);

export default router;
