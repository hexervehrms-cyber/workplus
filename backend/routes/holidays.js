import express from "express";
import mongoose from "mongoose";
import { asyncHandler } from "../middleware/errorHandler.js";
import Holiday from "../models/Holiday.js";
import HolidayCalendar from "../models/HolidayCalendar.js";

const router = express.Router();

/**
 * GET /api/holidays
 * Get all holidays for organization
 */
router.get("/", asyncHandler(async (req, res) => {
  const orgId = req.user?.orgId || 'system';
  const { year, month, type, page = 1, limit = 50 } = req.query;
  
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
  
  res.json({
    success: true,
    data: holidays,
    pagination: {
      page: parseInt(page),
      limit: parseInt(limit),
      total,
      pages: Math.ceil(total / parseInt(limit))
    }
  });
}));

/**
 * GET /api/holidays/:id
 * Get holiday by ID
 */
router.get("/:id", asyncHandler(async (req, res) => {
  const { id } = req.params;
  const orgId = req.user?.orgId || 'system';
  
  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).json({
      success: false,
      message: "Invalid holiday ID"
    });
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
  
  res.json({
    success: true,
    data: holiday
  });
}));

/**
 * POST /api/holidays
 * Create new holiday
 */
router.post("/", asyncHandler(async (req, res) => {
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
  
  // Emit real-time update
  req.emitHolidayUpdate('created', holiday, orgId);
  
  res.status(201).json({
    success: true,
    message: "Holiday created successfully",
    data: holiday
  });
}));

/**
 * PUT /api/holidays/:id
 * Update holiday
 */
router.put("/:id", asyncHandler(async (req, res) => {
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
  
  res.json({
    success: true,
    message: "Holiday updated successfully",
    data: holiday
  });
}));

/**
 * DELETE /api/holidays/:id
 * Delete holiday
 */
router.delete("/:id", asyncHandler(async (req, res) => {
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
  
  // Emit real-time update
  req.emitHolidayUpdate('deleted', holiday, orgId);
  
  res.json({
    success: true,
    message: "Holiday deleted successfully"
  });
}));

/**
 * GET /api/holidays/upcoming/:days
 * Get upcoming holidays within specified days
 */
router.get("/upcoming/:days", asyncHandler(async (req, res) => {
  const { days } = req.params;
  const orgId = req.user?.orgId || 'system';
  
  const daysAhead = parseInt(days) || 30;
  const today = new Date();
  const futureDate = new Date(today.getTime() + daysAhead * 24 * 60 * 60 * 1000);
  
  const upcomingHolidays = await Holiday.find({
    organizationId: orgId,
    date: { $gte: today, $lte: futureDate }
  })
  .sort({ date: 1 })
  .lean();
  
  res.json({
    success: true,
    data: upcomingHolidays
  });
}));

/**
 * GET /api/holidays/calendar/:year
 * Get holiday calendar for a specific year
 */
router.get("/calendar/:year", asyncHandler(async (req, res) => {
  const { year } = req.params;
  const orgId = req.user?.orgId || 'system';
  
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
  
  res.json({
    success: true,
    data: {
      year: parseInt(year),
      calendar,
      totalHolidays: holidays.length
    }
  });
}));

/**
 * POST /api/holidays/bulk-import
 * Bulk import holidays from predefined templates
 */
router.post("/bulk-import", asyncHandler(async (req, res) => {
  const orgId = req.user?.orgId || 'system';
  const userId = req.user?.userId;
  const { country = 'US', year, includeOptional = false } = req.body;
  
  if (!year) {
    return res.status(400).json({
      success: false,
      message: "Year is required"
    });
  }
  
  // Predefined holiday templates (this would typically come from a service or database)
  const holidayTemplates = {
    US: [
      { name: "New Year's Day", month: 1, day: 1, type: 'public' },
      { name: "Martin Luther King Jr. Day", month: 1, day: 15, type: 'public' }, // Third Monday
      { name: "Presidents' Day", month: 2, day: 19, type: 'public' }, // Third Monday
      { name: "Memorial Day", month: 5, day: 27, type: 'public' }, // Last Monday
      { name: "Independence Day", month: 7, day: 4, type: 'public' },
      { name: "Labor Day", month: 9, day: 2, type: 'public' }, // First Monday
      { name: "Columbus Day", month: 10, day: 14, type: 'optional' }, // Second Monday
      { name: "Veterans Day", month: 11, day: 11, type: 'public' },
      { name: "Thanksgiving Day", month: 11, day: 28, type: 'public' }, // Fourth Thursday
      { name: "Christmas Day", month: 12, day: 25, type: 'public' }
    ],
    IN: [
      { name: "New Year's Day", month: 1, day: 1, type: 'public' },
      { name: "Republic Day", month: 1, day: 26, type: 'public' },
      { name: "Independence Day", month: 8, day: 15, type: 'public' },
      { name: "Gandhi Jayanti", month: 10, day: 2, type: 'public' },
      { name: "Diwali", month: 11, day: 12, type: 'public' }, // Approximate
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