/**
 * Health Check & Monitoring Routes
 * Used by load balancers and monitoring systems
 */

import express from 'express';
import mongoose from 'mongoose';
import os from 'os';
import { connectionMonitor } from '../utils/connectionMonitor.js';

const router = express.Router();

/**
 * GET /health
 * Basic health check for load balancers
 */
router.get('/', (req, res) => {
  const health = {
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'development'
  };
  
  res.status(200).json(health);
});

/**
 * GET /health/detailed
 * Detailed health check with database and system info
 */
router.get('/detailed', async (req, res) => {
  try {
    const dbConnected = mongoose.connection.readyState === 1;
    
    const health = {
      status: dbConnected ? 'healthy' : 'degraded',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      environment: process.env.NODE_ENV || 'development',
      database: {
        connected: dbConnected,
        readyState: mongoose.connection.readyState,
        host: mongoose.connection.host || 'unknown'
      },
      system: {
        memory: {
          total: os.totalmem(),
          free: os.freemem(),
          used: os.totalmem() - os.freemem(),
          percentUsed: ((os.totalmem() - os.freemem()) / os.totalmem() * 100).toFixed(2) + '%'
        },
        cpu: {
          cores: os.cpus().length,
          loadAverage: os.loadavg()
        }
      },
      node: {
        version: process.version,
        pid: process.pid
      }
    };
    
    const statusCode = dbConnected ? 200 : 503;
    res.status(statusCode).json(health);
  } catch (error) {
    res.status(503).json({
      status: 'unhealthy',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * GET /health/ready
 * Readiness check - used by Kubernetes
 */
router.get('/ready', async (req, res) => {
  try {
    // Check database connection
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({
        ready: false,
        reason: 'Database not connected'
      });
    }
    
    // Check memory usage
    const memUsage = (os.totalmem() - os.freemem()) / os.totalmem();
    if (memUsage > 0.9) {
      return res.status(503).json({
        ready: false,
        reason: 'Memory usage too high'
      });
    }
    
    res.status(200).json({
      ready: true,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(503).json({
      ready: false,
      error: error.message
    });
  }
});

/**
 * GET /health/live
 * Liveness check - used by Kubernetes
 */
router.get('/live', (req, res) => {
  res.status(200).json({
    alive: true,
    timestamp: new Date().toISOString()
  });
});

/**
 * GET /health/metrics
 * Detailed metrics for monitoring systems
 */
router.get('/metrics', (req, res) => {
  const connectionStatus = connectionMonitor.getStatus();
  const metrics = connectionMonitor.getMetrics();
  
  res.status(200).json({
    timestamp: new Date().toISOString(),
    connection: connectionStatus,
    metrics,
    system: {
      memory: {
        total: os.totalmem(),
        free: os.freemem(),
        used: os.totalmem() - os.freemem(),
        percentUsed: ((os.totalmem() - os.freemem()) / os.totalmem() * 100).toFixed(2)
      },
      cpu: {
        cores: os.cpus().length,
        loadAverage: os.loadavg()
      },
      uptime: process.uptime()
    }
  });
});

export default router;
