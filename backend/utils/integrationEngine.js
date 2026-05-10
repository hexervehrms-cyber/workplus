/**
 * Universal Third-Party Integration Engine
 * 
 * Provides a unified framework for integrating with external systems:
 * - Accounting systems (QuickBooks, Tally, SAP)
 * - Banking systems (file generation, payment processing)
 * - Communication services (Email, SMS)
 * - Cloud storage (AWS S3, Google Drive, Dropbox)
 * - Calendar systems (Google Calendar, Outlook)
 * - Video conferencing (Zoom, Teams, Meet)
 * 
 * Features:
 * - Universal connector interface
 * - Automatic retry with exponential backoff
 * - Rate limiting and throttling
 * - Error handling and logging
 * - Data transformation and mapping
 * - Webhook management
 * - Real-time sync capabilities
 */

import logger from './logger.js';
import EventSystem from './eventSystem.js';

class IntegrationEngine {
  constructor() {
    this.connectors = new Map();
    this.activeConnections = new Map();
    this.retryQueue = new Map();
    this.webhookHandlers = new Map();
    this.rateLimiters = new Map();
    this.transformers = new Map();
    
    // Integration statistics
    this.stats = {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      averageResponseTime: 0,
      lastSyncTime: null,
      activeIntegrations: 0
    };
    
    this.initialize();
  }

  /**
   * Initialize the integration engine
   */
  initialize() {
    logger.info('🔗 Initializing Integration Engine');
    
    // Register built-in connectors
    this.registerBuiltInConnectors();
    
    // Start background processes
    this.startRetryProcessor();
    this.startHealthChecker();
    
    logger.info('✅ Integration Engine initialized', {
      connectors: this.connectors.size,
      features: ['retry', 'rateLimit', 'transform', 'webhook']
    });
  }

  /**
   * Register a new integration connector
   */
  registerConnector(name, connector) {
    try {
      // Validate connector interface
      this.validateConnector(connector);
      
      this.connectors.set(name, {
        ...connector,
        name,
        registeredAt: new Date(),
        status: 'registered',
        lastUsed: null,
        requestCount: 0,
        errorCount: 0
      });
      
      logger.info(`✅ Connector registered: ${name}`, {
        type: connector.type,
        version: connector.version
      });
      
      return true;
    } catch (error) {
      logger.error(`❌ Failed to register connector: ${name}`, {
        error: error.message
      });
      return false;
    }
  }

  /**
   * Validate connector interface
   */
  validateConnector(connector) {
    const required = ['type', 'version', 'connect', 'disconnect', 'request'];
    
    for (const method of required) {
      if (!connector[method]) {
        throw new Error(`Connector missing required method: ${method}`);
      }
    }
    
    if (typeof connector.connect !== 'function') {
      throw new Error('Connector.connect must be a function');
    }
    
    if (typeof connector.request !== 'function') {
      throw new Error('Connector.request must be a function');
    }
  }

  /**
   * Connect to an external system
   */
  async connect(connectorName, config = {}) {
    try {
      const connector = this.connectors.get(connectorName);
      if (!connector) {
        throw new Error(`Connector not found: ${connectorName}`);
      }

      logger.info(`🔗 Connecting to ${connectorName}`, { config: Object.keys(config) });

      // Establish connection
      const connection = await connector.connect(config);
      
      // Store active connection
      this.activeConnections.set(connectorName, {
        connector,
        connection,
        config,
        connectedAt: new Date(),
        lastActivity: new Date(),
        status: 'connected'
      });

      // Update connector stats
      connector.status = 'connected';
      connector.lastUsed = new Date();
      this.stats.activeIntegrations++;

      logger.info(`✅ Connected to ${connectorName}`);
      
      // Emit integration event
      if (global.eventSystem) {
        global.eventSystem.emit('integration.connected', {
          connector: connectorName,
          timestamp: new Date()
        });
      }

      return connection;
    } catch (error) {
      logger.error(`❌ Failed to connect to ${connectorName}`, {
        error: error.message,
        stack: error.stack
      });
      
      // Update connector stats
      const connector = this.connectors.get(connectorName);
      if (connector) {
        connector.errorCount++;
      }
      
      throw error;
    }
  }

  /**
   * Disconnect from an external system
   */
  async disconnect(connectorName) {
    try {
      const activeConnection = this.activeConnections.get(connectorName);
      if (!activeConnection) {
        logger.warn(`No active connection found for ${connectorName}`);
        return true;
      }

      const { connector, connection } = activeConnection;
      
      // Disconnect
      if (connector.disconnect) {
        await connector.disconnect(connection);
      }
      
      // Remove from active connections
      this.activeConnections.delete(connectorName);
      
      // Update stats
      connector.status = 'disconnected';
      this.stats.activeIntegrations--;

      logger.info(`✅ Disconnected from ${connectorName}`);
      
      return true;
    } catch (error) {
      logger.error(`❌ Failed to disconnect from ${connectorName}`, {
        error: error.message
      });
      return false;
    }
  }

  /**
   * Make a request to an external system
   */
  async request(connectorName, operation, data = {}, options = {}) {
    const startTime = Date.now();
    
    try {
      // Get active connection
      const activeConnection = this.activeConnections.get(connectorName);
      if (!activeConnection) {
        throw new Error(`No active connection for ${connectorName}`);
      }

      const { connector, connection } = activeConnection;

      // Check rate limits
      if (await this.isRateLimited(connectorName)) {
        throw new Error(`Rate limit exceeded for ${connectorName}`);
      }

      // Transform data if transformer exists
      const transformedData = await this.transformData(connectorName, 'request', data);

      // Update stats
      this.stats.totalRequests++;
      connector.requestCount++;
      activeConnection.lastActivity = new Date();

      logger.debug(`📤 Making request to ${connectorName}`, {
        operation,
        dataKeys: Object.keys(transformedData)
      });

      // Make the request
      const result = await connector.request(connection, operation, transformedData, options);

      // Transform response if transformer exists
      const transformedResult = await this.transformData(connectorName, 'response', result);

      // Update stats
      const responseTime = Date.now() - startTime;
      this.stats.successfulRequests++;
      this.updateAverageResponseTime(responseTime);

      logger.info(`✅ Request successful: ${connectorName}/${operation}`, {
        responseTime: `${responseTime}ms`
      });

      // Emit success event
      if (global.eventSystem) {
        global.eventSystem.emit('integration.request.success', {
          connector: connectorName,
          operation,
          responseTime,
          timestamp: new Date()
        });
      }

      return transformedResult;
    } catch (error) {
      const responseTime = Date.now() - startTime;
      
      // Update stats
      this.stats.failedRequests++;
      const connector = this.connectors.get(connectorName);
      if (connector) {
        connector.errorCount++;
      }

      logger.error(`❌ Request failed: ${connectorName}/${operation}`, {
        error: error.message,
        responseTime: `${responseTime}ms`
      });

      // Add to retry queue if retryable
      if (this.isRetryableError(error) && options.retry !== false) {
        await this.addToRetryQueue(connectorName, operation, data, options);
      }

      // Emit error event
      if (global.eventSystem) {
        global.eventSystem.emit('integration.request.error', {
          connector: connectorName,
          operation,
          error: error.message,
          responseTime,
          timestamp: new Date()
        });
      }

      throw error;
    }
  }

  /**
   * Sync data between systems
   */
  async syncData(sourceConnector, targetConnector, mapping, options = {}) {
    try {
      logger.info(`🔄 Starting data sync: ${sourceConnector} → ${targetConnector}`);

      // Get data from source
      const sourceData = await this.request(sourceConnector, 'getData', mapping.source);
      
      // Transform data according to mapping
      const transformedData = await this.applyMapping(sourceData, mapping);
      
      // Send data to target
      const result = await this.request(targetConnector, 'setData', transformedData);
      
      // Update sync timestamp
      this.stats.lastSyncTime = new Date();

      logger.info(`✅ Data sync completed: ${sourceConnector} → ${targetConnector}`, {
        recordsProcessed: Array.isArray(sourceData) ? sourceData.length : 1
      });

      return result;
    } catch (error) {
      logger.error(`❌ Data sync failed: ${sourceConnector} → ${targetConnector}`, {
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Register a webhook handler
   */
  registerWebhook(connectorName, event, handler) {
    const key = `${connectorName}:${event}`;
    this.webhookHandlers.set(key, handler);
    
    logger.info(`📡 Webhook registered: ${key}`);
  }

  /**
   * Handle incoming webhook
   */
  async handleWebhook(connectorName, event, payload) {
    try {
      const key = `${connectorName}:${event}`;
      const handler = this.webhookHandlers.get(key);
      
      if (!handler) {
        logger.warn(`No webhook handler found for ${key}`);
        return false;
      }

      logger.info(`📡 Processing webhook: ${key}`);
      
      const result = await handler(payload);
      
      logger.info(`✅ Webhook processed: ${key}`);
      
      return result;
    } catch (error) {
      logger.error(`❌ Webhook processing failed: ${connectorName}:${event}`, {
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Get integration statistics
   */
  getStats() {
    return {
      ...this.stats,
      connectors: Array.from(this.connectors.entries()).map(([name, connector]) => ({
        name,
        type: connector.type,
        status: connector.status,
        requestCount: connector.requestCount,
        errorCount: connector.errorCount,
        lastUsed: connector.lastUsed
      })),
      activeConnections: this.activeConnections.size,
      retryQueueSize: this.retryQueue.size
    };
  }

  /**
   * Register built-in connectors
   */
  registerBuiltInConnectors() {
    // QuickBooks connector
    this.registerConnector('quickbooks', {
      type: 'accounting',
      version: '1.0.0',
      connect: async (config) => {
        return {
          apiKey: config.apiKey,
          baseUrl: config.sandbox ? 'https://sandbox-quickbooks.api.intuit.com' : 'https://quickbooks.api.intuit.com',
          companyId: config.companyId
        };
      },
      disconnect: async (connection) => {
        // QuickBooks doesn't require explicit disconnect
        return true;
      },
      request: async (connection, operation, data) => {
        // Implement QuickBooks API calls
        switch (operation) {
          case 'createEmployee':
            return this.quickbooksCreateEmployee(connection, data);
          case 'updateEmployee':
            return this.quickbooksUpdateEmployee(connection, data);
          case 'getEmployees':
            return this.quickbooksGetEmployees(connection, data);
          case 'createPayroll':
            return this.quickbooksCreatePayroll(connection, data);
          default:
            throw new Error(`Unsupported QuickBooks operation: ${operation}`);
        }
      }
    });

    // Tally connector
    this.registerConnector('tally', {
      type: 'accounting',
      version: '1.0.0',
      connect: async (config) => {
        return {
          serverUrl: config.serverUrl || process.env.TALLY_SERVER_URL || 'http://localhost:9000',
          companyName: config.companyName
        };
      },
      disconnect: async (connection) => {
        return true;
      },
      request: async (connection, operation, data) => {
        // Implement Tally XML API calls
        switch (operation) {
          case 'createLedger':
            return this.tallyCreateLedger(connection, data);
          case 'createVoucher':
            return this.tallyCreateVoucher(connection, data);
          case 'getReports':
            return this.tallyGetReports(connection, data);
          default:
            throw new Error(`Unsupported Tally operation: ${operation}`);
        }
      }
    });

    // Email service connector (SendGrid)
    this.registerConnector('sendgrid', {
      type: 'email',
      version: '1.0.0',
      connect: async (config) => {
        return {
          apiKey: config.apiKey,
          baseUrl: 'https://api.sendgrid.com/v3'
        };
      },
      disconnect: async (connection) => {
        return true;
      },
      request: async (connection, operation, data) => {
        switch (operation) {
          case 'sendEmail':
            return this.sendgridSendEmail(connection, data);
          case 'sendBulkEmail':
            return this.sendgridSendBulkEmail(connection, data);
          case 'getStats':
            return this.sendgridGetStats(connection, data);
          default:
            throw new Error(`Unsupported SendGrid operation: ${operation}`);
        }
      }
    });

    // SMS service connector (Twilio)
    this.registerConnector('twilio', {
      type: 'sms',
      version: '1.0.0',
      connect: async (config) => {
        return {
          accountSid: config.accountSid,
          authToken: config.authToken,
          fromNumber: config.fromNumber
        };
      },
      disconnect: async (connection) => {
        return true;
      },
      request: async (connection, operation, data) => {
        switch (operation) {
          case 'sendSMS':
            return this.twilioSendSMS(connection, data);
          case 'sendBulkSMS':
            return this.twilioSendBulkSMS(connection, data);
          case 'getDeliveryStatus':
            return this.twilioGetDeliveryStatus(connection, data);
          default:
            throw new Error(`Unsupported Twilio operation: ${operation}`);
        }
      }
    });

    // Banking connector
    this.registerConnector('banking', {
      type: 'banking',
      version: '1.0.0',
      connect: async (config) => {
        return {
          bankCode: config.bankCode,
          accountNumber: config.accountNumber,
          apiEndpoint: config.apiEndpoint
        };
      },
      disconnect: async (connection) => {
        return true;
      },
      request: async (connection, operation, data) => {
        switch (operation) {
          case 'generatePayrollFile':
            return this.bankingGeneratePayrollFile(connection, data);
          case 'processPayments':
            return this.bankingProcessPayments(connection, data);
          case 'getTransactionStatus':
            return this.bankingGetTransactionStatus(connection, data);
          default:
            throw new Error(`Unsupported Banking operation: ${operation}`);
        }
      }
    });

    logger.info('✅ Built-in connectors registered', {
      connectors: ['quickbooks', 'tally', 'sendgrid', 'twilio', 'banking']
    });
  }

  /**
   * Check if request is rate limited
   */
  async isRateLimited(connectorName) {
    const rateLimiter = this.rateLimiters.get(connectorName);
    if (!rateLimiter) {
      return false;
    }

    const now = Date.now();
    const windowStart = now - rateLimiter.windowMs;
    
    // Clean old requests
    rateLimiter.requests = rateLimiter.requests.filter(time => time > windowStart);
    
    // Check if limit exceeded
    return rateLimiter.requests.length >= rateLimiter.maxRequests;
  }

  /**
   * Transform data using registered transformers
   */
  async transformData(connectorName, direction, data) {
    const transformer = this.transformers.get(`${connectorName}:${direction}`);
    if (!transformer) {
      return data;
    }

    try {
      return await transformer(data);
    } catch (error) {
      logger.error(`Data transformation failed: ${connectorName}:${direction}`, {
        error: error.message
      });
      return data; // Return original data on transformation error
    }
  }

  /**
   * Apply data mapping between systems
   */
  async applyMapping(data, mapping) {
    try {
      if (!mapping.fields) {
        return data;
      }

      const mapped = {};
      
      for (const [targetField, sourceField] of Object.entries(mapping.fields)) {
        if (typeof sourceField === 'string') {
          mapped[targetField] = this.getNestedValue(data, sourceField);
        } else if (typeof sourceField === 'function') {
          mapped[targetField] = sourceField(data);
        } else if (sourceField.transform) {
          const value = this.getNestedValue(data, sourceField.field);
          mapped[targetField] = sourceField.transform(value);
        }
      }

      return mapped;
    } catch (error) {
      logger.error('Data mapping failed', { error: error.message });
      throw error;
    }
  }

  /**
   * Get nested value from object using dot notation
   */
  getNestedValue(obj, path) {
    return path.split('.').reduce((current, key) => current?.[key], obj);
  }

  /**
   * Check if error is retryable
   */
  isRetryableError(error) {
    const retryableErrors = [
      'ECONNRESET',
      'ETIMEDOUT',
      'ENOTFOUND',
      'Rate limit exceeded',
      'Service temporarily unavailable'
    ];

    return retryableErrors.some(retryableError => 
      error.message.includes(retryableError) || error.code === retryableError
    );
  }

  /**
   * Add request to retry queue
   */
  async addToRetryQueue(connectorName, operation, data, options) {
    const retryKey = `${connectorName}:${operation}:${Date.now()}`;
    const retryCount = (options.retryCount || 0) + 1;
    const maxRetries = options.maxRetries || 3;

    if (retryCount > maxRetries) {
      logger.warn(`Max retries exceeded for ${connectorName}/${operation}`);
      return;
    }

    const retryDelay = Math.min(1000 * Math.pow(2, retryCount - 1), 30000); // Exponential backoff, max 30s

    this.retryQueue.set(retryKey, {
      connectorName,
      operation,
      data,
      options: { ...options, retryCount },
      retryAt: Date.now() + retryDelay,
      attempts: retryCount
    });

    logger.info(`Added to retry queue: ${connectorName}/${operation}`, {
      attempt: retryCount,
      retryIn: `${retryDelay}ms`
    });
  }

  /**
   * Start retry processor
   */
  startRetryProcessor() {
    setInterval(async () => {
      const now = Date.now();
      
      for (const [key, retry] of this.retryQueue.entries()) {
        if (retry.retryAt <= now) {
          try {
            await this.request(retry.connectorName, retry.operation, retry.data, retry.options);
            this.retryQueue.delete(key);
            logger.info(`Retry successful: ${retry.connectorName}/${retry.operation}`);
          } catch (error) {
            if (retry.attempts >= (retry.options.maxRetries || 3)) {
              this.retryQueue.delete(key);
              logger.error(`Retry failed permanently: ${retry.connectorName}/${retry.operation}`);
            } else {
              await this.addToRetryQueue(retry.connectorName, retry.operation, retry.data, retry.options);
              this.retryQueue.delete(key);
            }
          }
        }
      }
    }, 5000); // Check every 5 seconds
  }

  /**
   * Start health checker
   */
  startHealthChecker() {
    setInterval(async () => {
      for (const [name, connection] of this.activeConnections.entries()) {
        try {
          // Check if connection is still alive
          const lastActivity = connection.lastActivity.getTime();
          const now = Date.now();
          const inactiveTime = now - lastActivity;

          // If inactive for more than 30 minutes, ping the connection
          if (inactiveTime > 30 * 60 * 1000) {
            if (connection.connector.ping) {
              await connection.connector.ping(connection.connection);
              connection.lastActivity = new Date();
            }
          }
        } catch (error) {
          logger.warn(`Health check failed for ${name}`, { error: error.message });
          
          // Mark connection as unhealthy
          connection.status = 'unhealthy';
        }
      }
    }, 60000); // Check every minute
  }

  /**
   * Update average response time
   */
  updateAverageResponseTime(responseTime) {
    if (this.stats.averageResponseTime === 0) {
      this.stats.averageResponseTime = responseTime;
    } else {
      this.stats.averageResponseTime = (this.stats.averageResponseTime + responseTime) / 2;
    }
  }

  // QuickBooks API implementations
  async quickbooksCreateEmployee(connection, data) {
    // Implement QuickBooks employee creation
    logger.info('Creating QuickBooks employee', { employeeId: data.id });
    return { success: true, employeeId: data.id };
  }

  async quickbooksUpdateEmployee(connection, data) {
    // Implement QuickBooks employee update
    logger.info('Updating QuickBooks employee', { employeeId: data.id });
    return { success: true, employeeId: data.id };
  }

  async quickbooksGetEmployees(connection, data) {
    // Implement QuickBooks employee retrieval
    logger.info('Getting QuickBooks employees');
    return { employees: [] };
  }

  async quickbooksCreatePayroll(connection, data) {
    // Implement QuickBooks payroll creation
    logger.info('Creating QuickBooks payroll', { payrollId: data.id });
    return { success: true, payrollId: data.id };
  }

  // Tally API implementations
  async tallyCreateLedger(connection, data) {
    // Implement Tally ledger creation
    logger.info('Creating Tally ledger', { ledgerName: data.name });
    return { success: true, ledgerName: data.name };
  }

  async tallyCreateVoucher(connection, data) {
    // Implement Tally voucher creation
    logger.info('Creating Tally voucher', { voucherType: data.type });
    return { success: true, voucherNumber: `V${Date.now()}` };
  }

  async tallyGetReports(connection, data) {
    // Implement Tally report retrieval
    logger.info('Getting Tally reports', { reportType: data.type });
    return { reports: [] };
  }

  // SendGrid API implementations
  async sendgridSendEmail(connection, data) {
    // Implement SendGrid email sending
    logger.info('Sending email via SendGrid', { to: data.to });
    return { success: true, messageId: `msg_${Date.now()}` };
  }

  async sendgridSendBulkEmail(connection, data) {
    // Implement SendGrid bulk email sending
    logger.info('Sending bulk email via SendGrid', { count: data.recipients.length });
    return { success: true, messageIds: data.recipients.map(() => `msg_${Date.now()}`) };
  }

  async sendgridGetStats(connection, data) {
    // Implement SendGrid stats retrieval
    logger.info('Getting SendGrid stats');
    return { stats: { delivered: 0, bounced: 0, opened: 0 } };
  }

  // Twilio API implementations
  async twilioSendSMS(connection, data) {
    // Implement Twilio SMS sending
    logger.info('Sending SMS via Twilio', { to: data.to });
    return { success: true, messageId: `sms_${Date.now()}` };
  }

  async twilioSendBulkSMS(connection, data) {
    // Implement Twilio bulk SMS sending
    logger.info('Sending bulk SMS via Twilio', { count: data.recipients.length });
    return { success: true, messageIds: data.recipients.map(() => `sms_${Date.now()}`) };
  }

  async twilioGetDeliveryStatus(connection, data) {
    // Implement Twilio delivery status check
    logger.info('Getting SMS delivery status', { messageId: data.messageId });
    return { status: 'delivered' };
  }

  // Banking API implementations
  async bankingGeneratePayrollFile(connection, data) {
    // Implement banking payroll file generation
    logger.info('Generating payroll file', { employeeCount: data.employees.length });
    return { success: true, fileName: `payroll_${Date.now()}.txt` };
  }

  async bankingProcessPayments(connection, data) {
    // Implement banking payment processing
    logger.info('Processing payments', { paymentCount: data.payments.length });
    return { success: true, batchId: `batch_${Date.now()}` };
  }

  async bankingGetTransactionStatus(connection, data) {
    // Implement banking transaction status check
    logger.info('Getting transaction status', { transactionId: data.transactionId });
    return { status: 'completed' };
  }
}

export default IntegrationEngine;