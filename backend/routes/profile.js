/**
 * Profile Management Routes - Simplified
 * Features:
 * - Get logged-in user profile with completion percentage
 * - Update profile fields individually
 * - Upload avatar with validation
 * - Banking and emergency contact details
 * - Profile completion tracking
 */

import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import bcrypt from 'bcrypt';
import { asyncHandler } from '../middleware/errorHandler.js';
import { authorize } from '../middleware/auth.js';
import User from '../models/User.js';
import Employee from '../models/Employee.js';
import logger from '../utils/logger.js';

const router = express.Router();

// Configure multer for avatar uploads
const avatarStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadDir = 'backend/uploads/avatars';
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, `avatar-${req.user.userId}-${uniqueSuffix}${path.extname(file.originalname)}`);
  }
});

const avatarUpload = multer({
  storage: avatarStorage,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit
  },
  fileFilter: (req, file, cb) => {
    const allowedMimes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only JPEG, PNG, GIF, and WebP are allowed.'));
    }
  }
});

/**
 * Calculate profile completion percentage
 */
function calculateProfileCompletion(user, employee) {
  const fields = [
    { field: user.name, weight: 5 },
    { field: user.email, weight: 5 },
    { field: user.profile?.firstName, weight: 5 },
    { field: user.profile?.lastName, weight: 5 },
    { field: user.profile?.title, weight: 5 },
    { field: user.avatar, weight: 5 },
    { field: user.contact?.phone, weight: 8 },
    { field: user.contact?.mobile, weight: 7 },
    { field: user.contact?.address?.street, weight: 5 },
    { field: user.contact?.address?.city, weight: 5 },
    { field: employee?.designation, weight: 8 },
    { field: employee?.department, weight: 8 },
    { field: employee?.joiningDate, weight: 9 },
    { field: user.contact?.emergencyContact?.name, weight: 5 },
    { field: user.contact?.emergencyContact?.phone, weight: 5 },
    { field: employee?.bankDetails?.accountNumber, weight: 5 },
    { field: employee?.bankDetails?.bankName, weight: 5 }
  ];
  
  let completedWeight = 0;
  let totalWeight = 0;
  
  fields.forEach(({ field, weight }) => {
    totalWeight += weight;
    if (field && field.toString().trim() !== '') {
      completedWeight += weight;
    }
  });
  
  return Math.round((completedWeight / totalWeight) * 100);
}

/**
 * GET /api/profile
 * Get current user's complete profile with completion percentage
 */
router.get('/', authorize('super_admin', 'admin', 'hr', 'manager', 'employee'), asyncHandler(async (req, res) => {
  const userId = req.user.userId;
  const userOrgId = req.user.orgId;

  // Get user profile
  const user = await User.findById(userId)
    .select('-password -security.passwordHistory -security.twoFactorSecret')
    .populate('departmentId', 'name description')
    .populate('managerId', 'name email avatar')
    .populate('roleId', 'name displayName permissions')
    .lean();

  if (!user) {
    return res.status(404).json({
      success: false,
      message: 'User profile not found'
    });
  }

  // Get employee profile if exists
  const employee = await Employee.findOne({ userId, orgId: userOrgId }).lean();

  // Map employeeCode to employeeId for frontend consistency
  if (employee) {
    employee.employeeId = employee.employeeCode;
  }

  // Calculate profile completion
  const completionPercentage = calculateProfileCompletion(user, employee);

  // Get missing fields for completion suggestions
  const missingFields = [];
  if (!user.profile?.firstName) missingFields.push('First Name');
  if (!user.profile?.lastName) missingFields.push('Last Name');
  if (!user.avatar) missingFields.push('Profile Picture');
  if (!user.contact?.phone) missingFields.push('Phone Number');
  if (!user.contact?.address?.street) missingFields.push('Address');
  if (!user.contact?.emergencyContact?.name) missingFields.push('Emergency Contact');
  if (employee && !employee.bankDetails?.accountNumber) missingFields.push('Banking Details');

  res.json({
    success: true,
    data: {
      user,
      employee,
      profileCompletion: {
        percentage: completionPercentage,
        missingFields,
        isComplete: completionPercentage >= 90
      },
      lastUpdated: user.updatedAt
    }
  });
}));

/**
 * PUT /api/profile
 * Update current user's profile with real-time sync
 */
router.put('/', authorize('super_admin', 'admin', 'hr', 'manager', 'employee'), asyncHandler(async (req, res) => {
  const userId = req.user.userId;
  const userOrgId = req.user.orgId;
  
  const {
    profile = {},
    contact = {},
    preferences = {},
    employeeDetails = {},
    sensitiveInfo = {}
  } = req.body;

  // Build update object with individual field updates
  const updateData = {};
  
  if (profile.firstName) updateData['profile.firstName'] = profile.firstName.trim();
  if (profile.lastName) updateData['profile.lastName'] = profile.lastName.trim();
  if (profile.middleName) updateData['profile.middleName'] = profile.middleName.trim();
  if (profile.title) updateData['profile.title'] = profile.title.trim();
  if (profile.bio) updateData['profile.bio'] = profile.bio.trim();
  if (profile.timezone) updateData['profile.timezone'] = profile.timezone;
  if (profile.language) updateData['profile.language'] = profile.language;
  if (profile.dateFormat) updateData['profile.dateFormat'] = profile.dateFormat;
  if (profile.timeFormat) updateData['profile.timeFormat'] = profile.timeFormat;
  
  // Also update the name field for backward compatibility
  if (profile.firstName && profile.lastName) {
    updateData.name = `${profile.firstName.trim()} ${profile.lastName.trim()}`;
  } else if (profile.firstName) {
    updateData.name = profile.firstName.trim();
  } else if (profile.lastName) {
    updateData.name = profile.lastName.trim();
  }
  
  if (contact.phone) updateData['contact.phone'] = contact.phone.trim();
  if (contact.mobile) updateData['contact.mobile'] = contact.mobile.trim();
  
  if (contact.address) {
    if (contact.address.street) updateData['contact.address.street'] = contact.address.street.trim();
    if (contact.address.city) updateData['contact.address.city'] = contact.address.city.trim();
    if (contact.address.state) updateData['contact.address.state'] = contact.address.state.trim();
    if (contact.address.zipCode) updateData['contact.address.zipCode'] = contact.address.zipCode.trim();
    if (contact.address.country) updateData['contact.address.country'] = contact.address.country.trim();
  }
  
  if (contact.emergencyContact) {
    if (contact.emergencyContact.name) updateData['contact.emergencyContact.name'] = contact.emergencyContact.name.trim();
    if (contact.emergencyContact.relationship) updateData['contact.emergencyContact.relationship'] = contact.emergencyContact.relationship.trim();
    if (contact.emergencyContact.phone) updateData['contact.emergencyContact.phone'] = contact.emergencyContact.phone.trim();
  }
  
  if (preferences.notifications) {
    if (preferences.notifications.email !== undefined) updateData['preferences.notifications.email'] = preferences.notifications.email;
    if (preferences.notifications.push !== undefined) updateData['preferences.notifications.push'] = preferences.notifications.push;
    if (preferences.notifications.sms !== undefined) updateData['preferences.notifications.sms'] = preferences.notifications.sms;
    if (preferences.notifications.desktop !== undefined) updateData['preferences.notifications.desktop'] = preferences.notifications.desktop;
  }
  
  if (preferences.dashboard) {
    if (preferences.dashboard.theme) updateData['preferences.dashboard.theme'] = preferences.dashboard.theme;
    if (preferences.dashboard.layout) updateData['preferences.dashboard.layout'] = preferences.dashboard.layout;
  }
  
  if (preferences.privacy) {
    if (preferences.privacy.profileVisibility) updateData['preferences.privacy.profileVisibility'] = preferences.privacy.profileVisibility;
    if (preferences.privacy.showOnlineStatus !== undefined) updateData['preferences.privacy.showOnlineStatus'] = preferences.privacy.showOnlineStatus;
    if (preferences.privacy.allowDirectMessages !== undefined) updateData['preferences.privacy.allowDirectMessages'] = preferences.privacy.allowDirectMessages;
  }

  // Update user
  const updatedUser = await User.findByIdAndUpdate(
    userId,
    updateData,
    { new: true, runValidators: true }
  ).select('-password -security.passwordHistory -security.twoFactorSecret')
   .populate('departmentId', 'name description')
   .populate('managerId', 'name email avatar');

  // Update employee details if provided
  let updatedEmployee = null;
  if (Object.keys(employeeDetails).length > 0 || profile.firstName || profile.lastName || contact.phone || contact.address) {
    const employeeUpdateData = {};
    
    // Update firstName and lastName from profile
    if (profile.firstName) employeeUpdateData.firstName = profile.firstName.trim();
    if (profile.lastName) employeeUpdateData.lastName = profile.lastName.trim();
    
    // Update phone and address from contact
    if (contact.phone) employeeUpdateData.phone = contact.phone.trim();
    if (contact.address) {
      if (typeof contact.address === 'string') {
        employeeUpdateData.address = contact.address.trim();
      } else if (typeof contact.address === 'object' && contact.address !== null) {
        // Frontend sends nested shape: contact.address.street
        const street = contact.address.street;
        if (typeof street === 'string' && street.trim()) {
          employeeUpdateData.address = street.trim();
        }
      }
    }
    
    if (employeeDetails.employeeId) employeeUpdateData.employeeCode = employeeDetails.employeeId.trim();
    if (employeeDetails.joiningDate) employeeUpdateData.joiningDate = new Date(employeeDetails.joiningDate);
    if (employeeDetails.phone) employeeUpdateData.phone = employeeDetails.phone.trim();
    if (employeeDetails.gender !== undefined && employeeDetails.gender !== null) {
      employeeUpdateData.gender = String(employeeDetails.gender).trim();
    }
    if (employeeDetails.dateOfBirth) {
      employeeUpdateData.dateOfBirth = new Date(employeeDetails.dateOfBirth);
    }
    if (employeeDetails.address) employeeUpdateData.address = employeeDetails.address.trim();
    if (employeeDetails.department) employeeUpdateData.department = employeeDetails.department.trim();
    if (employeeDetails.designation) employeeUpdateData.designation = employeeDetails.designation.trim();

    if (employeeDetails.shiftTiming && typeof employeeDetails.shiftTiming === 'object') {
      const st = employeeDetails.shiftTiming;
      employeeUpdateData.shiftTiming = {
        startTime: st.startTime || '09:00',
        endTime: st.endTime || '18:00',
        lateThreshold: Number(st.lateThreshold) || 0,
        workingDays: Array.isArray(st.workingDays) && st.workingDays.length > 0
          ? st.workingDays
          : ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
      };
    }
    
    if (employeeDetails.bankDetails) {
      if (employeeDetails.bankDetails.accountNumber) employeeUpdateData['bankDetails.accountNumber'] = employeeDetails.bankDetails.accountNumber.trim();
      if (employeeDetails.bankDetails.bankName) employeeUpdateData['bankDetails.bankName'] = employeeDetails.bankDetails.bankName.trim();
      if (employeeDetails.bankDetails.ifscCode) employeeUpdateData['bankDetails.ifscCode'] = employeeDetails.bankDetails.ifscCode.trim();
      if (employeeDetails.bankDetails.accountHolderName) employeeUpdateData['bankDetails.accountHolderName'] = employeeDetails.bankDetails.accountHolderName.trim();
    }
    
    updatedEmployee = await Employee.findOneAndUpdate(
      { userId, orgId: userOrgId },
      employeeUpdateData,
      { new: true, runValidators: true }
    );
  }

  // Update sensitive information with lock timestamps
  if (Object.keys(sensitiveInfo).length > 0) {
    const sensitiveUpdateData = {};
    const now = Date.now();
    const lockTimestamps = {};

    if (sensitiveInfo.aadharNumber !== undefined && sensitiveInfo.aadharNumber !== null) {
      sensitiveUpdateData.aadharNumber = sensitiveInfo.aadharNumber.trim();
      lockTimestamps.aadharNumber = now;
    }
    if (sensitiveInfo.panNumber !== undefined && sensitiveInfo.panNumber !== null) {
      sensitiveUpdateData.panNumber = sensitiveInfo.panNumber.trim();
      lockTimestamps.panNumber = now;
    }
    if (sensitiveInfo.bankAccount !== undefined && sensitiveInfo.bankAccount !== null) {
      sensitiveUpdateData.bankAccount = sensitiveInfo.bankAccount.trim();
      lockTimestamps.bankAccount = now;
    }
    if (sensitiveInfo.ifscCode !== undefined && sensitiveInfo.ifscCode !== null) {
      sensitiveUpdateData.ifscCode = sensitiveInfo.ifscCode.trim();
      lockTimestamps.ifscCode = now;
    }

    // Update sensitive info locks with timestamps
    if (Object.keys(lockTimestamps).length > 0) {
      // Merge with existing locks
      const existingEmployee = await Employee.findOne({ userId, orgId: userOrgId });
      const existingLocks = existingEmployee?.sensitiveInfoLocks || {};
      sensitiveUpdateData.sensitiveInfoLocks = {
        ...existingLocks,
        ...lockTimestamps
      };
    }

    updatedEmployee = await Employee.findOneAndUpdate(
      { userId, orgId: userOrgId },
      sensitiveUpdateData,
      { new: true, runValidators: true }
    );

    // Log sensitive information update
    logger.info('Sensitive information updated', {
      userId,
      fields: Object.keys(sensitiveInfo),
      timestamp: new Date()
    });
  }

  // Calculate new completion percentage
  const employee = updatedEmployee || await Employee.findOne({ userId, orgId: userOrgId }).lean();
  const completionPercentage = calculateProfileCompletion(updatedUser.toObject(), employee);

  // REAL-TIME UPDATES: Emit socket events
  if (global.socketManager) {
    global.socketManager.broadcastToOrganization(userOrgId, 'profile_updated', {
      userId,
      userName: updatedUser.name,
      completionPercentage,
      timestamp: new Date()
    });
  }

  // Emit activity log
  if (typeof req.emitActivityUpdate === 'function') {
    req.emitActivityUpdate({
      action: 'profile_update',
      description: 'Profile updated',
      userId: userId,
      orgId: userOrgId,
      severity: 'low',
      category: 'employee'
    }, userOrgId);
  }

  logger.info('Profile updated', { 
    userId, 
    fieldsUpdated: Object.keys(updateData),
    completionPercentage 
  });

  res.json({
    success: true,
    message: 'Profile updated successfully',
    data: {
      user: updatedUser,
      employee: updatedEmployee,
      profileCompletion: {
        percentage: completionPercentage,
        improved: true
      }
    }
  });
}));

/**
 * POST /api/profile/avatar
 * Upload profile avatar with validation and real-time sync
 */
router.post('/avatar', authorize('super_admin', 'admin', 'hr', 'manager', 'employee'), avatarUpload.single('avatar'), asyncHandler(async (req, res) => {
  const userId = req.user.userId;
  const userOrgId = req.user.orgId;

  if (!req.file) {
    return res.status(400).json({
      success: false,
      message: 'No avatar file provided'
    });
  }

  // Get current user to check for existing avatar
  const currentUser = await User.findById(userId).select('avatar');
  
  // Delete old avatar if exists
  if (currentUser.avatar) {
    const oldAvatarPath = path.join(process.cwd(), currentUser.avatar);
    if (fs.existsSync(oldAvatarPath)) {
      try {
        fs.unlinkSync(oldAvatarPath);
        logger.info('Old avatar deleted', { userId, oldPath: oldAvatarPath });
      } catch (error) {
        logger.warn('Failed to delete old avatar', { error: error.message });
      }
    }
  }

  // Update user with new avatar path
  const avatarPath = `uploads/avatars/${req.file.filename}`;
  const updatedUser = await User.findByIdAndUpdate(
    userId,
    { avatar: avatarPath },
    { new: true }
  ).select('name email avatar');

  // REAL-TIME UPDATES: Emit socket events
  if (global.socketManager) {
    global.socketManager.broadcastToOrganization(userOrgId, 'avatar_updated', {
      userId,
      userName: updatedUser.name,
      avatarPath,
      timestamp: new Date()
    });
  }

  // Emit activity log
  if (typeof req.emitActivityUpdate === 'function') {
    req.emitActivityUpdate({
      action: 'avatar_update',
      description: 'Profile picture updated',
      userId: userId,
      orgId: userOrgId,
      severity: 'low',
      category: 'employee'
    }, userOrgId);
  }

  logger.info('Avatar uploaded', { 
    userId, 
    filename: req.file.filename,
    size: req.file.size 
  });

  res.json({
    success: true,
    message: 'Avatar uploaded successfully',
    data: {
      avatarPath,
      user: updatedUser
    }
  });
}));

/**
 * PUT /api/profile/password
 * Change password with security validation
 */
router.put('/password', authorize('super_admin', 'admin', 'hr', 'manager', 'employee'), asyncHandler(async (req, res) => {
  const userId = req.user.userId;
  const userOrgId = req.user.orgId;
  const { currentPassword, newPassword, confirmPassword } = req.body;

  if (!currentPassword || !newPassword || !confirmPassword) {
    return res.status(400).json({
      success: false,
      message: 'Current password, new password, and confirmation are required'
    });
  }

  if (newPassword !== confirmPassword) {
    return res.status(400).json({
      success: false,
      message: 'New password and confirmation do not match'
    });
  }

  if (newPassword.length < 6) {
    return res.status(400).json({
      success: false,
      message: 'New password must be at least 6 characters long'
    });
  }

  // Get user with password
  const user = await User.findById(userId).select('+password');
  
  if (!user) {
    return res.status(404).json({
      success: false,
      message: 'User not found'
    });
  }

  // Verify current password
  const isCurrentPasswordValid = await bcrypt.compare(currentPassword, user.password);
  if (!isCurrentPasswordValid) {
    return res.status(400).json({
      success: false,
      message: 'Current password is incorrect'
    });
  }

  // Hash new password
  const hashedNewPassword = await bcrypt.hash(newPassword, 12);

  // Update password
  await User.findByIdAndUpdate(userId, { password: hashedNewPassword, 'security.passwordLastChanged': new Date() });

  // Emit activity log
  if (typeof req.emitActivityUpdate === 'function') {
    req.emitActivityUpdate({
      action: 'password_change',
      description: 'Password changed',
      userId: userId,
      orgId: userOrgId,
      severity: 'medium',
      category: 'security'
    }, userOrgId);
  }

  logger.info('Password changed', { userId });

  res.json({
    success: true,
    message: 'Password changed successfully'
  });
}));

/**
 * GET /api/profile/completion-suggestions
 * Get suggestions to improve profile completion
 */
router.get('/completion-suggestions', authorize('super_admin', 'admin', 'hr', 'manager', 'employee'), asyncHandler(async (req, res) => {
  const userId = req.user.userId;
  const userOrgId = req.user.orgId;

  const user = await User.findById(userId).lean();
  const employee = await Employee.findOne({ userId, orgId: userOrgId }).lean();

  const suggestions = [];

  if (!user.profile?.firstName) {
    suggestions.push({
      field: 'profile.firstName',
      title: 'Add First Name',
      description: 'Help colleagues identify you better',
      priority: 'high',
      points: 5
    });
  }

  if (!user.profile?.lastName) {
    suggestions.push({
      field: 'profile.lastName',
      title: 'Add Last Name',
      description: 'Complete your professional identity',
      priority: 'high',
      points: 5
    });
  }

  if (!user.avatar) {
    suggestions.push({
      field: 'avatar',
      title: 'Upload Profile Picture',
      description: 'Make your profile more personal and recognizable',
      priority: 'medium',
      points: 5
    });
  }

  if (!user.contact?.phone) {
    suggestions.push({
      field: 'contact.phone',
      title: 'Add Phone Number',
      description: 'Enable colleagues to reach you easily',
      priority: 'high',
      points: 8
    });
  }

  if (!user.contact?.address?.street) {
    suggestions.push({
      field: 'contact.address',
      title: 'Add Address',
      description: 'Complete your contact information',
      priority: 'medium',
      points: 5
    });
  }

  if (!user.contact?.emergencyContact?.name) {
    suggestions.push({
      field: 'contact.emergencyContact',
      title: 'Add Emergency Contact',
      description: 'Important for workplace safety and HR records',
      priority: 'high',
      points: 10
    });
  }

  if (employee && !employee.bankDetails?.accountNumber) {
    suggestions.push({
      field: 'bankDetails',
      title: 'Add Banking Details',
      description: 'Required for salary processing and reimbursements',
      priority: 'high',
      points: 10
    });
  }

  const currentCompletion = calculateProfileCompletion(user, employee);
  const potentialPoints = suggestions.reduce((sum, s) => sum + s.points, 0);
  const potentialCompletion = Math.min(100, currentCompletion + potentialPoints);

  res.json({
    success: true,
    data: {
      currentCompletion,
      potentialCompletion,
      suggestions: suggestions.sort((a, b) => {
        const priorityOrder = { high: 3, medium: 2, low: 1 };
        return priorityOrder[b.priority] - priorityOrder[a.priority];
      }),
      totalSuggestions: suggestions.length
    }
  });
}));

export default router;
