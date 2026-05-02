/**
 * Integration API Routes
 * 
 * Provides REST API endpoints for managing third-party integrations:
 * - Integration engine management
 * - Accounting system connections
 * - Banking file generation and processing
 * - Communication services
 * - Real-time sync operations
 * - Status monitoring and analytics
 */

import express from 'express';
import { authenticate, authorize } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import logger from '../utils/logger.js';
import IntegrationEngine from '../utils/integrationEngine.js';
import AccountingConnectors from '../utils/accountingConnectors.js';
import BankingIntegration from '../utils/bankingIntegration.js';
import CommunicationServices from '../utils/communicationServices.js';

const router = express.Router();

// Initialize integration systems
const integrationEngine = new IntegrationEngine();
const accountingConnectors = new AccountingConnectors();
const bankingIntegration = new BankingIntegration();
const communicationServices = new CommunicationServices();

// ============================================================================
// INTEGRATION ENGINE ROUTES
// ============================================================================

/**
 * Get integration statistics and status
 */
router.get('/stats', 
  authenticate,
  authorize(['admin', 'super_admin']),
  asyncHandler(async (req, res) => {
    const stats = {
      integrationEngine: integrationEngine.getStats(),
      accounting: accountingConnectors.getConnectionStatus(),
      banking: bankingIntegration.getBankingStats(),
      communication: communicationServices.getStats()
    };

    res.json({
      success: true,
      data: stats
    });
  })
);

/**
 * Get available connectors
 */
router.get('/connectors', 
  authenticate,
  authorize(['admin', 'super_admin']),
  asyncHandler(async (req, res) => {
    const connectors = integrationEngine.getStats().connectors;

    res.json({
      success: true,
      data: connectors
    });
  })
);

/**
 * Connect to external system
 */
router.post('/connect/:connectorName',
  authenticate,
  authorize(['admin', 'super_admin']),
  asyncHandler(async (req, res) => {
    const { connectorName } = req.params;
    const config = req.body;

    const connection = await integrationEngine.connect(connectorName, config);

    logger.info('Integration connection established', {
      connector: connectorName,
      userId: req.user.userId,
      orgId: req.user.orgId
    });

    res.json({
      success: true,
      message: `Connected to ${connectorName}`,
      data: { connectorName, status: 'connected' }
    });
  })
);

/**
 * Disconnect from external system
 */
router.post('/disconnect/:connectorName',
  authenticate,
  authorize(['admin', 'super_admin']),
  asyncHandler(async (req, res) => {
    const { connectorName } = req.params;

    await integrationEngine.disconnect(connectorName);

    logger.info('Integration connection closed', {
      connector: connectorName,
      userId: req.user.userId,
      orgId: req.user.orgId
    });

    res.json({
      success: true,
      message: `Disconnected from ${connectorName}`
    });
  })
);

/**
 * Make request to external system
 */
router.post('/request/:connectorName/:operation',
  authenticate,
  authorize(['admin', 'super_admin']),
  asyncHandler(async (req, res) => {
    const { connectorName, operation } = req.params;
    const data = req.body;
    const options = req.query;

    const result = await integrationEngine.request(connectorName, operation, data, options);

    res.json({
      success: true,
      data: result
    });
  })
);

/**
 * Sync data between systems
 */
router.post('/sync',
  authenticate,
  authorize(['admin', 'super_admin']),
  asyncHandler(async (req, res) => {
    const { sourceConnector, targetConnector, mapping, options } = req.body;

    const result = await integrationEngine.syncData(sourceConnector, targetConnector, mapping, options);

    logger.info('Data sync completed', {
      source: sourceConnector,
      target: targetConnector,
      userId: req.user.userId,
      orgId: req.user.orgId
    });

    res.json({
      success: true,
      message: 'Data sync completed',
      data: result
    });
  })
);

// ============================================================================
// ACCOUNTING INTEGRATION ROUTES
// ============================================================================

/**
 * Connect to accounting system
 */
router.post('/accounting/connect/:system',
  authenticate,
  authorize(['admin', 'super_admin']),
  asyncHandler(async (req, res) => {
    const { system } = req.params;
    const config = req.body;

    let connection;
    switch (system) {
      case 'quickbooks':
        connection = await accountingConnectors.connectQuickBooks(config);
        break;
      case 'tally':
        connection = await accountingConnectors.connectTally(config);
        break;
      case 'sap':
        connection = await accountingConnectors.connectSAP(config);
        break;
      default:
        return res.status(400).json({
          success: false,
          message: `Unsupported accounting system: ${system}`
        });
    }

    logger.info('Accounting system connected', {
      system,
      userId: req.user.userId,
      orgId: req.user.orgId
    });

    res.json({
      success: true,
      message: `Connected to ${system}`,
      data: { system, status: 'connected' }
    });
  })
);

/**
 * Sync employee to accounting system
 */
router.post('/accounting/sync/employee',
  authenticate,
  authorize(['admin', 'super_admin', 'hr']),
  asyncHandler(async (req, res) => {
    const { system, employeeData } = req.body;

    let result;
    switch (system) {
      case 'quickbooks':
        result = await accountingConnectors.syncEmployeeToQuickBooks(employeeData);
        break;
      case 'tally':
        result = await accountingConnectors.syncEmployeeToTally(employeeData);
        break;
      case 'sap':
        result = await accountingConnectors.syncEmployeeToSAP(employeeData);
        break;
      default:
        return res.status(400).json({
          success: false,
          message: `Unsupported accounting system: ${system}`
        });
    }

    logger.info('Employee synced to accounting system', {
      system,
      employeeId: employeeData.employeeId,
      userId: req.user.userId,
      orgId: req.user.orgId
    });

    res.json({
      success: true,
      message: 'Employee synced successfully',
      data: result
    });
  })
);

/**
 * Sync payroll to accounting system
 */
router.post('/accounting/sync/payroll',
  authenticate,
  authorize(['admin', 'super_admin', 'hr']),
  asyncHandler(async (req, res) => {
    const { system, payrollData } = req.body;

    let result;
    switch (system) {
      case 'quickbooks':
        result = await accountingConnectors.syncPayrollToQuickBooks(payrollData);
        break;
      case 'tally':
        result = await accountingConnectors.syncPayrollToTally(payrollData);
        break;
      default:
        return res.status(400).json({
          success: false,
          message: `Payroll sync not supported for: ${system}`
        });
    }

    logger.info('Payroll synced to accounting system', {
      system,
      itemCount: payrollData.items?.length || 0,
      userId: req.user.userId,
      orgId: req.user.orgId
    });

    res.json({
      success: true,
      message: 'Payroll synced successfully',
      data: result
    });
  })
);

// ============================================================================
// BANKING INTEGRATION ROUTES
// ============================================================================

/**
 * Generate payroll file for bank
 */
router.post('/banking/generate-file',
  authenticate,
  authorize(['admin', 'super_admin', 'hr']),
  asyncHandler(async (req, res) => {
    const { payrollData, bankCode, format, options } = req.body;

    // Validate required fields
    if (!payrollData || !bankCode || !format) {
      return res.status(400).json({
        success: false,
        message: 'payrollData, bankCode, and format are required'
      });
    }

    const result = await bankingIntegration.generatePayrollFile(payrollData, bankCode, format, options);

    logger.info('Banking file generated', {
      batchId: result.batchId,
      bankCode,
      format,
      employeeCount: result.employeeCount,
      userId: req.user.userId,
      orgId: req.user.orgId
    });

    res.json({
      success: true,
      message: 'Payroll file generated successfully',
      data: result
    });
  })
);

/**
 * Upload file to bank
 */
router.post('/banking/upload/:batchId',
  authenticate,
  authorize(['admin', 'super_admin']),
  asyncHandler(async (req, res) => {
    const { batchId } = req.params;
    const credentials = req.body;

    const result = await bankingIntegration.uploadFileToBank(batchId, credentials);

    logger.info('Banking file uploaded', {
      batchId,
      referenceId: result.referenceId,
      userId: req.user.userId,
      orgId: req.user.orgId
    });

    res.json({
      success: true,
      message: 'File uploaded to bank successfully',
      data: result
    });
  })
);

/**
 * Check payment status
 */
router.get('/banking/status/:batchId',
  authenticate,
  authorize(['admin', 'super_admin', 'hr']),
  asyncHandler(async (req, res) => {
    const { batchId } = req.params;

    const status = await bankingIntegration.checkPaymentStatus(batchId);

    res.json({
      success: true,
      data: status
    });
  })
);

/**
 * Generate reconciliation report
 */
router.get('/banking/reconciliation/:batchId',
  authenticate,
  authorize(['admin', 'super_admin', 'hr']),
  asyncHandler(async (req, res) => {
    const { batchId } = req.params;

    const report = await bankingIntegration.generateReconciliationReport(batchId);

    res.json({
      success: true,
      data: report
    });
  })
);

/**
 * Get all banking batches
 */
router.get('/banking/batches',
  authenticate,
  authorize(['admin', 'super_admin', 'hr']),
  asyncHandler(async (req, res) => {
    const batches = bankingIntegration.getAllBatches();

    res.json({
      success: true,
      data: batches
    });
  })
);

/**
 * Get batch details
 */
router.get('/banking/batch/:batchId',
  authenticate,
  authorize(['admin', 'super_admin', 'hr']),
  asyncHandler(async (req, res) => {
    const { batchId } = req.params;

    const batch = bankingIntegration.getBatchDetails(batchId);
    if (!batch) {
      return res.status(404).json({
        success: false,
        message: 'Batch not found'
      });
    }

    res.json({
      success: true,
      data: batch
    });
  })
);

/**
 * Download banking file
 */
router.get('/banking/download/:batchId',
  authenticate,
  authorize(['admin', 'super_admin', 'hr']),
  asyncHandler(async (req, res) => {
    const { batchId } = req.params;

    const batch = bankingIntegration.getBatchDetails(batchId);
    if (!batch) {
      return res.status(404).json({
        success: false,
        message: 'Batch not found'
      });
    }

    res.download(batch.filepath, batch.filename);
  })
);

// ============================================================================
// COMMUNICATION SERVICES ROUTES
// ============================================================================

/**
 * Send message using template
 */
router.post('/communication/send',
  authenticate,
  authorize(['admin', 'super_admin', 'hr']),
  asyncHandler(async (req, res) => {
    const { type, templateId, recipient, data, options } = req.body;

    // Validate required fields
    if (!type || !templateId || !recipient || !data) {
      return res.status(400).json({
        success: false,
        message: 'type, templateId, recipient, and data are required'
      });
    }

    const result = await communicationServices.sendMessage(type, templateId, recipient, data, options);

    logger.info('Message sent via communication service', {
      type,
      templateId,
      messageId: result.messageId,
      provider: result.provider,
      userId: req.user.userId,
      orgId: req.user.orgId
    });

    res.json({
      success: true,
      message: 'Message sent successfully',
      data: result
    });
  })
);

/**
 * Send bulk messages
 */
router.post('/communication/send-bulk',
  authenticate,
  authorize(['admin', 'super_admin', 'hr']),
  asyncHandler(async (req, res) => {
    const { type, templateId, recipients, data, options } = req.body;

    // Validate required fields
    if (!type || !templateId || !recipients || !Array.isArray(recipients)) {
      return res.status(400).json({
        success: false,
        message: 'type, templateId, and recipients array are required'
      });
    }

    const result = await communicationServices.sendBulk(type, templateId, recipients, data, options);

    logger.info('Bulk messages sent via communication service', {
      type,
      templateId,
      total: result.total,
      successful: result.successful,
      failed: result.failed,
      userId: req.user.userId,
      orgId: req.user.orgId
    });

    res.json({
      success: true,
      message: 'Bulk messages processed',
      data: result
    });
  })
);

/**
 * Get message delivery status
 */
router.get('/communication/status/:messageId',
  authenticate,
  authorize(['admin', 'super_admin', 'hr']),
  asyncHandler(async (req, res) => {
    const { messageId } = req.params;

    const status = communicationServices.getDeliveryStatus(messageId);
    if (!status) {
      return res.status(404).json({
        success: false,
        message: 'Message not found'
      });
    }

    res.json({
      success: true,
      data: status
    });
  })
);

/**
 * Get communication statistics
 */
router.get('/communication/stats',
  authenticate,
  authorize(['admin', 'super_admin', 'hr']),
  asyncHandler(async (req, res) => {
    const stats = communicationServices.getStats();

    res.json({
      success: true,
      data: stats
    });
  })
);

// ============================================================================
// WEBHOOK HANDLERS
// ============================================================================

/**
 * Handle integration webhooks
 */
router.post('/webhook/:connectorName/:event',
  asyncHandler(async (req, res) => {
    const { connectorName, event } = req.params;
    const payload = req.body;

    try {
      const result = await integrationEngine.handleWebhook(connectorName, event, payload);
      
      logger.info('Webhook processed', {
        connector: connectorName,
        event,
        success: result
      });

      res.json({
        success: true,
        message: 'Webhook processed successfully'
      });
    } catch (error) {
      logger.error('Webhook processing failed', {
        connector: connectorName,
        event,
        error: error.message
      });

      res.status(500).json({
        success: false,
        message: 'Webhook processing failed',
        error: error.message
      });
    }
  })
);

// ============================================================================
// HEALTH CHECK ROUTES
// ============================================================================

/**
 * Integration health check
 */
router.get('/health',
  authenticate,
  asyncHandler(async (req, res) => {
    const health = {
      integrationEngine: {
        status: 'healthy',
        activeConnections: integrationEngine.getStats().activeConnections,
        retryQueueSize: integrationEngine.getStats().retryQueueSize
      },
      accounting: {
        status: 'healthy',
        connections: Object.keys(accountingConnectors.getConnectionStatus()).length
      },
      banking: {
        status: 'healthy',
        activeBatches: bankingIntegration.getBankingStats().totalBatches
      },
      communication: {
        status: 'healthy',
        providers: communicationServices.getStats().providers.length,
        deliveryQueue: communicationServices.getStats().deliveryQueue
      }
    };

    res.json({
      success: true,
      data: health
    });
  })
);

export default router;