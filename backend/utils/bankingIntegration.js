/**
 * Banking Integration System
 * 
 * Comprehensive banking integration for payroll processing:
 * - Bank file generation (NACH, ACH, Wire Transfer formats)
 * - Payment processing and status tracking
 * - Multi-bank support (HDFC, ICICI, SBI, Axis, etc.)
 * - Compliance with banking standards
 * - Real-time payment status updates
 * - Automated reconciliation
 * 
 * Supported Formats:
 * - NACH (National Automated Clearing House)
 * - RTGS (Real Time Gross Settlement)
 * - NEFT (National Electronic Funds Transfer)
 * - IMPS (Immediate Payment Service)
 * - UPI (Unified Payments Interface)
 */

import logger from './logger.js';
import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';

class BankingIntegration {
  constructor() {
    this.bankConfigs = new Map();
    this.paymentQueue = new Map();
    this.paymentStatus = new Map();
    this.fileFormats = new Map();
    this.reconciliationData = new Map();
    
    this.initialize();
  }

  initialize() {
    logger.info('🏦 Initializing Banking Integration System');
    
    this.setupBankConfigurations();
    this.setupFileFormats();
    this.startPaymentProcessor();
    this.startStatusChecker();
    
    logger.info('✅ Banking Integration System initialized');
  }

  /**
   * Setup bank configurations
   */
  setupBankConfigurations() {
    // HDFC Bank configuration
    this.bankConfigs.set('hdfc', {
      name: 'HDFC Bank',
      code: 'HDFC0000001',
      ifsc: 'HDFC0000001',
      formats: ['NACH', 'RTGS', 'NEFT', 'IMPS'],
      apiEndpoint: 'https://api.hdfcbank.com/payments',
      fileUploadEndpoint: 'https://connect.hdfcbank.com/upload',
      statusEndpoint: 'https://api.hdfcbank.com/status',
      maxFileSize: 10 * 1024 * 1024, // 10MB
      maxRecordsPerFile: 10000,
      supportedCurrencies: ['INR', 'USD', 'EUR'],
      cutoffTimes: {
        RTGS: '16:30',
        NEFT: '18:00',
        IMPS: '24:00'
      }
    });

    // ICICI Bank configuration
    this.bankConfigs.set('icici', {
      name: 'ICICI Bank',
      code: 'ICIC0000001',
      ifsc: 'ICIC0000001',
      formats: ['NACH', 'RTGS', 'NEFT', 'IMPS', 'UPI'],
      apiEndpoint: 'https://api.icicibank.com/payments',
      fileUploadEndpoint: 'https://corporate.icicibank.com/upload',
      statusEndpoint: 'https://api.icicibank.com/status',
      maxFileSize: 15 * 1024 * 1024, // 15MB
      maxRecordsPerFile: 15000,
      supportedCurrencies: ['INR', 'USD', 'EUR', 'GBP'],
      cutoffTimes: {
        RTGS: '16:45',
        NEFT: '18:30',
        IMPS: '24:00'
      }
    });

    // State Bank of India configuration
    this.bankConfigs.set('sbi', {
      name: 'State Bank of India',
      code: 'SBIN0000001',
      ifsc: 'SBIN0000001',
      formats: ['NACH', 'RTGS', 'NEFT'],
      apiEndpoint: 'https://api.onlinesbi.com/payments',
      fileUploadEndpoint: 'https://corporate.onlinesbi.com/upload',
      statusEndpoint: 'https://api.onlinesbi.com/status',
      maxFileSize: 8 * 1024 * 1024, // 8MB
      maxRecordsPerFile: 8000,
      supportedCurrencies: ['INR', 'USD'],
      cutoffTimes: {
        RTGS: '16:00',
        NEFT: '17:30'
      }
    });

    // Axis Bank configuration
    this.bankConfigs.set('axis', {
      name: 'Axis Bank',
      code: 'UTIB0000001',
      ifsc: 'UTIB0000001',
      formats: ['NACH', 'RTGS', 'NEFT', 'IMPS'],
      apiEndpoint: 'https://api.axisbank.com/payments',
      fileUploadEndpoint: 'https://corporate.axisbank.com/upload',
      statusEndpoint: 'https://api.axisbank.com/status',
      maxFileSize: 12 * 1024 * 1024, // 12MB
      maxRecordsPerFile: 12000,
      supportedCurrencies: ['INR', 'USD', 'EUR'],
      cutoffTimes: {
        RTGS: '16:30',
        NEFT: '18:00',
        IMPS: '24:00'
      }
    });

    logger.info('✅ Bank configurations loaded', {
      banks: Array.from(this.bankConfigs.keys())
    });
  }

  /**
   * Setup file formats
   */
  setupFileFormats() {
    // NACH format
    this.fileFormats.set('NACH', {
      extension: '.txt',
      delimiter: '|',
      header: true,
      fields: [
        'SRNO', 'ACCOUNT_NUMBER', 'AMOUNT', 'ACCOUNT_NAME', 
        'IFSC_CODE', 'TRANSACTION_TYPE', 'BENEFICIARY_CODE',
        'SENDER_TO_RECEIVER_INFO', 'PURPOSE_CODE'
      ],
      validation: {
        accountNumber: /^[0-9]{9,18}$/,
        ifscCode: /^[A-Z]{4}0[A-Z0-9]{6}$/,
        amount: /^\d+(\.\d{1,2})?$/
      }
    });

    // RTGS format
    this.fileFormats.set('RTGS', {
      extension: '.csv',
      delimiter: ',',
      header: true,
      fields: [
        'TRANSACTION_ID', 'BENEFICIARY_NAME', 'BENEFICIARY_ACCOUNT',
        'BENEFICIARY_IFSC', 'AMOUNT', 'PURPOSE', 'REMITTER_TO_BENEFICIARY_INFO'
      ],
      validation: {
        amount: /^[2-9]\d{4,}$/, // Minimum 2 lakhs for RTGS
        ifscCode: /^[A-Z]{4}0[A-Z0-9]{6}$/
      }
    });

    // NEFT format
    this.fileFormats.set('NEFT', {
      extension: '.csv',
      delimiter: ',',
      header: true,
      fields: [
        'TRANSACTION_ID', 'BENEFICIARY_NAME', 'BENEFICIARY_ACCOUNT',
        'BENEFICIARY_IFSC', 'AMOUNT', 'PURPOSE', 'REMITTER_TO_BENEFICIARY_INFO'
      ],
      validation: {
        amount: /^\d+(\.\d{1,2})?$/,
        ifscCode: /^[A-Z]{4}0[A-Z0-9]{6}$/
      }
    });

    // IMPS format
    this.fileFormats.set('IMPS', {
      extension: '.csv',
      delimiter: ',',
      header: true,
      fields: [
        'MOBILE_NUMBER', 'MMID', 'AMOUNT', 'BENEFICIARY_NAME',
        'REMITTER_TO_BENEFICIARY_INFO', 'PURPOSE'
      ],
      validation: {
        mobileNumber: /^[6-9]\d{9}$/,
        mmid: /^\d{7}$/,
        amount: /^[1-9]\d{0,4}$/ // Maximum 2 lakhs for IMPS
      }
    });

    logger.info('✅ File formats configured', {
      formats: Array.from(this.fileFormats.keys())
    });
  }

  /**
   * Generate payroll file for bank processing
   */
  async generatePayrollFile(payrollData, bankCode, format, options = {}) {
    try {
      const bankConfig = this.bankConfigs.get(bankCode);
      if (!bankConfig) {
        throw new Error(`Bank configuration not found: ${bankCode}`);
      }

      const fileFormat = this.fileFormats.get(format);
      if (!fileFormat) {
        throw new Error(`File format not supported: ${format}`);
      }

      if (!bankConfig.formats.includes(format)) {
        throw new Error(`Bank ${bankCode} does not support format ${format}`);
      }

      logger.info(`🏦 Generating ${format} file for ${bankCode}`, {
        employeeCount: payrollData.employees.length,
        totalAmount: payrollData.totalAmount
      });

      // Validate payroll data
      this.validatePayrollData(payrollData, fileFormat);

      // Generate file content
      const fileContent = await this.generateFileContent(payrollData, fileFormat, bankConfig);

      // Generate filename
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = `${bankCode}_${format}_${timestamp}${fileFormat.extension}`;
      const filepath = path.join('uploads', 'banking', filename);

      // Ensure directory exists
      await fs.mkdir(path.dirname(filepath), { recursive: true });

      // Write file
      await fs.writeFile(filepath, fileContent, 'utf8');

      // Generate file hash for integrity
      const fileHash = crypto.createHash('sha256').update(fileContent).digest('hex');

      // Create payment batch record
      const batchId = `batch_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      const batchRecord = {
        batchId,
        bankCode,
        format,
        filename,
        filepath,
        fileHash,
        employeeCount: payrollData.employees.length,
        totalAmount: payrollData.totalAmount,
        currency: payrollData.currency || 'INR',
        createdAt: new Date(),
        status: 'generated',
        uploadedAt: null,
        processedAt: null,
        employees: payrollData.employees.map(emp => ({
          employeeId: emp.employeeId,
          name: emp.name,
          accountNumber: emp.accountNumber,
          ifscCode: emp.ifscCode,
          amount: emp.netPay,
          transactionId: `txn_${batchId}_${emp.employeeId}`
        }))
      };

      this.paymentQueue.set(batchId, batchRecord);

      logger.info(`✅ Payroll file generated: ${filename}`, {
        batchId,
        fileSize: fileContent.length,
        hash: fileHash.substring(0, 8)
      });

      // Emit event
      if (global.eventSystem) {
        global.eventSystem.emit('banking.file.generated', {
          batchId,
          bankCode,
          format,
          filename,
          employeeCount: payrollData.employees.length,
          totalAmount: payrollData.totalAmount
        });
      }

      return {
        batchId,
        filename,
        filepath,
        fileHash,
        employeeCount: payrollData.employees.length,
        totalAmount: payrollData.totalAmount,
        downloadUrl: `/api/banking/download/${batchId}`
      };
    } catch (error) {
      logger.error('❌ Payroll file generation failed', {
        bankCode,
        format,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Validate payroll data
   */
  validatePayrollData(payrollData, fileFormat) {
    if (!payrollData.employees || !Array.isArray(payrollData.employees)) {
      throw new Error('Invalid payroll data: employees array required');
    }

    if (payrollData.employees.length === 0) {
      throw new Error('No employees in payroll data');
    }

    for (const [index, employee] of payrollData.employees.entries()) {
      // Validate required fields
      if (!employee.name || !employee.accountNumber || !employee.ifscCode || !employee.netPay) {
        throw new Error(`Employee ${index + 1}: Missing required fields`);
      }

      // Validate account number
      if (fileFormat.validation.accountNumber && !fileFormat.validation.accountNumber.test(employee.accountNumber)) {
        throw new Error(`Employee ${index + 1}: Invalid account number format`);
      }

      // Validate IFSC code
      if (fileFormat.validation.ifscCode && !fileFormat.validation.ifscCode.test(employee.ifscCode)) {
        throw new Error(`Employee ${index + 1}: Invalid IFSC code format`);
      }

      // Validate amount
      if (fileFormat.validation.amount && !fileFormat.validation.amount.test(employee.netPay.toString())) {
        throw new Error(`Employee ${index + 1}: Invalid amount format`);
      }

      // Validate amount for specific formats
      if (fileFormat === this.fileFormats.get('RTGS') && employee.netPay < 200000) {
        throw new Error(`Employee ${index + 1}: RTGS minimum amount is ₹2,00,000`);
      }

      if (fileFormat === this.fileFormats.get('IMPS') && employee.netPay > 200000) {
        throw new Error(`Employee ${index + 1}: IMPS maximum amount is ₹2,00,000`);
      }
    }

    logger.info('✅ Payroll data validation passed', {
      employeeCount: payrollData.employees.length
    });
  }

  /**
   * Generate file content based on format
   */
  async generateFileContent(payrollData, fileFormat, bankConfig) {
    let content = '';

    // Add header if required
    if (fileFormat.header) {
      content += fileFormat.fields.join(fileFormat.delimiter) + '\n';
    }

    // Add data rows
    for (const [index, employee] of payrollData.employees.entries()) {
      const row = [];

      for (const field of fileFormat.fields) {
        switch (field) {
          case 'SRNO':
            row.push(index + 1);
            break;
          case 'TRANSACTION_ID':
            row.push(`txn_${Date.now()}_${employee.employeeId}`);
            break;
          case 'ACCOUNT_NUMBER':
          case 'BENEFICIARY_ACCOUNT':
            row.push(employee.accountNumber);
            break;
          case 'AMOUNT':
            row.push(employee.netPay.toFixed(2));
            break;
          case 'ACCOUNT_NAME':
          case 'BENEFICIARY_NAME':
            row.push(employee.name.toUpperCase());
            break;
          case 'IFSC_CODE':
          case 'BENEFICIARY_IFSC':
            row.push(employee.ifscCode);
            break;
          case 'TRANSACTION_TYPE':
            row.push('SALARY');
            break;
          case 'BENEFICIARY_CODE':
            row.push(employee.employeeId);
            break;
          case 'SENDER_TO_RECEIVER_INFO':
          case 'REMITTER_TO_BENEFICIARY_INFO':
            row.push(`Salary for ${new Date().toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}`);
            break;
          case 'PURPOSE_CODE':
          case 'PURPOSE':
            row.push('SALARY');
            break;
          case 'MOBILE_NUMBER':
            row.push(employee.mobileNumber || '');
            break;
          case 'MMID':
            row.push(employee.mmid || '');
            break;
          default:
            row.push('');
        }
      }

      content += row.join(fileFormat.delimiter) + '\n';
    }

    return content;
  }

  /**
   * Upload file to bank
   */
  async uploadFileToBank(batchId, credentials) {
    try {
      const batch = this.paymentQueue.get(batchId);
      if (!batch) {
        throw new Error(`Batch not found: ${batchId}`);
      }

      const bankConfig = this.bankConfigs.get(batch.bankCode);
      if (!bankConfig) {
        throw new Error(`Bank configuration not found: ${batch.bankCode}`);
      }

      logger.info(`🏦 Uploading file to ${batch.bankCode}`, {
        batchId,
        filename: batch.filename
      });

      // Read file content
      const fileContent = await fs.readFile(batch.filepath, 'utf8');

      // Simulate bank API upload (replace with actual bank API calls)
      const uploadResult = await this.simulateBankUpload(bankConfig, batch, fileContent, credentials);

      // Update batch status
      batch.status = 'uploaded';
      batch.uploadedAt = new Date();
      batch.bankReferenceId = uploadResult.referenceId;

      logger.info(`✅ File uploaded to ${batch.bankCode}`, {
        batchId,
        referenceId: uploadResult.referenceId
      });

      // Emit event
      if (global.eventSystem) {
        global.eventSystem.emit('banking.file.uploaded', {
          batchId,
          bankCode: batch.bankCode,
          referenceId: uploadResult.referenceId
        });
      }

      return uploadResult;
    } catch (error) {
      logger.error('❌ File upload failed', {
        batchId,
        error: error.message
      });
      
      // Update batch status
      const batch = this.paymentQueue.get(batchId);
      if (batch) {
        batch.status = 'upload_failed';
        batch.error = error.message;
      }
      
      throw error;
    }
  }

  /**
   * Simulate bank upload (replace with actual bank API integration)
   */
  async simulateBankUpload(bankConfig, batch, fileContent, credentials) {
    // This is a simulation - replace with actual bank API calls
    await new Promise(resolve => setTimeout(resolve, 2000)); // Simulate network delay

    const referenceId = `${bankConfig.code}_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;

    return {
      success: true,
      referenceId,
      status: 'accepted',
      message: 'File uploaded successfully',
      estimatedProcessingTime: '2-4 hours'
    };
  }

  /**
   * Check payment status
   */
  async checkPaymentStatus(batchId) {
    try {
      const batch = this.paymentQueue.get(batchId);
      if (!batch) {
        throw new Error(`Batch not found: ${batchId}`);
      }

      if (!batch.bankReferenceId) {
        return {
          batchId,
          status: batch.status,
          message: 'File not yet uploaded to bank'
        };
      }

      const bankConfig = this.bankConfigs.get(batch.bankCode);
      
      // Simulate status check (replace with actual bank API calls)
      const statusResult = await this.simulateStatusCheck(bankConfig, batch);

      // Update batch status
      batch.status = statusResult.status;
      if (statusResult.status === 'processed') {
        batch.processedAt = new Date();
      }

      // Update individual payment statuses
      if (statusResult.payments) {
        for (const payment of statusResult.payments) {
          const employee = batch.employees.find(emp => emp.transactionId === payment.transactionId);
          if (employee) {
            employee.status = payment.status;
            employee.bankTransactionId = payment.bankTransactionId;
            employee.processedAt = payment.processedAt;
          }
        }
      }

      return {
        batchId,
        status: statusResult.status,
        bankReferenceId: batch.bankReferenceId,
        totalAmount: batch.totalAmount,
        employeeCount: batch.employeeCount,
        processedCount: statusResult.processedCount || 0,
        failedCount: statusResult.failedCount || 0,
        payments: statusResult.payments || []
      };
    } catch (error) {
      logger.error('❌ Status check failed', {
        batchId,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Simulate status check (replace with actual bank API integration)
   */
  async simulateStatusCheck(bankConfig, batch) {
    // This is a simulation - replace with actual bank API calls
    await new Promise(resolve => setTimeout(resolve, 1000)); // Simulate network delay

    const statuses = ['pending', 'processing', 'processed', 'failed'];
    const randomStatus = statuses[Math.floor(Math.random() * statuses.length)];

    const payments = batch.employees.map(emp => ({
      transactionId: emp.transactionId,
      employeeId: emp.employeeId,
      status: randomStatus === 'processed' ? 'success' : randomStatus,
      bankTransactionId: randomStatus === 'processed' ? `bank_${Date.now()}_${emp.employeeId}` : null,
      processedAt: randomStatus === 'processed' ? new Date() : null
    }));

    return {
      status: randomStatus,
      processedCount: randomStatus === 'processed' ? batch.employeeCount : 0,
      failedCount: randomStatus === 'failed' ? batch.employeeCount : 0,
      payments
    };
  }

  /**
   * Generate reconciliation report
   */
  async generateReconciliationReport(batchId) {
    try {
      const batch = this.paymentQueue.get(batchId);
      if (!batch) {
        throw new Error(`Batch not found: ${batchId}`);
      }

      const report = {
        batchId,
        bankCode: batch.bankCode,
        format: batch.format,
        generatedAt: batch.createdAt,
        uploadedAt: batch.uploadedAt,
        processedAt: batch.processedAt,
        totalAmount: batch.totalAmount,
        employeeCount: batch.employeeCount,
        summary: {
          successful: 0,
          failed: 0,
          pending: 0
        },
        details: []
      };

      for (const employee of batch.employees) {
        const status = employee.status || 'pending';
        report.summary[status]++;

        report.details.push({
          employeeId: employee.employeeId,
          name: employee.name,
          accountNumber: employee.accountNumber,
          amount: employee.amount,
          status,
          transactionId: employee.transactionId,
          bankTransactionId: employee.bankTransactionId,
          processedAt: employee.processedAt
        });
      }

      // Store reconciliation data
      this.reconciliationData.set(batchId, report);

      logger.info('✅ Reconciliation report generated', {
        batchId,
        successful: report.summary.successful,
        failed: report.summary.failed,
        pending: report.summary.pending
      });

      return report;
    } catch (error) {
      logger.error('❌ Reconciliation report generation failed', {
        batchId,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Start payment processor
   */
  startPaymentProcessor() {
    setInterval(async () => {
      for (const [batchId, batch] of this.paymentQueue.entries()) {
        if (batch.status === 'uploaded' && batch.bankReferenceId) {
          try {
            await this.checkPaymentStatus(batchId);
          } catch (error) {
            logger.error('Payment processor error', {
              batchId,
              error: error.message
            });
          }
        }
      }
    }, 30000); // Check every 30 seconds
  }

  /**
   * Start status checker
   */
  startStatusChecker() {
    setInterval(async () => {
      const now = new Date();
      
      for (const [batchId, batch] of this.paymentQueue.entries()) {
        // Auto-cleanup old batches (older than 30 days)
        const age = now.getTime() - batch.createdAt.getTime();
        const thirtyDays = 30 * 24 * 60 * 60 * 1000;
        
        if (age > thirtyDays && batch.status === 'processed') {
          try {
            // Delete file
            await fs.unlink(batch.filepath);
            // Remove from queue
            this.paymentQueue.delete(batchId);
            
            logger.info('🗑️ Cleaned up old batch', { batchId });
          } catch (error) {
            logger.error('Cleanup error', { batchId, error: error.message });
          }
        }
      }
    }, 24 * 60 * 60 * 1000); // Check daily
  }

  /**
   * Get banking statistics
   */
  getBankingStats() {
    const stats = {
      totalBatches: this.paymentQueue.size,
      totalAmount: 0,
      totalEmployees: 0,
      statusBreakdown: {
        generated: 0,
        uploaded: 0,
        processing: 0,
        processed: 0,
        failed: 0
      },
      bankBreakdown: {},
      formatBreakdown: {}
    };

    for (const batch of this.paymentQueue.values()) {
      stats.totalAmount += batch.totalAmount;
      stats.totalEmployees += batch.employeeCount;
      stats.statusBreakdown[batch.status]++;
      
      stats.bankBreakdown[batch.bankCode] = (stats.bankBreakdown[batch.bankCode] || 0) + 1;
      stats.formatBreakdown[batch.format] = (stats.formatBreakdown[batch.format] || 0) + 1;
    }

    return stats;
  }

  /**
   * Get batch details
   */
  getBatchDetails(batchId) {
    return this.paymentQueue.get(batchId) || null;
  }

  /**
   * Get all batches
   */
  getAllBatches() {
    return Array.from(this.paymentQueue.values());
  }
}

export default BankingIntegration;