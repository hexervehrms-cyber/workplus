import express from "express";
import mongoose from "mongoose";
import { asyncHandler } from "../middleware/errorHandler.js";
import { authenticate, authorize } from "../middleware/auth.js";
import Holiday from "../models/Holiday.js";
import HolidayCalendar from "../models/HolidayCalendar.js";
import logger from "../utils/logger.js";
import redis from "../utils/redis.js";

const router = express.Router();

// Cache keys
const HOLIDAYS_CACHE_KEY = (orgId, year, month) => `holidays:${orgId}:${year}:${month}`;
const CALENDAR_CACHE_KEY = (orgId, year) => `calendar:${orgId}:${year}`;
const UPCOMING_CACHE_KEY = (orgId, days) => `upcoming:${orgId}:${days}`;

/**
 * GET /api/holidays
 * Get all holidays for organization with caching
 */
router.get("/", authenticate, asyncHandler(async (req, res) => {
  const orgId = req.user?.orgId || 'system';
  const { year, month, type, page = 1, limit = 50 } = req.query;
  
  // Try to get from cache first
  const cacheKey = HOLIDAYS_CACHE_KEY(orgId, year, month);
  let cachedHolidays = null;
  
  try {
    cachedHolidays = await redis.get(cacheKey);
    if (cachedHolidays) {
      logger.info('Holidays retrieved from cache', { orgId, year, month });
      return res.json(JSON.parse(cachedHolidays));
    }
  } catch (cacheError) {
    logger.warn('Cache retrieval failed, falling back to database', { error: cacheError.message });
  }
  
  // If orgId is 'system', also fetch holidays with organizationId 'ORG-001' or without orgId filter
  const filter = { 
    $or: [
      { organizationId: orgId },
      { organizationId: 'ORG-001' },
      { organizationId: { $exists: false } }
    ]
  };
  
  // Filter by year
  if (year) {
    const startDate = new Date(parseInt(year), 0, 1);
    const endDate = new Date(parseInt(year) + 1, 0, 1);
    filter.date = { $gte: startDate, $lt: endDate };
  }
  
  // Filter by month (if year is also provided)
  if (year && month) {
    const startDate = new Date(parseInt(year), parseInt(month) - 1, 1);
    const endDate = new Date(parseInt(year), parseInt(month), 1);
    filter.date = { $gte: startDate, $lt: endDate };
  }
  
  // Filter by type
  if (type) {
    filter.type = type;
  }
  
  const holidays = await Holiday.find(filter)
    .sort({ date: 1 })
    .limit(parseInt(limit))
    .skip((parseInt(page) - 1) * parseInt(limit))
    .lean();
  
  const total = await Holiday.countDocuments(filter);
  
  const response = {
    success: true,
    data: holidays,
    pagination: {
      page: parseInt(page),
      limit: parseInt(limit),
      total,
      pages: Math.ceil(total / parseInt(limit))
    }
  };
  
  // Cache the response for 1 hour
  try {
    await redis.setex(cacheKey, 3600, JSON.stringify(response));
    logger.info('Holidays cached successfully', { orgId, year, month });
  } catch (cacheError) {
    logger.warn('Failed to cache holidays', { error: cacheError.message });
  }
  
  res.json(response);
}));

/**
 * GET /api/holidays/:id
 * Get holiday by ID with caching
 */
router.get("/:id", authenticate, asyncHandler(async (req, res) => {
  const { id } = req.params;
  const orgId = req.user?.orgId || 'system';
  
  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).json({
      success: false,
      message: "Invalid holiday ID"
    });
  }
  
  // Try to get from cache
  const cacheKey = `holiday:${id}`;
  try {
    const cached = await redis.get(cacheKey);
    if (cached) {
      logger.info('Holiday retrieved from cache', { holidayId: id });
      return res.json(JSON.parse(cached));
    }
  } catch (cacheError) {
    logger.warn('Cache retrieval failed', { error: cacheError.message });
  }
  
  // Try to find the holiday with user's orgId
  let holiday = await Holiday.findOne({ _id: id, organizationId: orgId }).lean();
  
  // If not found, try with ORG-001 (fallback)
  if (!holiday) {
    holiday = await Holiday.findOne({ _id: id, organizationId: 'ORG-001' }).lean();
  }
  
  // If still not found, try without orgId filter (for system holidays)
  if (!holiday) {
    holiday = await Holiday.findOne({ _id: id }).lean();
  }
  
  if (!holiday) {
    return res.status(404).json({
      success: false,
      message: "Holiday not found"
    });
  }
  
  const response = {
    success: true,
    data: holiday
  };
  
  // Cache for 1 hour
  try {
    await redis.setex(cacheKey, 3600, JSON.stringify(response));
  } catch (cacheError) {
    logger.warn('Failed to cache holiday', { error: cacheError.message });
  }
  
  res.json(response);
}));

/**
 * POST /api/holidays
 * Create new holiday with authentication and real-time updates
 */
router.post("/", authenticate, authorize('super_admin', 'admin', 'hr'), asyncHandler(async (req, res) => {
  const orgId = req.user?.orgId || 'system';
  const userId = req.user?.userId;
  
  const {
    name,
    date,
    type = 'public',
    description,
    isRecurring = false,
    recurringPattern,
    applicableTo = 'all',
    departments = [],
    isOptional = false
  } = req.body;
  
  // Validate required fields
  if (!name || !date) {
    return res.status(400).json({
      success: false,
      message: "Name and date are required"
    });
  }
  
  // Validate name is string and not empty
  if (typeof name !== 'string' || name.trim().length === 0) {
    return res.status(400).json({
      success: false,
      message: "Holiday name must be a non-empty string"
    });
  }
  
  // Validate date is valid
  const parsedDate = new Date(date);
  if (isNaN(parsedDate.getTime())) {
    return res.status(400).json({
      success: false,
      message: "Invalid date format"
    });
  }
  
  // Validate type is one of allowed values
  const validTypes = ['public', 'optional', 'restricted'];
  if (!validTypes.includes(type)) {
    return res.status(400).json({
      success: false,
      message: `Type must be one of: ${validTypes.join(', ')}`
    });
  }
  
  // Validate description if provided
  if (description && typeof description !== 'string') {
    return res.status(400).json({
      success: false,
      message: "Description must be a string"
    });
  }
  
  // Validate departments array if provided
  if (departments && !Array.isArray(departments)) {
    return res.status(400).json({
      success: false,
      message: "Departments must be an array"
    });
  }
  
  // Check if holiday already exists on this date
  const existingHoliday = await Holiday.findOne({
    organizationId: orgId,
    date: new Date(date),
    name: { $regex: new RegExp(name, 'i') }
  });
  
  if (existingHoliday) {
    return res.status(400).json({
      success: false,
      message: "A holiday with this name already exists on this date"
    });
  }
  
  const holiday = await Holiday.create({
    name: name.trim(),
    date: new Date(date),
    type,
    description: description?.trim(),
    isRecurring,
    organizationId: orgId,
    createdBy: userId
  });
  
  logger.info('Holiday created', { holidayId: holiday._id, orgId, name });
  
  // Clear cache for this organization
  try {
    const year = parsedDate.getFullYear();
    const month = parsedDate.getMonth() + 1;
    await redis.del(HOLIDAYS_CACHE_KEY(orgId, year, month));
    await redis.del(CALENDAR_CACHE_KEY(orgId, year));
    logger.info('Holiday cache cleared', { orgId, year, month });
  } catch (cacheError) {
    logger.warn('Failed to clear cache', { error: cacheError.message });
  }
  
  // Emit real-time update to all employees in organization
  if (req.emitHolidayUpdate) {
    req.emitHolidayUpdate('created', holiday, orgId);
    logger.info('Holiday creation event emitted', { holidayId: holiday._id, orgId });
  }
  
  res.status(201).json({
    success: true,
    message: "Holiday created successfully",
    data: holiday
  });
}));

/**
 * PUT /api/holidays/:id
 * Update holiday with authentication and real-time updates
 */
router.put("/:id", authenticate, authorize('super_admin', 'admin', 'hr'), asyncHandler(async (req, res) => {
  const { id } = req.params;
  const orgId = req.user?.orgId || 'system';
  const userId = req.user?.userId;
  
  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).json({
      success: false,
      message: "Invalid holiday ID"
    });
  }
  
  const {
    name,
    date,
    type,
    description,
    isRecurring,
    recurringPattern,
    applicableTo,
    departments,
    isOptional
  } = req.body;
  
  // Try to find the holiday with user's orgId
  let holiday = await Holiday.findOne({ _id: id, organizationId: orgId });
  
  // If not found, try with ORG-001 (fallback)
  if (!holiday) {
    holiday = await Holiday.findOne({ _id: id, organizationId: 'ORG-001' });
  }
  
  // If still not found, try without orgId filter (for system holidays)
  if (!holiday) {
    holiday = await Holiday.findOne({ _id: id });
  }
  
  if (!holiday) {
    return res.status(404).json({
      success: false,
      message: "Holiday not found"
    });
  }
  
  // Store old date for cache clearing
  const oldDate = new Date(holiday.date);
  
  // Update fields
  if (name) holiday.name = name.trim();
  if (date) holiday.date = new Date(date);
  if (type) holiday.type = type;
  if (description !== undefined) holiday.description = description?.trim();
  if (isRecurring !== undefined) holiday.isRecurring = isRecurring;
  if (recurringPattern) holiday.recurringPattern = recurringPattern;
  if (applicableTo) holiday.applicableTo = applicableTo;
  if (departments) holiday.departments = applicableTo === 'departments' ? departments : [];
  if (isOptional !== undefined) holiday.isOptional = isOptional;
  
  holiday.updatedBy = userId;
  
  await holiday.save();
  
  logger.info('Holiday updated', { holidayId: holiday._id, orgId, name: holiday.name });
  
  // Clear cache for both old and new dates
  try {
    const oldYear = oldDate.getFullYear();
    const oldMonth = oldDate.getMonth() + 1;
    const newYear = holiday.date.getFullYear();
    const newMonth = holiday.date.getMonth() + 1;
    
    await redis.del(HOLIDAYS_CACHE_KEY(orgId, oldYear, oldMonth));
    await redis.del(HOLIDAYS_CACHE_KEY(orgId, newYear, newMonth));
    await redis.del(CALENDAR_CACHE_KEY(orgId, oldYear));
    await redis.del(CALENDAR_CACHE_KEY(orgId, newYear));
    await redis.del(`holiday:${id}`);
    
    logger.info('Holiday cache cleared', { orgId, oldYear, oldMonth, newYear, newMonth });
  } catch (cacheError) {
    logger.warn('Failed to clear cache', { error: cacheError.message });
  }
  
  // Emit real-time update to all employees
  if (req.emitHolidayUpdate) {
    req.emitHolidayUpdate('updated', holiday, orgId);
    logger.info('Holiday update event emitted', { holidayId: holiday._id, orgId });
  }
  
  res.json({
    success: true,
    message: "Holiday updated successfully",
    data: holiday
  });
}));

/**
 * DELETE /api/holidays/:id
 * Delete holiday with authentication and real-time updates
 */
router.delete("/:id", authenticate, authorize('super_admin', 'admin', 'hr'), asyncHandler(async (req, res) => {
  const { id } = req.params;
  const orgId = req.user?.orgId || 'system';
  
  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).json({
      success: false,
      message: "Invalid holiday ID"
    });
  }
  
  // Try to find and delete the holiday
  // First try with the user's orgId
  let holiday = await Holiday.findOneAndDelete({ _id: id, organizationId: orgId });
  
  // If not found, try with ORG-001 (fallback)
  if (!holiday) {
    holiday = await Holiday.findOneAndDelete({ _id: id, organizationId: 'ORG-001' });
  }
  
  // If still not found, try without orgId filter (for system holidays)
  if (!holiday) {
    holiday = await Holiday.findOneAndDelete({ _id: id });
  }
  
  if (!holiday) {
    return res.status(404).json({
      success: false,
      message: "Holiday not found"
    });
  }
  
  logger.info('Holiday deleted', { holidayId: holiday._id, orgId, name: holiday.name });
  
  // Clear cache
  try {
    const year = holiday.date.getFullYear();
    const month = holiday.date.getMonth() + 1;
    await redis.del(HOLIDAYS_CACHE_KEY(orgId, year, month));
    await redis.del(CALENDAR_CACHE_KEY(orgId, year));
    await redis.del(`holiday:${id}`);
    logger.info('Holiday cache cleared', { orgId, year, month });
  } catch (cacheError) {
    logger.warn('Failed to clear cache', { error: cacheError.message });
  }
  
  // Emit real-time update to all employees
  if (req.emitHolidayUpdate) {
    req.emitHolidayUpdate('deleted', holiday, orgId);
    logger.info('Holiday deletion event emitted', { holidayId: holiday._id, orgId });
  }
  
  res.json({
    success: true,
    message: "Holiday deleted successfully"
  });
}));

/**
 * GET /api/holidays/upcoming/:days
 * Get upcoming holidays within specified days with caching
 */
router.get("/upcoming/:days", authenticate, asyncHandler(async (req, res) => {
  const { days } = req.params;
  const orgId = req.user?.orgId || 'system';
  
  const daysAhead = parseInt(days) || 30;
  
  // Try cache first
  const cacheKey = UPCOMING_CACHE_KEY(orgId, daysAhead);
  try {
    const cached = await redis.get(cacheKey);
    if (cached) {
      logger.info('Upcoming holidays retrieved from cache', { orgId, daysAhead });
      return res.json(JSON.parse(cached));
    }
  } catch (cacheError) {
    logger.warn('Cache retrieval failed', { error: cacheError.message });
  }
  
  const today = new Date();
  const futureDate = new Date(today.getTime() + daysAhead * 24 * 60 * 60 * 1000);
  
  const upcomingHolidays = await Holiday.find({
    organizationId: orgId,
    date: { $gte: today, $lte: futureDate }
  })
  .sort({ date: 1 })
  .lean();
  
  const response = {
    success: true,
    data: upcomingHolidays
  };
  
  // Cache for 6 hours
  try {
    await redis.setex(cacheKey, 21600, JSON.stringify(response));
  } catch (cacheError) {
    logger.warn('Failed to cache upcoming holidays', { error: cacheError.message });
  }
  
  res.json(response);
}));

/**
 * GET /api/holidays/calendar/:year
 * Get holiday calendar for a specific year with caching
 */
router.get("/calendar/:year", authenticate, asyncHandler(async (req, res) => {
  const { year } = req.params;
  const orgId = req.user?.orgId || 'system';
  
  // Try cache first
  const cacheKey = CALENDAR_CACHE_KEY(orgId, year);
  try {
    const cached = await redis.get(cacheKey);
    if (cached) {
      logger.info('Calendar retrieved from cache', { orgId, year });
      return res.json(JSON.parse(cached));
    }
  } catch (cacheError) {
    logger.warn('Cache retrieval failed', { error: cacheError.message });
  }
  
  const startDate = new Date(parseInt(year), 0, 1);
  const endDate = new Date(parseInt(year) + 1, 0, 1);
  
  const holidays = await Holiday.find({
    organizationId: orgId,
    date: { $gte: startDate, $lt: endDate }
  })
  .sort({ date: 1 })
  .lean();
  
  // Group holidays by month
  const calendar = {};
  holidays.forEach(holiday => {
    const month = holiday.date.getMonth() + 1;
    if (!calendar[month]) {
      calendar[month] = [];
    }
    calendar[month].push(holiday);
  });
  
  const response = {
    success: true,
    data: {
      year: parseInt(year),
      calendar,
      totalHolidays: holidays.length
    }
  };
  
  // Cache for 24 hours
  try {
    await redis.setex(cacheKey, 86400, JSON.stringify(response));
    logger.info('Calendar cached successfully', { orgId, year });
  } catch (cacheError) {
    logger.warn('Failed to cache calendar', { error: cacheError.message });
  }
  
  res.json(response);
}));

/**
 * POST /api/holidays/bulk-import
 * Bulk import holidays from predefined templates with authentication
 */
router.post("/bulk-import", authenticate, authorize('super_admin', 'admin', 'hr'), asyncHandler(async (req, res) => {
  const orgId = req.user?.orgId || 'system';
  const userId = req.user?.userId;
  const { country = 'US', year, includeOptional = false } = req.body;
  
  if (!year) {
    return res.status(400).json({
      success: false,
      message: "Year is required"
    });
  }
  
  // Predefined holiday templates
  const holidayTemplates = {
    US: [
      { name: "New Year's Day", month: 1, day: 1, type: 'public' },
      { name: "Martin Luther King Jr. Day", month: 1, day: 15, type: 'public' },
      { name: "Presidents' Day", month: 2, day: 19, type: 'public' },
      { name: "Memorial Day", month: 5, day: 27, type: 'public' },
      { name: "Independence Day", month: 7, day: 4, type: 'public' },
      { name: "Labor Day", month: 9, day: 2, type: 'public' },
      { name: "Columbus Day", month: 10, day: 14, type: 'optional' },
      { name: "Veterans Day", month: 11, day: 11, type: 'public' },
      { name: "Thanksgiving Day", month: 11, day: 28, type: 'public' },
      { name: "Christmas Day", month: 12, day: 25, type: 'public' }
    ],
    IN: [
      { name: "New Year's Day", month: 1, day: 1, type: 'public' },
      { name: "Republic Day", month: 1, day: 26, type: 'public' },
      { name: "Independence Day", month: 8, day: 15, type: 'public' },
      { name: "Gandhi Jayanti", month: 10, day: 2, type: 'public' },
      { name: "Diwali", month: 11, day: 12, type: 'public' },
      { name: "Christmas Day", month: 12, day: 25, type: 'public' }
    ]
  };
  
  const templates = holidayTemplates[country] || holidayTemplates.US;
  const holidaysToCreate = [];
  
  for (const template of templates) {
    if (!includeOptional && template.type === 'optional') {
      continue;
    }
    
    const holidayDate = new Date(parseInt(year), template.month - 1, template.day);
    
    // Check if holiday already exists
    const exists = await Holiday.findOne({
      organizationId: orgId,
      date: holidayDate,
      name: { $regex: new RegExp(template.name, 'i') }
    });
    
    if (!exists) {
      holidaysToCreate.push({
        name: template.name,
        date: holidayDate,
        type: template.type,
        description: `${template.name} - ${country} holiday`,
        organizationId: orgId,
        createdBy: userId
      });
    }
  }
  
  if (holidaysToCreate.length === 0) {
    return res.json({
      success: true,
      message: "No new holidays to import",
      data: { imported: 0, skipped: templates.length }
    });
  }
  
  const importedHolidays = await Holiday.insertMany(holidaysToCreate);
  
  logger.info('Holidays bulk imported', { orgId, country, year, count: importedHolidays.length });
  
  // Clear cache for all months of the year
  try {
    for (let month = 1; month <= 12; month++) {
      await redis.del(HOLIDAYS_CACHE_KEY(orgId, year, month));
    }
    await redis.del(CALENDAR_CACHE_KEY(orgId, year));
    logger.info('Holiday cache cleared for bulk import', { orgId, year });
  } catch (cacheError) {
    logger.warn('Failed to clear cache', { error: cacheError.message });
  }
  
  // Emit real-time update for each holiday
  if (req.emitHolidayUpdate) {
    importedHolidays.forEach(holiday => {
      req.emitHolidayUpdate('created', holiday, orgId);
    });
    logger.info('Holiday bulk import events emitted', { orgId, count: importedHolidays.length });
  }
  
  res.json({
    success: true,
    message: `Successfully imported ${importedHolidays.length} holidays`,
    data: {
      imported: importedHolidays.length,
      skipped: templates.length - importedHolidays.length,
      holidays: importedHolidays
    }
  });
}));

export default router;