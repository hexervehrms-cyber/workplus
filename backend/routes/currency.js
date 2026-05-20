/**
 * Currency Preference Routes
 * Handles user currency preferences with INR as default
 */

import express from 'express';
import { authenticate, authorize } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import CurrencyPreference from '../models/CurrencyPreference.js';
import Organization from '../models/Organization.js';
import logger from '../utils/logger.js';

const router = express.Router();

// Currency configuration
const CURRENCY_CONFIG = {
  INR: { symbol: '₹', decimalPlaces: 2, name: 'Indian Rupee' },
  USD: { symbol: '$', decimalPlaces: 2, name: 'US Dollar' },
  EUR: { symbol: '€', decimalPlaces: 2, name: 'Euro' },
  GBP: { symbol: '£', decimalPlaces: 2, name: 'British Pound' },
  AUD: { symbol: 'A$', decimalPlaces: 2, name: 'Australian Dollar' },
  CAD: { symbol: 'C$', decimalPlaces: 2, name: 'Canadian Dollar' },
  SGD: { symbol: 'S$', decimalPlaces: 2, name: 'Singapore Dollar' }
};

/**
 * GET /api/currency/preference
 * Get user's currency preference
 */
router.get('/preference', authenticate, asyncHandler(async (req, res) => {
  const userId = req.user.userId;
  const orgId = req.user.orgId;

  let preference = await CurrencyPreference.findOne({ userId }).lean();

  // If no preference exists, create default (INR)
  if (!preference) {
    preference = await CurrencyPreference.create({
      userId,
      orgId,
      currencyCode: 'INR',
      currencySymbol: '₹',
      decimalPlaces: 2
    });
    logger.info('Created default currency preference for user', {
      userId,
      currencyCode: 'INR'
    });
  }

  const config = CURRENCY_CONFIG[preference.currencyCode] || CURRENCY_CONFIG.INR;

  res.json({
    success: true,
    data: {
      ...preference,
      ...config
    }
  });
}));

/**
 * PUT /api/currency/preference
 * Update user's currency preference
 */
router.put('/preference', authenticate, asyncHandler(async (req, res) => {
  const userId = req.user.userId;
  const { currencyCode } = req.body;

  // Validate currency code
  if (!currencyCode || !CURRENCY_CONFIG[currencyCode]) {
    return res.status(400).json({
      success: false,
      message: 'Invalid currency code',
      validCurrencies: Object.keys(CURRENCY_CONFIG)
    });
  }

  const config = CURRENCY_CONFIG[currencyCode];

  const preference = await CurrencyPreference.findOneAndUpdate(
    { userId },
    {
      currencyCode,
      currencySymbol: config.symbol,
      decimalPlaces: config.decimalPlaces,
      updatedAt: new Date()
    },
    { upsert: true, new: true }
  );

  logger.info('Updated currency preference', {
    userId,
    currencyCode
  });

  res.json({
    success: true,
    message: 'Currency preference updated',
    data: {
      ...preference.toObject(),
      ...config
    }
  });
}));

/**
 * GET /api/currency/list
 * Get list of available currencies
 */
router.get('/list', asyncHandler(async (req, res) => {
  const currencies = Object.entries(CURRENCY_CONFIG).map(([code, config]) => ({
    code,
    ...config
  }));

  res.json({
    success: true,
    data: currencies
  });
}));

/**
 * GET /api/currency/org-default
 * Get organization's default currency (admin only)
 */
router.get('/org-default', authorize('super_admin', 'admin', 'hr'), asyncHandler(async (req, res) => {
  const orgId = req.user.orgId;

  let defaultCurrency = 'INR';
  if (orgId) {
    const org = await Organization.findById(orgId).select('settings.currency').lean();
    const orgCode = org?.settings?.currency;
    if (orgCode && CURRENCY_CONFIG[orgCode]) {
      defaultCurrency = orgCode;
    }
  }
  const config = CURRENCY_CONFIG[defaultCurrency];

  res.json({
    success: true,
    data: {
      orgId,
      currencyCode: defaultCurrency,
      ...config
    }
  });
}));

export default router;
