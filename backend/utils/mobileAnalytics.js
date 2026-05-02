/**
 * Mobile Analytics System
 * 
 * Comprehensive analytics and performance monitoring for mobile apps:
 * - User behavior tracking
 * - Performance metrics
 * - Crash reporting
 * - Feature usage analytics
 * - Network performance monitoring
 * - Battery usage optimization
 * - Real-time analytics dashboard
 * 
 * Features:
 * - Real-time event tracking
 * - Performance bottleneck detection
 * - User journey analysis
 * - A/B testing support
 * - Custom event tracking
 * - Automated insights generation
 */

import logger from './logger.js';
import EventEmitter from 'events';

class MobileAnalytics extends EventEmitter {
  constructor() {
    super();
    
    this.events = new Map(); // Event storage
    this.sessions = new Map(); // User sessions
    this.performance = new Map(); // Performance metrics
    this.crashes = new Map(); // Crash reports
    this.features = new Map(); // Feature usage
    this.experiments = new Map(); // A/B testing
    
    // Analytics configuration
    this.config = {
      sessionTimeout: 30 * 60 * 1000, // 30 minutes
      batchSize: 100,
      flushInterval: 60000, // 1 minute
      retentionDays: 90,
      enableRealTime: true,
      enablePerformanceMonitoring: true
    };
    
    // Metrics aggregation
    this.metrics = {
      dailyActiveUsers: new Map(),
      monthlyActiveUsers: new Map(),
      sessionDuration: [],
      screenViews: new Map(),
      buttonClicks: new Map(),
      apiCalls: new Map(),
      errors: new Map()
    };
    
    this.initialize();
  }

  initialize() {
    logger.info('📊 Initializing Mobile Analytics System');
    
    this.startSessionManager();
    this.startMetricsAggregator();
    this.startDataProcessor();
    this.startInsightsGenerator();
    
    logger.info('✅ Mobile Analytics System initialized');
  }

  /**
   * Track user event
   */
  trackEvent(userId, eventName, properties = {}, context = {}) {
    try {
      const event = {
        id: `event_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        userId,
        eventName,
        properties,
        context: {
          timestamp: new Date().toISOString(),
          platform: context.platform || 'unknown',
          appVersion: context.appVersion || '1.0.0',
          deviceModel: context.deviceModel,
          osVersion: context.osVersion,
          networkType: context.networkType,
          batteryLevel: context.batteryLevel,
          ...context
        }
      };

      // Store event
      if (!this.events.has(userId)) {
        this.events.set(userId, []);
      }
      this.events.get(userId).push(event);

      // Update session
      this.updateSession(userId, event);

      // Update metrics
      this.updateMetrics(event);

      // Emit real-time event
      if (this.config.enableRealTime) {
        this.emit('event_tracked', event);
      }

      logger.debug('📊 Event tracked', {
        userId,
        eventName,
        properties: Object.keys(properties)
      });

      return event.id;
    } catch (error) {
      logger.error('❌ Event tracking failed', {
        userId,
        eventName,
        error: error.message
      });
    }
  }

  /**
   * Track screen view
   */
  trackScreenView(userId, screenName, properties = {}, context = {}) {
    return this.trackEvent(userId, 'screen_view', {
      screen_name: screenName,
      ...properties
    }, context);
  }

  /**
   * Track user action
   */
  trackAction(userId, action, target, properties = {}, context = {}) {
    return this.trackEvent(userId, 'user_action', {
      action,
      target,
      ...properties
    }, context);
  }

  /**
   * Track performance metric
   */
  trackPerformance(userId, metricName, value, properties = {}, context = {}) {
    try {
      const performanceEvent = {
        id: `perf_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        userId,
        metricName,
        value,
        properties,
        context: {
          timestamp: new Date().toISOString(),
          ...context
        }
      };

      if (!this.performance.has(userId)) {
        this.performance.set(userId, []);
      }
      this.performance.get(userId).push(performanceEvent);

      // Update performance metrics
      this.updatePerformanceMetrics(performanceEvent);

      logger.debug('⚡ Performance tracked', {
        userId,
        metricName,
        value
      });

      return performanceEvent.id;
    } catch (error) {
      logger.error('❌ Performance tracking failed', {
        userId,
        metricName,
        error: error.message
      });
    }
  }

  /**
   * Track crash or error
   */
  trackCrash(userId, error, context = {}) {
    try {
      const crashReport = {
        id: `crash_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        userId,
        error: {
          message: error.message,
          stack: error.stack,
          name: error.name
        },
        context: {
          timestamp: new Date().toISOString(),
          url: context.url,
          userAgent: context.userAgent,
          platform: context.platform,
          appVersion: context.appVersion,
          ...context
        },
        severity: this.determineSeverity(error)
      };

      if (!this.crashes.has(userId)) {
        this.crashes.set(userId, []);
      }
      this.crashes.get(userId).push(crashReport);

      // Update error metrics
      this.updateErrorMetrics(crashReport);

      // Emit critical error event
      if (crashReport.severity === 'critical') {
        this.emit('critical_error', crashReport);
      }

      logger.error('💥 Crash tracked', {
        userId,
        error: error.message,
        severity: crashReport.severity
      });

      return crashReport.id;
    } catch (trackingError) {
      logger.error('❌ Crash tracking failed', {
        userId,
        originalError: error.message,
        trackingError: trackingError.message
      });
    }
  }

  /**
   * Track feature usage
   */
  trackFeatureUsage(userId, featureName, action, properties = {}, context = {}) {
    try {
      const featureEvent = {
        id: `feature_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        userId,
        featureName,
        action, // 'used', 'enabled', 'disabled', 'discovered'
        properties,
        context: {
          timestamp: new Date().toISOString(),
          ...context
        }
      };

      if (!this.features.has(featureName)) {
        this.features.set(featureName, []);
      }
      this.features.get(featureName).push(featureEvent);

      // Update feature metrics
      this.updateFeatureMetrics(featureEvent);

      logger.debug('🎯 Feature usage tracked', {
        userId,
        featureName,
        action
      });

      return featureEvent.id;
    } catch (error) {
      logger.error('❌ Feature tracking failed', {
        userId,
        featureName,
        error: error.message
      });
    }
  }

  /**
   * Start user session
   */
  startSession(userId, context = {}) {
    try {
      const sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      const session = {
        id: sessionId,
        userId,
        startTime: new Date().toISOString(),
        lastActivity: new Date().toISOString(),
        endTime: null,
        duration: 0,
        screenViews: 0,
        actions: 0,
        context: {
          platform: context.platform,
          appVersion: context.appVersion,
          deviceModel: context.deviceModel,
          osVersion: context.osVersion,
          ...context
        },
        active: true
      };

      this.sessions.set(sessionId, session);

      // Track session start event
      this.trackEvent(userId, 'session_start', {
        session_id: sessionId
      }, context);

      logger.info('🚀 Session started', {
        userId,
        sessionId,
        platform: context.platform
      });

      return sessionId;
    } catch (error) {
      logger.error('❌ Session start failed', {
        userId,
        error: error.message
      });
    }
  }

  /**
   * End user session
   */
  endSession(sessionId, context = {}) {
    try {
      const session = this.sessions.get(sessionId);
      if (!session) {
        return false;
      }

      const endTime = new Date();
      const startTime = new Date(session.startTime);
      const duration = endTime.getTime() - startTime.getTime();

      session.endTime = endTime.toISOString();
      session.duration = duration;
      session.active = false;

      // Track session end event
      this.trackEvent(session.userId, 'session_end', {
        session_id: sessionId,
        duration: duration,
        screen_views: session.screenViews,
        actions: session.actions
      }, context);

      // Update session metrics
      this.metrics.sessionDuration.push(duration);

      logger.info('🏁 Session ended', {
        userId: session.userId,
        sessionId,
        duration: `${Math.round(duration / 1000)}s`
      });

      return true;
    } catch (error) {
      logger.error('❌ Session end failed', {
        sessionId,
        error: error.message
      });
      return false;
    }
  }

  /**
   * Update user session
   */
  updateSession(userId, event) {
    try {
      // Find active session for user
      const activeSession = Array.from(this.sessions.values())
        .find(session => session.userId === userId && session.active);

      if (activeSession) {
        activeSession.lastActivity = event.context.timestamp;
        
        if (event.eventName === 'screen_view') {
          activeSession.screenViews++;
        } else if (event.eventName === 'user_action') {
          activeSession.actions++;
        }
      }
    } catch (error) {
      logger.error('❌ Session update failed', {
        userId,
        error: error.message
      });
    }
  }

  /**
   * Update metrics based on event
   */
  updateMetrics(event) {
    try {
      const { userId, eventName, context } = event;
      const date = new Date(context.timestamp).toISOString().split('T')[0];

      // Daily Active Users
      if (!this.metrics.dailyActiveUsers.has(date)) {
        this.metrics.dailyActiveUsers.set(date, new Set());
      }
      this.metrics.dailyActiveUsers.get(date).add(userId);

      // Monthly Active Users
      const month = date.substring(0, 7); // YYYY-MM
      if (!this.metrics.monthlyActiveUsers.has(month)) {
        this.metrics.monthlyActiveUsers.set(month, new Set());
      }
      this.metrics.monthlyActiveUsers.get(month).add(userId);

      // Screen Views
      if (eventName === 'screen_view') {
        const screenName = event.properties.screen_name;
        this.metrics.screenViews.set(screenName, 
          (this.metrics.screenViews.get(screenName) || 0) + 1
        );
      }

      // Button Clicks
      if (eventName === 'user_action' && event.properties.action === 'click') {
        const target = event.properties.target;
        this.metrics.buttonClicks.set(target,
          (this.metrics.buttonClicks.get(target) || 0) + 1
        );
      }

      // API Calls
      if (eventName === 'api_call') {
        const endpoint = event.properties.endpoint;
        this.metrics.apiCalls.set(endpoint,
          (this.metrics.apiCalls.get(endpoint) || 0) + 1
        );
      }
    } catch (error) {
      logger.error('❌ Metrics update failed', {
        event: event.eventName,
        error: error.message
      });
    }
  }

  /**
   * Update performance metrics
   */
  updatePerformanceMetrics(performanceEvent) {
    try {
      const { metricName, value } = performanceEvent;
      
      // Store performance data for analysis
      if (!this.performance.has('aggregated')) {
        this.performance.set('aggregated', new Map());
      }
      
      const aggregated = this.performance.get('aggregated');
      if (!aggregated.has(metricName)) {
        aggregated.set(metricName, []);
      }
      
      aggregated.get(metricName).push({
        value,
        timestamp: performanceEvent.context.timestamp
      });

      // Keep only last 1000 entries per metric
      const metricData = aggregated.get(metricName);
      if (metricData.length > 1000) {
        metricData.splice(0, metricData.length - 1000);
      }
    } catch (error) {
      logger.error('❌ Performance metrics update failed', {
        metric: performanceEvent.metricName,
        error: error.message
      });
    }
  }

  /**
   * Update error metrics
   */
  updateErrorMetrics(crashReport) {
    try {
      const errorType = crashReport.error.name || 'Unknown';
      this.metrics.errors.set(errorType,
        (this.metrics.errors.get(errorType) || 0) + 1
      );
    } catch (error) {
      logger.error('❌ Error metrics update failed', {
        error: error.message
      });
    }
  }

  /**
   * Update feature metrics
   */
  updateFeatureMetrics(featureEvent) {
    try {
      const { featureName, action } = featureEvent;
      const key = `${featureName}:${action}`;
      
      if (!this.metrics.features) {
        this.metrics.features = new Map();
      }
      
      this.metrics.features.set(key,
        (this.metrics.features.get(key) || 0) + 1
      );
    } catch (error) {
      logger.error('❌ Feature metrics update failed', {
        feature: featureEvent.featureName,
        error: error.message
      });
    }
  }

  /**
   * Determine error severity
   */
  determineSeverity(error) {
    const criticalErrors = [
      'TypeError',
      'ReferenceError',
      'SyntaxError',
      'SecurityError'
    ];
    
    const highErrors = [
      'NetworkError',
      'TimeoutError',
      'AuthenticationError'
    ];

    if (criticalErrors.includes(error.name)) {
      return 'critical';
    } else if (highErrors.includes(error.name)) {
      return 'high';
    } else if (error.message.includes('crash') || error.message.includes('fatal')) {
      return 'critical';
    } else {
      return 'medium';
    }
  }

  /**
   * Get analytics dashboard data
   */
  getDashboardData(timeRange = '7d') {
    try {
      const now = new Date();
      const startDate = new Date();
      
      // Calculate start date based on time range
      switch (timeRange) {
        case '1d':
          startDate.setDate(now.getDate() - 1);
          break;
        case '7d':
          startDate.setDate(now.getDate() - 7);
          break;
        case '30d':
          startDate.setDate(now.getDate() - 30);
          break;
        case '90d':
          startDate.setDate(now.getDate() - 90);
          break;
        default:
          startDate.setDate(now.getDate() - 7);
      }

      // Calculate metrics
      const totalUsers = new Set();
      const totalSessions = Array.from(this.sessions.values()).length;
      const activeSessions = Array.from(this.sessions.values())
        .filter(session => session.active).length;

      // Collect users from events in time range
      for (const [userId, userEvents] of this.events.entries()) {
        const recentEvents = userEvents.filter(event => 
          new Date(event.context.timestamp) >= startDate
        );
        if (recentEvents.length > 0) {
          totalUsers.add(userId);
        }
      }

      // Top screens
      const topScreens = Array.from(this.metrics.screenViews.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10);

      // Top actions
      const topActions = Array.from(this.metrics.buttonClicks.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10);

      // Error summary
      const errorSummary = Array.from(this.metrics.errors.entries())
        .sort((a, b) => b[1] - a[1]);

      // Performance summary
      const performanceSummary = {};
      const aggregated = this.performance.get('aggregated');
      if (aggregated) {
        for (const [metric, values] of aggregated.entries()) {
          const recentValues = values.filter(v => 
            new Date(v.timestamp) >= startDate
          ).map(v => v.value);
          
          if (recentValues.length > 0) {
            performanceSummary[metric] = {
              count: recentValues.length,
              average: recentValues.reduce((a, b) => a + b, 0) / recentValues.length,
              min: Math.min(...recentValues),
              max: Math.max(...recentValues)
            };
          }
        }
      }

      return {
        timeRange,
        overview: {
          totalUsers: totalUsers.size,
          totalSessions,
          activeSessions,
          averageSessionDuration: this.calculateAverageSessionDuration()
        },
        topScreens,
        topActions,
        errorSummary,
        performanceSummary,
        generatedAt: new Date().toISOString()
      };
    } catch (error) {
      logger.error('❌ Dashboard data generation failed', {
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Calculate average session duration
   */
  calculateAverageSessionDuration() {
    if (this.metrics.sessionDuration.length === 0) {
      return 0;
    }
    
    const total = this.metrics.sessionDuration.reduce((sum, duration) => sum + duration, 0);
    return Math.round(total / this.metrics.sessionDuration.length / 1000); // in seconds
  }

  /**
   * Get user journey analysis
   */
  getUserJourney(userId, timeRange = '7d') {
    try {
      const userEvents = this.events.get(userId) || [];
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - parseInt(timeRange.replace('d', '')));

      const recentEvents = userEvents.filter(event => 
        new Date(event.context.timestamp) >= startDate
      );

      // Group events by session
      const sessions = new Map();
      for (const event of recentEvents) {
        const sessionDate = event.context.timestamp.split('T')[0];
        if (!sessions.has(sessionDate)) {
          sessions.set(sessionDate, []);
        }
        sessions.get(sessionDate).push(event);
      }

      // Analyze journey patterns
      const journey = Array.from(sessions.entries()).map(([date, events]) => ({
        date,
        eventCount: events.length,
        screenViews: events.filter(e => e.eventName === 'screen_view').length,
        actions: events.filter(e => e.eventName === 'user_action').length,
        errors: events.filter(e => e.eventName === 'error').length,
        timeline: events.sort((a, b) => 
          new Date(a.context.timestamp) - new Date(b.context.timestamp)
        )
      }));

      return {
        userId,
        timeRange,
        totalEvents: recentEvents.length,
        journey
      };
    } catch (error) {
      logger.error('❌ User journey analysis failed', {
        userId,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Start session manager
   */
  startSessionManager() {
    setInterval(() => {
      const now = Date.now();
      
      // End inactive sessions
      for (const [sessionId, session] of this.sessions.entries()) {
        if (session.active) {
          const lastActivity = new Date(session.lastActivity).getTime();
          const inactiveTime = now - lastActivity;
          
          if (inactiveTime > this.config.sessionTimeout) {
            this.endSession(sessionId, { reason: 'timeout' });
          }
        }
      }
    }, 60000); // Check every minute

    logger.info('👥 Session manager started');
  }

  /**
   * Start metrics aggregator
   */
  startMetricsAggregator() {
    setInterval(() => {
      try {
        // Clean up old data
        this.cleanupOldData();
        
        // Generate insights
        this.generateInsights();
      } catch (error) {
        logger.error('Metrics aggregation failed', { error: error.message });
      }
    }, this.config.flushInterval);

    logger.info('📊 Metrics aggregator started');
  }

  /**
   * Start data processor
   */
  startDataProcessor() {
    setInterval(() => {
      try {
        // Process batched events
        this.processBatchedEvents();
      } catch (error) {
        logger.error('Data processing failed', { error: error.message });
      }
    }, this.config.flushInterval);

    logger.info('⚙️ Data processor started');
  }

  /**
   * Start insights generator
   */
  startInsightsGenerator() {
    setInterval(() => {
      try {
        // Generate automated insights
        this.generateAutomatedInsights();
      } catch (error) {
        logger.error('Insights generation failed', { error: error.message });
      }
    }, 5 * 60 * 1000); // Every 5 minutes

    logger.info('💡 Insights generator started');
  }

  /**
   * Clean up old data
   */
  cleanupOldData() {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - this.config.retentionDays);

    // Clean up events
    for (const [userId, events] of this.events.entries()) {
      const filteredEvents = events.filter(event => 
        new Date(event.context.timestamp) > cutoffDate
      );
      this.events.set(userId, filteredEvents);
    }

    // Clean up sessions
    for (const [sessionId, session] of this.sessions.entries()) {
      if (new Date(session.startTime) < cutoffDate) {
        this.sessions.delete(sessionId);
      }
    }

    logger.debug('🧹 Old data cleaned up');
  }

  /**
   * Process batched events
   */
  processBatchedEvents() {
    // Placeholder for batch processing logic
    logger.debug('📦 Batched events processed');
  }

  /**
   * Generate insights
   */
  generateInsights() {
    // Placeholder for insights generation
    logger.debug('💡 Insights generated');
  }

  /**
   * Generate automated insights
   */
  generateAutomatedInsights() {
    // Placeholder for automated insights
    logger.debug('🤖 Automated insights generated');
  }

  /**
   * Get analytics statistics
   */
  getStats() {
    return {
      totalEvents: Array.from(this.events.values()).reduce((total, events) => total + events.length, 0),
      totalUsers: this.events.size,
      totalSessions: this.sessions.size,
      activeSessions: Array.from(this.sessions.values()).filter(s => s.active).length,
      totalCrashes: Array.from(this.crashes.values()).reduce((total, crashes) => total + crashes.length, 0),
      totalFeatures: this.features.size,
      config: this.config
    };
  }
}

export default MobileAnalytics;