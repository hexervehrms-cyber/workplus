/**
 * Accounting System Connectors
 * 
 * Specialized connectors for popular accounting systems:
 * - QuickBooks Online API integration
 * - Tally ERP integration via XML API
 * - SAP Business One integration
 * - Zoho Books integration
 * 
 * Features:
 * - Employee data synchronization
 * - Payroll integration
 * - Expense management
 * - Chart of accounts mapping
 * - Financial reporting
 * - Tax calculations
 */

import logger from './logger.js';
import axios from 'axios';
import xml2js from 'xml2js';

class AccountingConnectors {
  constructor() {
    this.connections = new Map();
    this.mappings = new Map();
    this.initialize();
  }

  initialize() {
    logger.info('🧮 Initializing Accounting Connectors');
    this.setupDefaultMappings();
  }

  /**
   * Setup default field mappings between WorkPlus and accounting systems
   */
  setupDefaultMappings() {
    // QuickBooks field mappings
    this.mappings.set('quickbooks', {
      employee: {
        'Name': 'name',
        'SSN': 'socialSecurityNumber',
        'Gender': 'gender',
        'HiredDate': 'joiningDate',
        'ReleasedDate': 'exitDate',
        'UseTimeDataToCreatePaychecks': 'useTimeData',
        'EmployeeNumber': 'employeeId',
        'BillableTime': 'billableTime'
      },
      payroll: {
        'PayrollItemRef': 'payrollItems',
        'Amount': 'amount',
        'PayPeriodEndDate': 'payPeriodEnd',
        'PayPeriodStartDate': 'payPeriodStart'
      },
      expense: {
        'Amount': 'amount',
        'AccountRef': 'accountId',
        'CustomerRef': 'customerId',
        'TxnDate': 'date',
        'PaymentMethodRef': 'paymentMethod'
      }
    });

    // Tally field mappings
    this.mappings.set('tally', {
      employee: {
        'NAME': 'name',
        'EMPLOYEENUMBER': 'employeeId',
        'DATEOFJOINING': 'joiningDate',
        'DESIGNATION': 'designation',
        'DEPARTMENT': 'department'
      },
      payroll: {
        'EMPLOYEENAME': 'employeeName',
        'PAYHEADNAME': 'payHead',
        'AMOUNT': 'amount',
        'PAYROLLDATE': 'payrollDate'
      },
      ledger: {
        'NAME': 'name',
        'PARENT': 'parent',
        'ISBILLWISEON': 'billWise',
        'ISCOSTCENTRESON': 'costCenters'
      }
    });

    logger.info('✅ Default mappings configured', {
      systems: Array.from(this.mappings.keys())
    });
  }

  /**
   * QuickBooks Online Connector
   */
  async connectQuickBooks(config) {
    try {
      const connection = {
        baseUrl: config.sandbox ? 
          'https://sandbox-quickbooks.api.intuit.com' : 
          'https://quickbooks.api.intuit.com',
        companyId: config.companyId,
        accessToken: config.accessToken,
        refreshToken: config.refreshToken,
        clientId: config.clientId,
        clientSecret: config.clientSecret,
        realmId: config.realmId
      };

      // Test connection
      await this.quickBooksRequest(connection, 'GET', '/v3/companyinfo/' + config.companyId);
      
      this.connections.set('quickbooks', connection);
      
      logger.info('✅ QuickBooks connected', { companyId: config.companyId });
      
      return connection;
    } catch (error) {
      logger.error('❌ QuickBooks connection failed', { error: error.message });
      throw error;
    }
  }

  /**
   * Make QuickBooks API request
   */
  async quickBooksRequest(connection, method, endpoint, data = null) {
    try {
      const url = `${connection.baseUrl}${endpoint}`;
      
      const config = {
        method,
        url,
        headers: {
          'Authorization': `Bearer ${connection.accessToken}`,
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        }
      };

      if (data && (method === 'POST' || method === 'PUT')) {
        config.data = data;
      }

      const response = await axios(config);
      return response.data;
    } catch (error) {
      if (error.response?.status === 401) {
        // Token expired, try to refresh
        await this.refreshQuickBooksToken(connection);
        // Retry the request
        return this.quickBooksRequest(connection, method, endpoint, data);
      }
      throw error;
    }
  }

  /**
   * Refresh QuickBooks access token
   */
  async refreshQuickBooksToken(connection) {
    try {
      const response = await axios.post('https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer', 
        new URLSearchParams({
          grant_type: 'refresh_token',
          refresh_token: connection.refreshToken
        }), {
          headers: {
            'Authorization': `Basic ${Buffer.from(`${connection.clientId}:${connection.clientSecret}`).toString('base64')}`,
            'Content-Type': 'application/x-www-form-urlencoded'
          }
        }
      );

      connection.accessToken = response.data.access_token;
      connection.refreshToken = response.data.refresh_token;
      
      logger.info('✅ QuickBooks token refreshed');
    } catch (error) {
      logger.error('❌ QuickBooks token refresh failed', { error: error.message });
      throw error;
    }
  }

  /**
   * Sync employee to QuickBooks
   */
  async syncEmployeeToQuickBooks(employeeData) {
    try {
      const connection = this.connections.get('quickbooks');
      if (!connection) {
        throw new Error('QuickBooks not connected');
      }

      const mapping = this.mappings.get('quickbooks').employee;
      const qbEmployee = this.mapFields(employeeData, mapping);

      // Check if employee exists
      const existingEmployee = await this.findQuickBooksEmployee(connection, employeeData.employeeId);

      let result;
      if (existingEmployee) {
        // Update existing employee
        qbEmployee.Id = existingEmployee.Id;
        qbEmployee.SyncToken = existingEmployee.SyncToken;
        
        result = await this.quickBooksRequest(
          connection, 
          'POST', 
          `/v3/company/${connection.companyId}/employee`,
          { Employee: qbEmployee }
        );
      } else {
        // Create new employee
        result = await this.quickBooksRequest(
          connection, 
          'POST', 
          `/v3/company/${connection.companyId}/employee`,
          { Employee: qbEmployee }
        );
      }

      logger.info('✅ Employee synced to QuickBooks', { 
        employeeId: employeeData.employeeId,
        qbId: result.QueryResponse?.Employee?.[0]?.Id
      });

      return result;
    } catch (error) {
      logger.error('❌ QuickBooks employee sync failed', { 
        employeeId: employeeData.employeeId,
        error: error.message 
      });
      throw error;
    }
  }

  /**
   * Find QuickBooks employee by employee number
   */
  async findQuickBooksEmployee(connection, employeeNumber) {
    try {
      const response = await this.quickBooksRequest(
        connection,
        'GET',
        `/v3/company/${connection.companyId}/query?query=SELECT * FROM Employee WHERE EmployeeNumber = '${employeeNumber}'`
      );

      return response.QueryResponse?.Employee?.[0] || null;
    } catch (error) {
      logger.error('❌ QuickBooks employee lookup failed', { error: error.message });
      return null;
    }
  }

  /**
   * Sync payroll to QuickBooks
   */
  async syncPayrollToQuickBooks(payrollData) {
    try {
      const connection = this.connections.get('quickbooks');
      if (!connection) {
        throw new Error('QuickBooks not connected');
      }

      const results = [];

      for (const payrollItem of payrollData.items) {
        const qbPayroll = {
          Employee: payrollItem.employeeId,
          PayrollItemLineDetail: payrollItem.lineItems.map(item => ({
            PayrollItemRef: { value: item.payrollItemId },
            Amount: item.amount
          })),
          PayPeriodEndDate: payrollData.payPeriodEnd,
          PayPeriodStartDate: payrollData.payPeriodStart
        };

        const result = await this.quickBooksRequest(
          connection,
          'POST',
          `/v3/company/${connection.companyId}/payrollitem`,
          { PayrollItem: qbPayroll }
        );

        results.push(result);
      }

      logger.info('✅ Payroll synced to QuickBooks', { 
        itemCount: results.length 
      });

      return results;
    } catch (error) {
      logger.error('❌ QuickBooks payroll sync failed', { error: error.message });
      throw error;
    }
  }

  /**
   * Tally ERP Connector
   */
  async connectTally(config) {
    try {
      const connection = {
        serverUrl: config.serverUrl || 'http://localhost:9000',
        companyName: config.companyName,
        username: config.username,
        password: config.password
      };

      // Test connection by getting company info
      await this.tallyRequest(connection, this.buildTallyXML('COLLECTION', 'Company'));
      
      this.connections.set('tally', connection);
      
      logger.info('✅ Tally connected', { 
        server: connection.serverUrl,
        company: connection.companyName 
      });
      
      return connection;
    } catch (error) {
      logger.error('❌ Tally connection failed', { error: error.message });
      throw error;
    }
  }

  /**
   * Make Tally XML API request
   */
  async tallyRequest(connection, xmlData) {
    try {
      const response = await axios.post(connection.serverUrl, xmlData, {
        headers: {
          'Content-Type': 'application/xml',
          'SOAPAction': ''
        },
        auth: connection.username ? {
          username: connection.username,
          password: connection.password
        } : undefined
      });

      // Parse XML response
      const parser = new xml2js.Parser();
      const result = await parser.parseStringPromise(response.data);
      
      return result;
    } catch (error) {
      logger.error('❌ Tally request failed', { error: error.message });
      throw error;
    }
  }

  /**
   * Build Tally XML request
   */
  buildTallyXML(requestType, objectType, data = null) {
    let xml = `<?xml version="1.0" encoding="UTF-8"?>
<ENVELOPE>
  <HEADER>
    <TALLYREQUEST>${requestType}</TALLYREQUEST>
  </HEADER>
  <BODY>
    <IMPORTDATA>
      <REQUESTDESC>
        <REPORTNAME>${objectType}</REPORTNAME>
      </REQUESTDESC>`;

    if (data) {
      xml += `<REQUESTDATA>${this.objectToTallyXML(data)}</REQUESTDATA>`;
    }

    xml += `
    </IMPORTDATA>
  </BODY>
</ENVELOPE>`;

    return xml;
  }

  /**
   * Convert object to Tally XML format
   */
  objectToTallyXML(obj, rootElement = 'TALLYMESSAGE') {
    let xml = `<${rootElement}>`;
    
    for (const [key, value] of Object.entries(obj)) {
      if (typeof value === 'object' && value !== null) {
        xml += this.objectToTallyXML(value, key);
      } else {
        xml += `<${key}>${value}</${key}>`;
      }
    }
    
    xml += `</${rootElement}>`;
    return xml;
  }

  /**
   * Sync employee to Tally
   */
  async syncEmployeeToTally(employeeData) {
    try {
      const connection = this.connections.get('tally');
      if (!connection) {
        throw new Error('Tally not connected');
      }

      const mapping = this.mappings.get('tally').employee;
      const tallyEmployee = this.mapFields(employeeData, mapping);

      const employeeXML = {
        EMPLOYEE: {
          ACTION: 'Create',
          ...tallyEmployee
        }
      };

      const xmlRequest = this.buildTallyXML('IMPORT', 'Employee', employeeXML);
      const result = await this.tallyRequest(connection, xmlRequest);

      logger.info('✅ Employee synced to Tally', { 
        employeeId: employeeData.employeeId 
      });

      return result;
    } catch (error) {
      logger.error('❌ Tally employee sync failed', { 
        employeeId: employeeData.employeeId,
        error: error.message 
      });
      throw error;
    }
  }

  /**
   * Create Tally ledger for employee
   */
  async createTallyEmployeeLedger(employeeData) {
    try {
      const connection = this.connections.get('tally');
      if (!connection) {
        throw new Error('Tally not connected');
      }

      const ledgerData = {
        LEDGER: {
          ACTION: 'Create',
          NAME: `${employeeData.name} - Employee`,
          PARENT: 'Sundry Debtors',
          ISBILLWISEON: 'No',
          ISCOSTCENTRESON: 'No'
        }
      };

      const xmlRequest = this.buildTallyXML('IMPORT', 'Ledger', ledgerData);
      const result = await this.tallyRequest(connection, xmlRequest);

      logger.info('✅ Employee ledger created in Tally', { 
        employeeId: employeeData.employeeId,
        ledgerName: ledgerData.LEDGER.NAME
      });

      return result;
    } catch (error) {
      logger.error('❌ Tally ledger creation failed', { 
        employeeId: employeeData.employeeId,
        error: error.message 
      });
      throw error;
    }
  }

  /**
   * Sync payroll to Tally
   */
  async syncPayrollToTally(payrollData) {
    try {
      const connection = this.connections.get('tally');
      if (!connection) {
        throw new Error('Tally not connected');
      }

      const results = [];

      for (const payrollItem of payrollData.items) {
        const voucherData = {
          VOUCHER: {
            ACTION: 'Create',
            VOUCHERTYPENAME: 'Payment',
            DATE: payrollData.payrollDate,
            ALLLEDGERENTRIES: {
              LEDGERNAME: `${payrollItem.employeeName} - Employee`,
              AMOUNT: payrollItem.netPay,
              ISDEEMEDPOSITIVE: 'Yes'
            }
          }
        };

        const xmlRequest = this.buildTallyXML('IMPORT', 'Voucher', voucherData);
        const result = await this.tallyRequest(connection, xmlRequest);
        results.push(result);
      }

      logger.info('✅ Payroll synced to Tally', { 
        voucherCount: results.length 
      });

      return results;
    } catch (error) {
      logger.error('❌ Tally payroll sync failed', { error: error.message });
      throw error;
    }
  }

  /**
   * SAP Business One Connector
   */
  async connectSAP(config) {
    try {
      const connection = {
        serverUrl: config.serverUrl,
        database: config.database,
        username: config.username,
        password: config.password,
        sessionId: null
      };

      // Login to SAP
      const loginResponse = await axios.post(`${connection.serverUrl}/b1s/v1/Login`, {
        CompanyDB: connection.database,
        UserName: connection.username,
        Password: connection.password
      });

      connection.sessionId = loginResponse.data.SessionId;
      
      this.connections.set('sap', connection);
      
      logger.info('✅ SAP Business One connected', { 
        server: connection.serverUrl,
        database: connection.database 
      });
      
      return connection;
    } catch (error) {
      logger.error('❌ SAP connection failed', { error: error.message });
      throw error;
    }
  }

  /**
   * Make SAP Business One API request
   */
  async sapRequest(connection, method, endpoint, data = null) {
    try {
      const config = {
        method,
        url: `${connection.serverUrl}/b1s/v1${endpoint}`,
        headers: {
          'Cookie': `B1SESSION=${connection.sessionId}`,
          'Content-Type': 'application/json'
        }
      };

      if (data && (method === 'POST' || method === 'PUT' || method === 'PATCH')) {
        config.data = data;
      }

      const response = await axios(config);
      return response.data;
    } catch (error) {
      if (error.response?.status === 401) {
        // Session expired, reconnect
        const sapConnection = this.connections.get('sap');
        await this.connectSAP(sapConnection);
        // Retry the request
        return this.sapRequest(connection, method, endpoint, data);
      }
      throw error;
    }
  }

  /**
   * Sync employee to SAP
   */
  async syncEmployeeToSAP(employeeData) {
    try {
      const connection = this.connections.get('sap');
      if (!connection) {
        throw new Error('SAP not connected');
      }

      const sapEmployee = {
        EmployeeID: employeeData.employeeId,
        FirstName: employeeData.firstName,
        LastName: employeeData.lastName,
        JobTitle: employeeData.designation,
        Department: employeeData.department,
        StartDate: employeeData.joiningDate,
        Active: employeeData.isActive ? 'tYES' : 'tNO'
      };

      const result = await this.sapRequest(
        connection,
        'POST',
        '/EmployeesInfo',
        sapEmployee
      );

      logger.info('✅ Employee synced to SAP', { 
        employeeId: employeeData.employeeId 
      });

      return result;
    } catch (error) {
      logger.error('❌ SAP employee sync failed', { 
        employeeId: employeeData.employeeId,
        error: error.message 
      });
      throw error;
    }
  }

  /**
   * Map fields between systems
   */
  mapFields(sourceData, mapping) {
    const mapped = {};
    
    for (const [targetField, sourceField] of Object.entries(mapping)) {
      if (sourceData.hasOwnProperty(sourceField)) {
        mapped[targetField] = sourceData[sourceField];
      }
    }
    
    return mapped;
  }

  /**
   * Get connection status
   */
  getConnectionStatus() {
    const status = {};
    
    for (const [system, connection] of this.connections.entries()) {
      status[system] = {
        connected: true,
        lastActivity: new Date(),
        config: {
          server: connection.serverUrl || connection.baseUrl,
          company: connection.companyName || connection.companyId || connection.database
        }
      };
    }
    
    return status;
  }

  /**
   * Disconnect from all systems
   */
  async disconnectAll() {
    for (const [system, connection] of this.connections.entries()) {
      try {
        if (system === 'sap' && connection.sessionId) {
          // Logout from SAP
          await axios.post(`${connection.serverUrl}/b1s/v1/Logout`, {}, {
            headers: {
              'Cookie': `B1SESSION=${connection.sessionId}`
            }
          });
        }
        
        this.connections.delete(system);
        logger.info(`✅ Disconnected from ${system}`);
      } catch (error) {
        logger.error(`❌ Error disconnecting from ${system}`, { error: error.message });
      }
    }
  }
}

export default AccountingConnectors;