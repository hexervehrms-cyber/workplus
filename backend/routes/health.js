/**
 * Health Check Routes
 * Simple health check endpoints for monitoring and uptime checks
 */

import express from 'express';
import { asyncHandler } from '../middleware/errorHandler.js';
import mongoose from 'mongoose';
import { getDBStatus } from '../config/db.js';
import logger from '../utils/logger.js';

const router = express.Router();

/**
 * GET /health
 * Basic health check (no auth required)
 */
router.get('/', asyncHandler(async (req, res) => {
  const mongoStatus = mongoose.connection.readyState;
  const isConnected = mongoStatus === 1;

  res.json({
    success: true,
    status: isConnected ? 'healthy' : 'degraded',
    database: getDBStatus(),
    timestamp: new Date().toISOString(),
    service: 'WorkPlus Backend'
  });
}));

/**
 * GET /health/db
 * Database connection test
 */
router.get('/db', asyncHandler(async (req, res) => {
  try {
    const mongoStatus = mongoose.connection.readyState;
    const isConnected = mongoStatus === 1;

    res.json({
      success: isConnected,
      status: isConnected ? 'connected' : 'disconnected',
      readyState: mongoStatus,
      connection: {
        host: mongoose.connection.host || 'N/A',
        port: mongoose.connection.port || 'N/A',
        name: mongoose.connection.name || 'N/A'
      }
    });
  } catch (error) {
    logger.error('Health check DB error', { error: error.message });
    res.status(500).json({
      success: false,
      status: 'error',
      message: error.message
    });
  }
}));

export default router;
