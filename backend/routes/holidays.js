import express from "express";
import mongoose from "mongoose";
import { asyncHandler } from "../middleware/errorHandler.js";
import { authenticate, authorize } from "../middleware/auth.js";
import Holiday from "../models/Holiday.js";
import logger from "../utils/logger.js";
import redis from "../utils/redis.js";
import {
  holidayOrgReadFilter,
  resolveHolidayOrgIdForRequest,
} from "../utils/orgScopeHelpers.js";
import { enforceOrgIdInQuery } from "../middleware/orgIdValidation.js";

const router = express.Router();

router.use(enforceOrgIdInQuery);

const HOLIDAYS_CACHE_KEY = (orgId, year, month) => `holidays:${orgId}:${year}:${month}`;
const CALENDAR_CACHE_KEY = (orgId, year) => `calendar:${orgId}:${year}`;
const UPCOMING_CACHE_KEY = (orgId, days) => `upcoming:${orgId}:${days}`;

function requireHolidayOrgId(req, res) {
  const orgId = resolveHolidayOrgIdForRequest(req);
  const scoped = orgId != null ? String(orgId).trim() : "";
  if (!scoped) {
    res.status(400).json({
      success: false,
      message:
        "orgId is required. Link your account to an organization or pass orgId (super admin).",
      code: "MISSING_ORG_CONTEXT"
    });
    return null;
  }
  return scoped;
}

async function findHolidayForOrg(id, orgId) {
  return Holiday.findOne({
    _id: id,
    ...holidayOrgReadFilter(orgId)
  });
}

/**
 * GET /api/holidays
 */
router.get("/", authenticate, asyncHandler(async (req, res) => {
  const orgId = requireHolidayOrgId(req, res);
  if (!orgId) return;

  const { year, month, type, page = 1, limit = 50 } = req.query;

  const cacheKey = HOLIDAYS_CACHE_KEY(orgId, year, month);
  try {
    const cachedHolidays = await redis.get(cacheKey);
    if (cachedHolidays) {
      return res.json(cachedHolidays);
    }
  } catch (cacheError) {
    logger.warn("Cache retrieval failed, falling back to database", {
      error: cacheError.message
    });
  }

  const filter = { ...holidayOrgReadFilter(orgId) };

  if (year) {
    const startDate = new Date(parseInt(year, 10), 0, 1);
    const endDate = new Date(parseInt(year, 10) + 1, 0, 1);
    filter.date = { $gte: startDate, $lt: endDate };
  }

  if (year && month) {
    const startDate = new Date(parseInt(year, 10), parseInt(month, 10) - 1, 1);
    const endDate = new Date(parseInt(year, 10), parseInt(month, 10), 1);
    filter.date = { $gte: startDate, $lt: endDate };
  }

  if (type) {
    filter.type = type;
  }

  const holidays = await Holiday.find(filter)
    .sort({ date: 1 })
    .limit(parseInt(limit, 10))
    .skip((parseInt(page, 10) - 1) * parseInt(limit, 10))
    .lean();

  const total = await Holiday.countDocuments(filter);

  const response = {
    success: true,
    data: holidays,
    pagination: {
      page: parseInt(page, 10),
      limit: parseInt(limit, 10),
      total,
      pages: Math.ceil(total / parseInt(limit, 10))
    }
  };

  try {
    await redis.set(cacheKey, response, 3600);
  } catch (cacheError) {
    logger.warn("Failed to cache holidays", { error: cacheError.message });
  }

  res.json(response);
}));

/**
 * GET /api/holidays/upcoming/:days
 */
router.get("/upcoming/:days", authenticate, asyncHandler(async (req, res) => {
  const orgId = requireHolidayOrgId(req, res);
  if (!orgId) return;

  const daysAhead = parseInt(req.params.days, 10) || 30;
  const cacheKey = UPCOMING_CACHE_KEY(orgId, daysAhead);

  try {
    const cached = await redis.get(cacheKey);
    if (cached) {
      return res.json(cached);
    }
  } catch (cacheError) {
    logger.warn("Cache retrieval failed", { error: cacheError.message });
  }

  const today = new Date();
  const futureDate = new Date(today.getTime() + daysAhead * 24 * 60 * 60 * 1000);

  const upcomingHolidays = await Holiday.find({
    ...holidayOrgReadFilter(orgId),
    date: { $gte: today, $lte: futureDate }
  })
    .sort({ date: 1 })
    .lean();

  const response = { success: true, data: upcomingHolidays };

  try {
    await redis.set(cacheKey, response, 21600);
  } catch (cacheError) {
    logger.warn("Failed to cache upcoming holidays", { error: cacheError.message });
  }

  res.json(response);
}));

/**
 * GET /api/holidays/calendar/:year
 */
router.get("/calendar/:year", authenticate, asyncHandler(async (req, res) => {
  const orgId = requireHolidayOrgId(req, res);
  if (!orgId) return;

  const { year } = req.params;
  const cacheKey = CALENDAR_CACHE_KEY(orgId, year);

  try {
    const cached = await redis.get(cacheKey);
    if (cached) {
      return res.json(cached);
    }
  } catch (cacheError) {
    logger.warn("Cache retrieval failed", { error: cacheError.message });
  }

  const startDate = new Date(parseInt(year, 10), 0, 1);
  const endDate = new Date(parseInt(year, 10) + 1, 0, 1);

  const holidays = await Holiday.find({
    ...holidayOrgReadFilter(orgId),
    date: { $gte: startDate, $lt: endDate }
  })
    .sort({ date: 1 })
    .lean();

  const calendar = {};
  holidays.forEach((holiday) => {
    const month = holiday.date.getMonth() + 1;
    if (!calendar[month]) {
      calendar[month] = [];
    }
    calendar[month].push(holiday);
  });

  const response = {
    success: true,
    data: {
      year: parseInt(year, 10),
      calendar,
      totalHolidays: holidays.length
    }
  };

  try {
    await redis.set(cacheKey, response, 86400);
  } catch (cacheError) {
    logger.warn("Failed to cache calendar", { error: cacheError.message });
  }

  res.json(response);
}));

/**
 * POST /api/holidays/calendars/:calendarId/publish
 * Client-generated calendar ids (e.g. cal_2026) — marks published for the org.
 */
router.post(
  "/calendars/:calendarId/publish",
  authenticate,
  authorize("super_admin", "admin", "hr"),
  asyncHandler(async (req, res) => {
    const orgId = requireHolidayOrgId(req, res);
    if (!orgId) return;
    res.json({
      success: true,
      message: "Calendar published successfully",
      data: { calendarId: req.params.calendarId, orgId },
    });
  })
);

/**
 * GET /api/holidays/calendars/:calendarId/download
 * CSV export for holidays in the calendar year (parsed from calendarId when possible).
 */
router.get(
  "/calendars/:calendarId/download",
  authenticate,
  authorize("super_admin", "admin", "hr"),
  asyncHandler(async (req, res) => {
    const orgId = requireHolidayOrgId(req, res);
    if (!orgId) return;

    const id = String(req.params.calendarId || "");
    const yearMatch = id.match(/(\d{4})/);
    const year = yearMatch
      ? parseInt(yearMatch[1], 10)
      : parseInt(req.query.year, 10) || new Date().getFullYear();

    const startDate = new Date(year, 0, 1);
    const endDate = new Date(year + 1, 0, 1);

    const holidays = await Holiday.find({
      ...holidayOrgReadFilter(orgId),
      date: { $gte: startDate, $lt: endDate },
    })
      .sort({ date: 1 })
      .lean();

    const headers = ["Name", "Date", "Type", "Description", "Recurring"];
    const rows = holidays.map((h) => [
      h.name || "",
      h.date ? new Date(h.date).toISOString().split("T")[0] : "",
      h.type || "",
      h.description || "",
      h.isRecurring ? "yes" : "no",
    ]);
    const csv = [
      headers.join(","),
      ...rows.map((row) =>
        row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(",")
      ),
    ].join("\n");

    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="holiday-calendar-${year}.csv"`
    );
    res.send(csv);
  })
);

/**
 * POST /api/holidays
 */
router.post("/", authenticate, authorize("super_admin", "admin", "hr"), asyncHandler(async (req, res) => {
  const orgId = requireHolidayOrgId(req, res);
  if (!orgId) return;

  const userId = req.user?.userId;
  const {
    name,
    date,
    type = "public",
    description,
    isRecurring = false
  } = req.body;

  if (!name || !date) {
    return res.status(400).json({
      success: false,
      message: "Name and date are required"
    });
  }

  const parsedDate = new Date(date);
  if (Number.isNaN(parsedDate.getTime())) {
    return res.status(400).json({
      success: false,
      message: "Invalid date format"
    });
  }

  const existingHoliday = await Holiday.findOne({
    ...holidayOrgReadFilter(orgId),
    date: parsedDate,
    name: { $regex: new RegExp(name, "i") }
  });

  if (existingHoliday) {
    return res.status(400).json({
      success: false,
      message: "A holiday with this name already exists on this date"
    });
  }

  const scopedOrgId = String(orgId).trim();
  if (!scopedOrgId) {
    return res.status(400).json({
      success: false,
      message: "orgId is required",
      code: "MISSING_ORG_CONTEXT",
    });
  }

  let holiday;
  try {
    holiday = await Holiday.create({
      name: name.trim(),
      date: parsedDate,
      type,
      description: description?.trim(),
      isRecurring: Boolean(isRecurring),
      orgId: scopedOrgId,
      organizationId: scopedOrgId,
      createdBy: userId,
    });
  } catch (err) {
    if (err?.name === "ValidationError") {
      return res.status(400).json({
        success: false,
        message: err.message || "Holiday validation failed",
        code: "VALIDATION_ERROR",
      });
    }
    throw err;
  }

  logger.info("Holiday created", { holidayId: holiday._id, orgId: scopedOrgId, name });

  if (req.emitHolidayUpdate) {
    req.emitHolidayUpdate("created", holiday, scopedOrgId);
  }

  try {
    const y = parsedDate.getFullYear();
    const month = parsedDate.getMonth() + 1;
    await redis.del(HOLIDAYS_CACHE_KEY(orgId, y, month));
    await redis.del(CALENDAR_CACHE_KEY(orgId, y));
  } catch (cacheError) {
    logger.warn("Failed to clear cache", { error: cacheError.message });
  }

  res.status(201).json({
    success: true,
    message: "Holiday created successfully",
    data: holiday
  });
}));

/**
 * POST /api/holidays/bulk-import
 */
router.post("/bulk-import", authenticate, authorize("super_admin", "admin", "hr"), asyncHandler(async (req, res) => {
  const orgId = requireHolidayOrgId(req, res);
  if (!orgId) return;

  const userId = req.user?.userId;
  const { country = "US", year, includeOptional = false } = req.body;

  if (!year) {
    return res.status(400).json({
      success: false,
      message: "Year is required"
    });
  }

  const holidayTemplates = {
    US: [
      { name: "New Year's Day", month: 1, day: 1, type: "public" },
      { name: "Independence Day", month: 7, day: 4, type: "public" },
      { name: "Christmas Day", month: 12, day: 25, type: "public" }
    ],
    IN: [
      { name: "Republic Day", month: 1, day: 26, type: "public" },
      { name: "Independence Day", month: 8, day: 15, type: "public" },
      { name: "Christmas Day", month: 12, day: 25, type: "public" }
    ]
  };

  const templates = holidayTemplates[country] || holidayTemplates.US;
  const holidaysToCreate = [];
  const scopedOrgId = String(orgId).trim();
  if (!scopedOrgId) {
    return res.status(400).json({
      success: false,
      message: "orgId is required",
      code: "MISSING_ORG_CONTEXT",
    });
  }

  for (const template of templates) {
    if (!includeOptional && template.type === "optional") {
      continue;
    }

    const holidayDate = new Date(parseInt(year, 10), template.month - 1, template.day);

    const exists = await Holiday.findOne({
      ...holidayOrgReadFilter(orgId),
      date: holidayDate,
      name: { $regex: new RegExp(template.name, "i") }
    });

    if (!exists) {
      holidaysToCreate.push({
        name: template.name,
        date: holidayDate,
        type: template.type,
        description: `${template.name} - ${country} holiday`,
        orgId: scopedOrgId,
        organizationId: scopedOrgId,
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

  try {
    for (let m = 1; m <= 12; m++) {
      await redis.del(HOLIDAYS_CACHE_KEY(orgId, year, m));
    }
    await redis.del(CALENDAR_CACHE_KEY(orgId, year));
  } catch (cacheError) {
    logger.warn("Failed to clear cache after bulk import", { error: cacheError.message });
  }

  res.json({
    success: true,
    message: `Imported ${importedHolidays.length} holidays`,
    data: { imported: importedHolidays.length }
  });
}));

/**
 * GET /api/holidays/:id
 */
router.get("/:id", authenticate, asyncHandler(async (req, res) => {
  const { id } = req.params;
  const orgId = requireHolidayOrgId(req, res);
  if (!orgId) return;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).json({
      success: false,
      message: "Invalid holiday ID"
    });
  }

  const cacheKey = `holiday:${id}:${orgId}`;
  try {
    const cached = await redis.get(cacheKey);
    if (cached) {
      return res.json(cached);
    }
  } catch (cacheError) {
    logger.warn("Cache retrieval failed", { error: cacheError.message });
  }

  const holiday = await findHolidayForOrg(id, orgId).lean();
  if (!holiday) {
    return res.status(404).json({
      success: false,
      message: "Holiday not found"
    });
  }

  const response = { success: true, data: holiday };

  try {
    await redis.set(cacheKey, response, 3600);
  } catch (cacheError) {
    logger.warn("Failed to cache holiday", { error: cacheError.message });
  }

  res.json(response);
}));

/**
 * PUT /api/holidays/:id
 */
router.put("/:id", authenticate, authorize("super_admin", "admin", "hr"), asyncHandler(async (req, res) => {
  const { id } = req.params;
  const orgId = requireHolidayOrgId(req, res);
  if (!orgId) return;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).json({
      success: false,
      message: "Invalid holiday ID"
    });
  }

  const holiday = await findHolidayForOrg(id, orgId);
  if (!holiday) {
    return res.status(404).json({
      success: false,
      message: "Holiday not found"
    });
  }

  const { name, date, type, description, isRecurring } = req.body;
  const oldDate = new Date(holiday.date);

  if (name) holiday.name = name.trim();
  if (date) holiday.date = new Date(date);
  if (type) holiday.type = type;
  if (description !== undefined) holiday.description = description?.trim();
  if (isRecurring !== undefined) holiday.isRecurring = isRecurring;
  const scopedOrgId = String(orgId).trim();
  if (!holiday.orgId) holiday.orgId = scopedOrgId;
  holiday.organizationId = scopedOrgId;

  await holiday.save();

  if (req.emitHolidayUpdate) {
    req.emitHolidayUpdate("updated", holiday, scopedOrgId);
  }

  try {
    await redis.del(HOLIDAYS_CACHE_KEY(orgId, oldDate.getFullYear(), oldDate.getMonth() + 1));
    await redis.del(
      HOLIDAYS_CACHE_KEY(orgId, holiday.date.getFullYear(), holiday.date.getMonth() + 1)
    );
    await redis.del(CALENDAR_CACHE_KEY(orgId, oldDate.getFullYear()));
    await redis.del(CALENDAR_CACHE_KEY(orgId, holiday.date.getFullYear()));
    await redis.del(`holiday:${id}:${orgId}`);
  } catch (cacheError) {
    logger.warn("Failed to clear cache", { error: cacheError.message });
  }

  res.json({
    success: true,
    message: "Holiday updated successfully",
    data: holiday
  });
}));

/**
 * DELETE /api/holidays/:id
 */
router.delete("/:id", authenticate, authorize("super_admin", "admin", "hr"), asyncHandler(async (req, res) => {
  const { id } = req.params;
  const orgId = requireHolidayOrgId(req, res);
  if (!orgId) return;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).json({
      success: false,
      message: "Invalid holiday ID"
    });
  }

  const holiday = await Holiday.findOneAndDelete({
    _id: id,
    ...holidayOrgReadFilter(orgId)
  });

  if (!holiday) {
    return res.status(404).json({
      success: false,
      message: "Holiday not found"
    });
  }

  try {
    const year = holiday.date.getFullYear();
    const month = holiday.date.getMonth() + 1;
    await redis.del(HOLIDAYS_CACHE_KEY(orgId, year, month));
    await redis.del(CALENDAR_CACHE_KEY(orgId, year));
    await redis.del(`holiday:${id}:${orgId}`);
  } catch (cacheError) {
    logger.warn("Failed to clear cache", { error: cacheError.message });
  }

  res.json({
    success: true,
    message: "Holiday deleted successfully"
  });
}));

export default router;
