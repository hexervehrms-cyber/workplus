/**
 * Leave Type Settings Routes
 * Manages which leave types are enabled/disabled for the organization
 */

import express from 'express';
import LeaveTypeSettings from '../models/LeaveTypeSettings.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import logger from '../utils/logger.js';

const router = express.Router();

/**
 * GET /api/leave-type-settings/:orgId
 * Get leave type settings for organization
 */
router.get('/:orgId', asyncHandler(async (req, res) => {
  const { orgId } = req.params;

  let settings = await LeaveTypeSettings.findOne({ orgId });

  if (!settings) {
    // Create default settings if not found
    settings = await LeaveTypeSettings.create({
      orgId,
      enabledLeaveTypes: {
        vacation: true,
        sickLeave: true,
        casualLeave: true,
        earnedLeave: true,
        medicalLeave: true,
        maternityLeave: false,
        paternityLeave: false,
        compensatoryOff: true,
        personal: false,
        emergency: false,
        ncns: false,
        sandwichLeave: false
      }
    });
  }

  res.json({
    success: true,
    data: settings
  });
}));

/**
 * PUT /api/leave-type-settings/:orgId
 * Update leave type settings for organization
 */
router.put('/:orgId', asyncHandler(async (req, res) => {
  const { orgId } = req.params;
  const { enabledLeaveTypes, updatedBy } = req.body;

  if (!enabledLeaveTypes) {
    return res.status(400).json({
      success: false,
      message: 'enabledLeaveTypes is required'
    });
  }

  let settings = await LeaveTypeSettings.findOne({ orgId });

  if (!settings) {
    settings = await LeaveTypeSettings.create({
      orgId,
      enabledLeaveTypes,
      updatedBy,
      updatedAt: new Date()
    });
  } else {
    settings.enabledLeaveTypes = enabledLeaveTypes;
    settings.updatedBy = updatedBy;
    settings.updatedAt = new Date();
    await settings.save();
  }

  logger.info('Leave type settings updated', {
    orgId,
    updatedBy,
    enabledLeaveTypes
  });

  res.json({
    success: true,
    message: 'Leave type settings updated successfully',
    data: settings
  });
}));

/**
 * GET /api/leave-type-settings/:orgId/enabled
 * Get only enabled leave types for organization
 */
router.get('/:orgId/enabled', asyncHandler(async (req, res) => {
  const { orgId } = req.params;

  let settings = await LeaveTypeSettings.findOne({ orgId });

  if (!settings) {
    settings = await LeaveTypeSettings.create({
      orgId,
      enabledLeaveTypes: {
        vacation: true,
        sickLeave: true,
        casualLeave: true,
        earnedLeave: true,
        medicalLeave: true,
        maternityLeave: false,
        paternityLeave: false,
        compensatoryOff: true,
        personal: false,
        emergency: false,
        ncns: false,
        sandwichLeave: false
      }
    });
  }

  // Filter only enabled leave types
  const enabledLeaveTypes = Object.keys(settings.enabledLeaveTypes).filter(
    key => settings.enabledLeaveTypes[key] === true
  );

  res.json({
    success: true,
    data: {
      enabledLeaveTypes,
      settings: settings.enabledLeaveTypes
    }
  });
}));

export default router;
