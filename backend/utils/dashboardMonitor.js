/**
 * Dashboard Performance Monitor
 * Tracks performance metrics, errors, and health of dashboard endpoints
 * Provides alerts and automatic recovery mechanisms
 */

class DashboardMonitor {
  constructor() {
    this.metrics = new Map();
    this.errors = new Map();
    this.alerts = [];
    this.thresholds = {
      responseTime: 5000, // 5 seconds
      errorRate: 0.1, // 10%
      cacheHitRate: 0.5 // 50%
    };
  }

  /**
   * Record endpoint performance
   */
  recordMetric(endpoint, orgId, responseTime, cached = false, success = true) {
    const key = `${endpoint}:${orgId}`;
    
    if (!this.metrics.has(key)) {
      this.metrics.set(key, {
        endpoint,
        orgId,
        totalRequests: 0,
        successfulRequests: 0,
        failedRequests: 0,
        totalResponseTime: 0,
        cachedRequests: 0,
        avgResponseTime: 0,
        errorRate: 0,
        cacheHitRate: 0,
        lastUpdated: Date.now(),
        history: []
      });
    }

    const metric = this.metrics.get(key);
    metric.totalRequests++;
    metric.totalResponseTime += responseTime;
    metric.avgResponseTime = metric.totalResponseTime / metric.totalRequests;
    
    if (success) {
      metric.successfulRequests++;
    } else {
      metric.failedRequests++;
    }

    if (cached) {
      metric.cachedRequests++;
    }

    metric.errorRate = metric.failedRequests / metric.totalRequests;
    metric.cacheHitRate = metric.cachedRequests / metric.totalRequests;
    metric.lastUpdated = Date.now();

    // Keep last 100 requests in history
    metric.history.push({
      timestamp: Date.now(),
      responseTime,
      cached,
      success
    });
    if (metric.history.length > 100) {
      metric.history.shift();
    }

    // Check thresholds and generate alerts
    this.checkThresholds(key, metric);
  }

  /**
   * Check if metrics exceed thresholds
   */
  checkThresholds(key, metric) {
    const alerts = [];

    if (metric.avgResponseTime > this.thresholds.responseTime) {
      alerts.push({
        type: 'SLOW_RESPONSE',
        severity: 'warning',
        message: `${metric.endpoint} average response time is ${metric.avgResponseTime.toFixed(0)}ms (threshold: ${this.thresholds.responseTime}ms)`,
        metric: key,
        value: metric.avgResponseTime,
        timestamp: Date.now()
      });
    }

    if (metric.errorRate > this.thresholds.errorRate) {
      alerts.push({
        type: 'HIGH_ERROR_RATE',
        severity: 'critical',
        message: `${metric.endpoint} error rate is ${(metric.errorRate * 100).toFixed(1)}% (threshold: ${this.thresholds.errorRate * 100}%)`,
        metric: key,
        value: metric.errorRate,
        timestamp: Date.now()
      });
    }

    if (metric.cacheHitRate < this.thresholds.cacheHitRate && metric.totalRequests > 10) {
      alerts.push({
        type: 'LOW_CACHE_HIT_RATE',
        severity: 'info',
        message: `${metric.endpoint} cache hit rate is ${(metric.cacheHitRate * 100).toFixed(1)}% (threshold: ${this.thresholds.cacheHitRate * 100}%)`,
        metric: key,
        value: metric.cacheHitRate,
        timestamp: Date.now()
      });
    }

    // Add new alerts
    alerts.forEach(alert => {
      const existingAlert = this.alerts.find(a => a.type === alert.type && a.metric === alert.metric);
      if (!existingAlert) {
        this.alerts.push(alert);
      }
    });

    // Keep only last 50 alerts
    if (this.alerts.length > 50) {
      this.alerts = this.alerts.slice(-50);
    }
  }

  /**
   * Get metrics for an endpoint
   */
  getMetrics(endpoint, orgId) {
    const key = `${endpoint}:${orgId}`;
    return this.metrics.get(key);
  }

  /**
   * Get all metrics
   */
  getAllMetrics() {
    return Array.from(this.metrics.values());
  }

  /**
   * Get active alerts
   */
  getAlerts(severity = null) {
    if (severity) {
      return this.alerts.filter(a => a.severity === severity);
    }
    return this.alerts;
  }

  /**
   * Get health status
   */
  getHealthStatus() {
    const allMetrics = this.getAllMetrics();
    
    if (allMetrics.length === 0) {
      return { status: 'unknown', message: 'No metrics available' };
    }

    const criticalAlerts = this.getAlerts('critical');
    const warningAlerts = this.getAlerts('warning');
    const avgErrorRate = allMetrics.reduce((sum, m) => sum + m.errorRate, 0) / allMetrics.length;
    const avgResponseTime = allMetrics.reduce((sum, m) => sum + m.avgResponseTime, 0) / allMetrics.length;

    if (criticalAlerts.length > 0) {
      return {
        status: 'critical',
        message: `${criticalAlerts.length} critical alerts`,
        avgErrorRate: (avgErrorRate * 100).toFixed(1) + '%',
        avgResponseTime: avgResponseTime.toFixed(0) + 'ms',
        alerts: criticalAlerts
      };
    }

    if (warningAlerts.length > 0) {
      return {
        status: 'warning',
        message: `${warningAlerts.length} warning alerts`,
        avgErrorRate: (avgErrorRate * 100).toFixed(1) + '%',
        avgResponseTime: avgResponseTime.toFixed(0) + 'ms',
        alerts: warningAlerts
      };
    }

    return {
      status: 'healthy',
      message: 'All systems operational',
      avgErrorRate: (avgErrorRate * 100).toFixed(1) + '%',
      avgResponseTime: avgResponseTime.toFixed(0) + 'ms',
      totalEndpoints: allMetrics.length
    };
  }

  /**
   * Reset metrics
   */
  reset() {
    this.metrics.clear();
    this.alerts = [];
  }

  /**
   * Get performance report
   */
  getReport() {
    const allMetrics = this.getAllMetrics();
    const health = this.getHealthStatus();

    return {
      timestamp: Date.now(),
      health,
      endpoints: allMetrics.map(m => ({
        endpoint: m.endpoint,
        orgId: m.orgId,
        totalRequests: m.totalRequests,
        successRate: ((m.successfulRequests / m.totalRequests) * 100).toFixed(1) + '%',
        avgResponseTime: m.avgResponseTime.toFixed(0) + 'ms',
        cacheHitRate: (m.cacheHitRate * 100).toFixed(1) + '%',
        errorRate: (m.errorRate * 100).toFixed(1) + '%'
      })),
      recentAlerts: this.alerts.slice(-10)
    };
  }
}

// Export singleton instance
export const dashboardMonitor = new DashboardMonitor();

export default dashboardMonitor;
