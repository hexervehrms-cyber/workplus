/**
 * Health Check Routes - Production Grade
 * Provides comprehensive system health monitoring
 */

import express from 'express';
import mongoose from 'mongoose';
import { asyncHandler } from '../middleware/errorHandler.js';
import logger from '../utils/logger.js';

const router = express.Router();

/**
 * GET /health
 * Basic health check endpoint
 */
router.get('/', asyncHandler(async (req, res) => {
  const startTime = Date.now();
  
  // Check database connection
  let dbStatus = 'disconnected';
  let dbLatency = null;
  
  try {
    const dbStart = Date.now();
    await mongoose.connection.db.admin().ping();
    dbLatency = Date.now() - dbStart;
    dbStatus = 'connected';
  } catch (error) {
    logger.error('Health check DB ping failed:', error.message);
    dbStatus = 'error';
  }

  const health = {
    status: dbStatus === 'connected' ? 'ok' : 'degraded',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    database: dbStatus,
    dbLatency: dbLatency,
    memory: {
      used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
      total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024),
      external: Math.round(process.memoryUsage().external / 1024 / 1024)
    },
    responseTime: Date.now() - startTime,
    environment: process.env.NODE_ENV || 'development',
    version: process.env.npm_package_version || '1.0.0'
  };

  // Return appropriate status code
  const statusCode = health.status === 'ok' ? 200 : 503;
  
  res.status(statusCode).json({
    success: health.status === 'ok',
    data: health
  });
}));

/**
 * GET /health/db
 * Database-specific health check
 */
router.get('/db', asyncHandler(async (req, res) => {
  try {
    const startTime = Date.now();
    
    // Test database operations
    const pingResult = await mongoose.connection.db.admin().ping();
    const dbStats = await mongoose.connection.db.stats();
    
    const dbHealth = {
      status: 'connected',
      latency: Date.now() - startTime,
      collections: dbStats.collections,
      dataSize: Math.round(dbStats.dataSize / 1024 / 1024), // MB
      indexSize: Math.round(dbStats.indexSize / 1024 / 1024), // MB
      connectionState: mongoose.connection.readyState,
      connectionStates: {
        0: 'disconnected',
        1: 'connected',
        2: 'connecting',
        3: 'disconnecting'
      }
    };

    res.json({
      success: true,
      data: dbHealth
    });
  } catch (error) {
    logger.error('Database health check failed:', error.message);
    
    res.status(503).json({
      success: false,
      message: 'Database health check failed',
      error: error.message,
      data: {
        status: 'error',
        connectionState: mongoose.connection.readyState
      }
    });
  }
}));

/**
 * GET /health/full
 * Comprehensive system health check
 */
router.get('/full', asyncHandler(async (req, res) => {
  const startTime = Date.now();
  const checks = {};
  let overallStatus = 'ok';

  // Database check
  try {
    const dbStart = Date.now();
    await mongoose.connection.db.admin().ping();
    checks.database = {
      status: 'ok',
      latency: Date.now() - dbStart,
      message: 'Database connection healthy'
    };
  } catch (error) {
    checks.database = {
      status: 'error',
      message: error.message
    };
    overallStatus = 'degraded';
  }

  // Memory check
  const memUsage = process.memoryUsage();
  const memUsedMB = Math.round(memUsage.heapUsed / 1024 / 1024);
  const memTotalMB = Math.round(memUsage.heapTotal / 1024 / 1024);
  const memUsagePercent = Math.round((memUsedMB / memTotalMB) * 100);

  checks.memory = {
    status: memUsagePercent > 90 ? 'warning' : 'ok',
    used: memUsedMB,
    total: memTotalMB,
    percentage: memUsagePercent,
    message: memUsagePercent > 90 ? 'High memory usage' : 'Memory usage normal'
  };

  if (checks.memory.status === 'warning' && overallStatus === 'ok') {
    overallStatus = 'warning';
  }

  // Environment check
  const requiredEnvVars = ['JWT_SECRET', 'MONGODB_URI'];
  const missingEnvVars = requiredEnvVars.filter(envVar => !process.env[envVar]);
  
  checks.environment = {
    status: missingEnvVars.length > 0 ? 'error' : 'ok',
    missing: missingEnvVars,
    message: missingEnvVars.length > 0 
      ? `Missing environment variables: ${missingEnvVars.join(', ')}`
      : 'All required environment variables present'
  };

  if (checks.environment.status === 'error') {
    overallStatus = 'error';
  }

  const healthReport = {
    status: overallStatus,
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    responseTime: Date.now() - startTime,
    checks,
    system: {
      nodeVersion: process.version,
      platform: process.platform,
      arch: process.arch,
      pid: process.pid
    }
  };

  const statusCode = overallStatus === 'ok' ? 200 : 
                    overallStatus === 'warning' ? 200 : 503;

  res.status(statusCode).json({
    success: overallStatus !== 'error',
    data: healthReport
  });
}));

export default router;