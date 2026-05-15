/**
 * Database Connection Monitor
 * Monitors MongoDB connection health and provides metrics
 */

import mongoose from 'mongoose';
import logger from './logger.js';

class ConnectionMonitor {
  constructor() {
    this.metrics = {
      connectionAttempts: 0,
      connectionFailures: 0,
      connectionSuccesses: 0,
      disconnections: 0,
      queryCount: 0,
      queryErrors: 0,
      averageQueryTime: 0,
      lastConnectionTime: null,
      lastDisconnectionTime: null
    };

    this.queryTimes = [];
    this.maxQueryTimeSamples = 100;
  }

  /**
   * Initialize monitoring
   */
  initialize() {
    // Monitor connection events
    mongoose.connection.on('connected', () => {
      this.metrics.connectionSuccesses++;
      this.metrics.lastConnectionTime = new Date();
      logger.info('✅ MongoDB connected', {
        successes: this.metrics.connectionSuccesses,
        failures: this.metrics.connectionFailures
      });
    });

    mongoose.connection.on('disconnected', () => {
      this.metrics.disconnections++;
      this.metrics.lastDisconnectionTime = new Date();
      logger.warn('⚠️  MongoDB disconnected', {
        disconnections: this.metrics.disconnections
      });
    });

    mongoose.connection.on('error', (err) => {
      this.metrics.connectionFailures++;
      logger.error('❌ MongoDB connection error', {
        error: err.message,
        failures: this.metrics.connectionFailures
      });
    });

    // Monitor query performance
    this.setupQueryMonitoring();
  }

  /**
   * Setup query performance monitoring
   */
  setupQueryMonitoring() {
    const monitor = this;
    mongoose.connection.on('open', () => {
      if (mongoose.Query.prototype._workplusExecPatched) return;
      mongoose.Query.prototype._workplusExecPatched = true;

      const originalExec = mongoose.Query.prototype.exec;
      mongoose.Query.prototype.exec = async function patchedExec(...args) {
        const startTime = Date.now();
        let queryError = null;
        try {
          return await originalExec.apply(this, args);
        } catch (err) {
          queryError = err;
          throw err;
        } finally {
          monitor.recordQueryMetrics(Date.now() - startTime, queryError);
        }
      };
    });
  }

  /**
   * Record query metrics
   */
  recordQueryMetrics(queryTime, error) {
    this.metrics.queryCount++;

    if (error) {
      this.metrics.queryErrors++;
      logger.warn('Query error', {
        queryTime,
        totalQueries: this.metrics.queryCount,
        errors: this.metrics.queryErrors
      });
    }

    // Track query times for average calculation
    this.queryTimes.push(queryTime);
    if (this.queryTimes.length > this.maxQueryTimeSamples) {
      this.queryTimes.shift();
    }

    // Calculate average query time
    this.metrics.averageQueryTime =
      this.queryTimes.reduce((a, b) => a + b, 0) / this.queryTimes.length;

    // Log slow queries (> 1000ms)
    if (queryTime > 1000) {
      logger.warn('Slow query detected', {
        queryTime,
        averageQueryTime: this.metrics.averageQueryTime.toFixed(2)
      });
    }
  }

  /**
   * Get connection status
   */
  getStatus() {
    const readyState = mongoose.connection.readyState;
    const states = {
      0: 'disconnected',
      1: 'connected',
      2: 'connecting',
      3: 'disconnecting'
    };

    return {
      status: states[readyState],
      readyState,
      host: mongoose.connection.host,
      database: mongoose.connection.db?.getName(),
      metrics: this.metrics,
      health: this.calculateHealth()
    };
  }

  /**
   * Calculate connection health score
   */
  calculateHealth() {
    const totalAttempts = this.metrics.connectionSuccesses + this.metrics.connectionFailures;
    const successRate = totalAttempts > 0 ? (this.metrics.connectionSuccesses / totalAttempts) * 100 : 100;
    const errorRate = this.metrics.queryCount > 0 ? (this.metrics.queryErrors / this.metrics.queryCount) * 100 : 0;

    let healthScore = 100;

    // Deduct points for connection failures
    if (successRate < 100) {
      healthScore -= (100 - successRate) * 0.5;
    }

    // Deduct points for query errors
    if (errorRate > 0) {
      healthScore -= errorRate * 0.1;
    }

    // Deduct points for slow queries
    if (this.metrics.averageQueryTime > 500) {
      healthScore -= Math.min(20, (this.metrics.averageQueryTime - 500) / 100);
    }

    return Math.max(0, Math.round(healthScore));
  }

  /**
   * Get detailed metrics
   */
  getMetrics() {
    return {
      ...this.metrics,
      health: this.calculateHealth(),
      queryTimeStats: {
        average: this.metrics.averageQueryTime.toFixed(2),
        min: Math.min(...this.queryTimes),
        max: Math.max(...this.queryTimes),
        samples: this.queryTimes.length
      }
    };
  }

  /**
   * Reset metrics
   */
  reset() {
    this.metrics = {
      connectionAttempts: 0,
      connectionFailures: 0,
      connectionSuccesses: 0,
      disconnections: 0,
      queryCount: 0,
      queryErrors: 0,
      averageQueryTime: 0,
      lastConnectionTime: null,
      lastDisconnectionTime: null
    };
    this.queryTimes = [];
  }
}

// Export singleton instance
export const connectionMonitor = new ConnectionMonitor();

export default connectionMonitor;
