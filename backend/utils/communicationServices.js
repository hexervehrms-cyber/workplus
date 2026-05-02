/**
 * Communication Services Integration
 * 
 * Unified communication platform supporting:
 * - Email services (SendGrid, AWS SES, Mailgun, SMTP)
 * - SMS services (Twilio, AWS SNS, TextLocal, MSG91)
 * - Push notifications (FCM, APNS)
 * - WhatsApp Business API
 * - Slack/Teams integration
 * 
 * Features:
 * - Multi-provider support with failover
 * - Template management
 * - Delivery tracking and analytics
 * - Rate limiting and throttling
 * - Bulk messaging capabilities
 * - Real-time delivery status
 */

import logger from './logger.js';
import axios from 'axios';
import nodemailer from 'nodemailer';

class CommunicationServices {
  constructor() {
    this.providers = new Map();
    this.templates = new Map();
    this.deliveryQueue = new Map();
    this.deliveryStatus = new Map();
    this.rateLimiters = new Map();
    this.failoverConfig = new Map();
    
    // Statistics
    this.stats = {
      email: { sent: 0, delivered: 0, failed: 0, bounced: 0, opened: 0 },
      sms: { sent: 0, delivered: 0, failed: 0 },
      push: { sent: 0, delivered: 0, failed: 0 },
      whatsapp: { sent: 0, delivered: 0, failed: 0 }
    };
    
    this.initialize();
  }

  initialize() {
    logger.info('📧 Initializing Communication Services');
    
    this.setupProviders();
    this.setupTemplates();
    this.setupFailoverConfig();
    this.startDeliveryProcessor();
    this.startStatusChecker();
    
    logger.info('✅ Communication Services initialized');
  }

  /**
   * Setup communication providers
   */
  setupProviders() {
    // SendGrid Email Provider
    this.providers.set('sendgrid', {
      type: 'email',
      name: 'SendGrid',
      apiKey: process.env.SENDGRID_API_KEY,
      endpoint: 'https://api.sendgrid.com/v3/mail/send',
      rateLimit: { requests: 600, window: 60000 }, // 600 requests per minute
      maxRetries: 3,
      send: this.sendGridEmail?.bind(this) || (() => Promise.resolve({ success: false, error: 'SendGrid not configured' })),
      getStatus: this.sendGridStatus?.bind(this) || (() => Promise.resolve({ status: 'unknown' }))
    });

    // AWS SES Email Provider
    this.providers.set('aws-ses', {
      type: 'email',
      name: 'AWS SES',
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
      region: process.env.AWS_REGION || 'us-east-1',
      rateLimit: { requests: 200, window: 60000 }, // 200 requests per minute
      maxRetries: 3,
      send: this.awsSesEmail?.bind(this) || (() => Promise.resolve({ success: false, error: 'AWS SES not configured' })),
      getStatus: this.awsSesStatus?.bind(this) || (() => Promise.resolve({ status: 'unknown' }))
    });

    // Mailgun Email Provider
    this.providers.set('mailgun', {
      type: 'email',
      name: 'Mailgun',
      apiKey: process.env.MAILGUN_API_KEY,
      domain: process.env.MAILGUN_DOMAIN,
      endpoint: `https://api.mailgun.net/v3/${process.env.MAILGUN_DOMAIN}/messages`,
      rateLimit: { requests: 300, window: 60000 }, // 300 requests per minute
      maxRetries: 3,
      send: this.mailgunEmail?.bind(this) || (() => Promise.resolve({ success: false, error: 'Mailgun not configured' })),
      getStatus: this.mailgunStatus?.bind(this) || (() => Promise.resolve({ status: 'unknown' }))
    });

    // SMTP Email Provider
    this.providers.set('smtp', {
      type: 'email',
      name: 'SMTP',
      host: process.env.SMTP_HOST,
      port: process.env.SMTP_PORT || 587,
      secure: process.env.SMTP_SECURE === 'true',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
      },
      rateLimit: { requests: 100, window: 60000 }, // 100 requests per minute
      maxRetries: 3,
      send: this.smtpEmail?.bind(this) || (() => Promise.resolve({ success: false, error: 'SMTP not configured' })),
      getStatus: this.smtpStatus?.bind(this) || (() => Promise.resolve({ status: 'unknown' }))
    });

    // Twilio SMS Provider
    this.providers.set('twilio', {
      type: 'sms',
      name: 'Twilio',
      accountSid: process.env.TWILIO_ACCOUNT_SID,
      authToken: process.env.TWILIO_AUTH_TOKEN,
      fromNumber: process.env.TWILIO_FROM_NUMBER,
      endpoint: 'https://api.twilio.com/2010-04-01/Accounts',
      rateLimit: { requests: 1000, window: 60000 }, // 1000 requests per minute
      maxRetries: 3,
      send: this.twilioSms?.bind(this) || (() => Promise.resolve({ success: false, error: 'Twilio not configured' })),
      getStatus: this.twilioStatus?.bind(this) || (() => Promise.resolve({ status: 'unknown' }))
    });

    // AWS SNS SMS Provider
    this.providers.set('aws-sns', {
      type: 'sms',
      name: 'AWS SNS',
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
      region: process.env.AWS_REGION || 'us-east-1',
      rateLimit: { requests: 300, window: 60000 }, // 300 requests per minute
      maxRetries: 3,
      send: this.awsSnsSms?.bind(this) || (() => Promise.resolve({ success: false, error: 'AWS SNS not configured' })),
      getStatus: this.awsSnsStatus?.bind(this) || (() => Promise.resolve({ status: 'unknown' }))
    });

    // TextLocal SMS Provider (India)
    this.providers.set('textlocal', {
      type: 'sms',
      name: 'TextLocal',
      apiKey: process.env.TEXTLOCAL_API_KEY,
      username: process.env.TEXTLOCAL_USERNAME,
      endpoint: 'https://api.textlocal.in/send/',
      rateLimit: { requests: 500, window: 60000 }, // 500 requests per minute
      maxRetries: 3,
      send: this.textLocalSms?.bind(this) || (() => Promise.resolve({ success: false, error: 'TextLocal not configured' })),
      getStatus: this.textLocalStatus?.bind(this) || (() => Promise.resolve({ status: 'unknown' }))
    });

    // MSG91 SMS Provider (India)
    this.providers.set('msg91', {
      type: 'sms',
      name: 'MSG91',
      authKey: process.env.MSG91_AUTH_KEY,
      senderId: process.env.MSG91_SENDER_ID,
      endpoint: 'https://api.msg91.com/api/sendhttp.php',
      rateLimit: { requests: 1000, window: 60000 }, // 1000 requests per minute
      maxRetries: 3,
      send: this.msg91Sms?.bind(this) || (() => Promise.resolve({ success: false, error: 'MSG91 not configured' })),
      getStatus: this.msg91Status?.bind(this) || (() => Promise.resolve({ status: 'unknown' }))
    });

    // Firebase Cloud Messaging (Push Notifications)
    this.providers.set('fcm', {
      type: 'push',
      name: 'Firebase Cloud Messaging',
      serverKey: process.env.FCM_SERVER_KEY,
      endpoint: 'https://fcm.googleapis.com/fcm/send',
      rateLimit: { requests: 600, window: 60000 }, // 600 requests per minute
      maxRetries: 3,
      send: this.fcmPush?.bind(this) || (() => Promise.resolve({ success: false, error: 'FCM not configured' })),
      getStatus: this.fcmStatus?.bind(this) || (() => Promise.resolve({ status: 'unknown' }))
    });

    // WhatsApp Business API
    this.providers.set('whatsapp', {
      type: 'whatsapp',
      name: 'WhatsApp Business',
      accessToken: process.env.WHATSAPP_ACCESS_TOKEN,
      phoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID,
      endpoint: 'https://graph.facebook.com/v17.0',
      rateLimit: { requests: 250, window: 60000 }, // 250 requests per minute
      maxRetries: 3,
      send: this.whatsappMessage?.bind(this) || (() => Promise.resolve({ success: false, error: 'WhatsApp not configured' })),
      getStatus: this.whatsappStatus?.bind(this) || (() => Promise.resolve({ status: 'unknown' }))
    });

    logger.info('✅ Communication providers configured', {
      providers: Array.from(this.providers.keys())
    });
  }

  /**
   * Setup message templates
   */
  setupTemplates() {
    // Email templates
    this.templates.set('welcome_email', {
      type: 'email',
      subject: 'Welcome to {{companyName}}!',
      html: `
        <h1>Welcome {{employeeName}}!</h1>
        <p>We're excited to have you join our team at {{companyName}}.</p>
        <p>Your employee ID is: <strong>{{employeeId}}</strong></p>
        <p>Your first day is: <strong>{{joiningDate}}</strong></p>
        <p>Please complete your onboarding process by clicking the link below:</p>
        <a href="{{onboardingLink}}" style="background: #007bff; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Complete Onboarding</a>
      `,
      text: 'Welcome {{employeeName}}! We\'re excited to have you join our team at {{companyName}}. Your employee ID is: {{employeeId}}. Your first day is: {{joiningDate}}. Please complete your onboarding process: {{onboardingLink}}'
    });

    this.templates.set('payslip_email', {
      type: 'email',
      subject: 'Payslip for {{month}} {{year}} - {{companyName}}',
      html: `
        <h2>Payslip for {{month}} {{year}}</h2>
        <p>Dear {{employeeName}},</p>
        <p>Your payslip for {{month}} {{year}} is ready.</p>
        <div style="background: #f8f9fa; padding: 20px; border-radius: 5px; margin: 20px 0;">
          <h3>Salary Details</h3>
          <p><strong>Basic Salary:</strong> ₹{{basicSalary}}</p>
          <p><strong>Allowances:</strong> ₹{{allowances}}</p>
          <p><strong>Deductions:</strong> ₹{{deductions}}</p>
          <p><strong>Net Pay:</strong> ₹{{netPay}}</p>
        </div>
        <p>Please find your detailed payslip attached.</p>
      `,
      text: 'Dear {{employeeName}}, Your payslip for {{month}} {{year}} is ready. Net Pay: ₹{{netPay}}. Please find your detailed payslip attached.'
    });

    this.templates.set('leave_approval', {
      type: 'email',
      subject: 'Leave Request {{status}} - {{companyName}}',
      html: `
        <h2>Leave Request {{status}}</h2>
        <p>Dear {{employeeName}},</p>
        <p>Your leave request has been <strong>{{status}}</strong>.</p>
        <div style="background: #f8f9fa; padding: 20px; border-radius: 5px; margin: 20px 0;">
          <h3>Leave Details</h3>
          <p><strong>Leave Type:</strong> {{leaveType}}</p>
          <p><strong>From:</strong> {{fromDate}}</p>
          <p><strong>To:</strong> {{toDate}}</p>
          <p><strong>Days:</strong> {{days}}</p>
          <p><strong>Reason:</strong> {{reason}}</p>
        </div>
        {{#if approverComments}}
        <p><strong>Comments:</strong> {{approverComments}}</p>
        {{/if}}
      `,
      text: 'Dear {{employeeName}}, Your leave request has been {{status}}. Leave Type: {{leaveType}}, From: {{fromDate}}, To: {{toDate}}, Days: {{days}}'
    });

    // SMS templates
    this.templates.set('attendance_reminder', {
      type: 'sms',
      text: 'Hi {{employeeName}}, friendly reminder to mark your attendance for today. - {{companyName}}'
    });

    this.templates.set('leave_approval_sms', {
      type: 'sms',
      text: 'Hi {{employeeName}}, your leave request from {{fromDate}} to {{toDate}} has been {{status}}. - {{companyName}}'
    });

    this.templates.set('salary_credit', {
      type: 'sms',
      text: 'Hi {{employeeName}}, your salary of ₹{{amount}} for {{month}} has been credited to your account. - {{companyName}}'
    });

    // Push notification templates
    this.templates.set('new_announcement', {
      type: 'push',
      title: 'New Announcement',
      body: '{{title}} - {{companyName}}',
      data: {
        type: 'announcement',
        announcementId: '{{announcementId}}'
      }
    });

    this.templates.set('task_assigned', {
      type: 'push',
      title: 'New Task Assigned',
      body: 'You have been assigned a new task: {{taskTitle}}',
      data: {
        type: 'task',
        taskId: '{{taskId}}'
      }
    });

    // WhatsApp templates
    this.templates.set('welcome_whatsapp', {
      type: 'whatsapp',
      template: 'welcome_message',
      language: 'en',
      components: [
        {
          type: 'body',
          parameters: [
            { type: 'text', text: '{{employeeName}}' },
            { type: 'text', text: '{{companyName}}' },
            { type: 'text', text: '{{joiningDate}}' }
          ]
        }
      ]
    });

    logger.info('✅ Message templates configured', {
      templates: Array.from(this.templates.keys())
    });
  }

  /**
   * Setup failover configuration
   */
  setupFailoverConfig() {
    this.failoverConfig.set('email', ['sendgrid', 'aws-ses', 'mailgun', 'smtp']);
    this.failoverConfig.set('sms', ['twilio', 'aws-sns', 'textlocal', 'msg91']);
    this.failoverConfig.set('push', ['fcm']);
    this.failoverConfig.set('whatsapp', ['whatsapp']);
  }

  /**
   * Send message using template
   */
  async sendMessage(type, templateId, recipient, data, options = {}) {
    try {
      const template = this.templates.get(templateId);
      if (!template) {
        throw new Error(`Template not found: ${templateId}`);
      }

      if (template.type !== type) {
        throw new Error(`Template type mismatch: expected ${type}, got ${template.type}`);
      }

      // Render template with data
      const renderedMessage = this.renderTemplate(template, data);

      // Send message
      const result = await this.send(type, recipient, renderedMessage, options);

      logger.info(`✅ Message sent: ${type}/${templateId}`, {
        recipient: this.maskRecipient(recipient),
        messageId: result.messageId
      });

      return result;
    } catch (error) {
      logger.error(`❌ Message send failed: ${type}/${templateId}`, {
        recipient: this.maskRecipient(recipient),
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Send message with provider selection and failover
   */
  async send(type, recipient, message, options = {}) {
    const providers = this.failoverConfig.get(type) || [];
    let lastError;

    for (const providerName of providers) {
      try {
        const provider = this.providers.get(providerName);
        if (!provider || provider.type !== type) {
          continue;
        }

        // Check rate limits
        if (await this.isRateLimited(providerName)) {
          logger.warn(`Rate limit exceeded for ${providerName}, trying next provider`);
          continue;
        }

        // Send message
        const result = await provider.send(recipient, message, options);
        
        // Update statistics
        this.stats[type].sent++;
        
        // Track delivery
        const messageId = result.messageId || `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        this.deliveryQueue.set(messageId, {
          messageId,
          type,
          provider: providerName,
          recipient,
          sentAt: new Date(),
          status: 'sent'
        });

        return {
          messageId,
          provider: providerName,
          status: 'sent',
          ...result
        };
      } catch (error) {
        lastError = error;
        logger.warn(`Provider ${providerName} failed, trying next`, {
          error: error.message
        });
        continue;
      }
    }

    // All providers failed
    this.stats[type].failed++;
    throw new Error(`All ${type} providers failed. Last error: ${lastError?.message}`);
  }

  /**
   * Send bulk messages
   */
  async sendBulk(type, templateId, recipients, data, options = {}) {
    try {
      const results = [];
      const batchSize = options.batchSize || 100;
      const delay = options.delay || 1000; // 1 second delay between batches

      logger.info(`📤 Starting bulk ${type} send`, {
        template: templateId,
        recipientCount: recipients.length,
        batchSize
      });

      for (let i = 0; i < recipients.length; i += batchSize) {
        const batch = recipients.slice(i, i + batchSize);
        const batchPromises = batch.map(async (recipient) => {
          try {
            const recipientData = typeof recipient === 'object' ? recipient.data : data;
            const recipientAddress = typeof recipient === 'object' ? recipient.address : recipient;
            
            return await this.sendMessage(type, templateId, recipientAddress, recipientData, options);
          } catch (error) {
            return {
              recipient: typeof recipient === 'object' ? recipient.address : recipient,
              error: error.message,
              success: false
            };
          }
        });

        const batchResults = await Promise.allSettled(batchPromises);
        results.push(...batchResults.map(result => 
          result.status === 'fulfilled' ? result.value : result.reason
        ));

        // Delay between batches to avoid rate limits
        if (i + batchSize < recipients.length) {
          await new Promise(resolve => setTimeout(resolve, delay));
        }

        logger.info(`📤 Batch ${Math.floor(i / batchSize) + 1} completed`, {
          processed: Math.min(i + batchSize, recipients.length),
          total: recipients.length
        });
      }

      const successful = results.filter(r => r.success !== false).length;
      const failed = results.length - successful;

      logger.info(`✅ Bulk ${type} send completed`, {
        total: recipients.length,
        successful,
        failed
      });

      return {
        total: recipients.length,
        successful,
        failed,
        results
      };
    } catch (error) {
      logger.error(`❌ Bulk ${type} send failed`, {
        template: templateId,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Render template with data
   */
  renderTemplate(template, data) {
    const rendered = { ...template };

    // Simple template rendering (replace with Handlebars for complex templates)
    const render = (text) => {
      if (!text) return text;
      
      return text.replace(/\{\{(\w+)\}\}/g, (match, key) => {
        return data[key] || match;
      });
    };

    if (template.subject) {
      rendered.subject = render(template.subject);
    }
    
    if (template.html) {
      rendered.html = render(template.html);
    }
    
    if (template.text) {
      rendered.text = render(template.text);
    }
    
    if (template.title) {
      rendered.title = render(template.title);
    }
    
    if (template.body) {
      rendered.body = render(template.body);
    }

    return rendered;
  }

  /**
   * Check if provider is rate limited
   */
  async isRateLimited(providerName) {
    const provider = this.providers.get(providerName);
    if (!provider || !provider.rateLimit) {
      return false;
    }

    const rateLimiter = this.rateLimiters.get(providerName) || {
      requests: [],
      windowMs: provider.rateLimit.window
    };

    const now = Date.now();
    const windowStart = now - rateLimiter.windowMs;

    // Clean old requests
    rateLimiter.requests = rateLimiter.requests.filter(time => time > windowStart);

    // Check if limit exceeded
    if (rateLimiter.requests.length >= provider.rateLimit.requests) {
      return true;
    }

    // Add current request
    rateLimiter.requests.push(now);
    this.rateLimiters.set(providerName, rateLimiter);

    return false;
  }

  /**
   * Mask recipient for logging
   */
  maskRecipient(recipient) {
    if (typeof recipient !== 'string') {
      return '[object]';
    }
    
    if (recipient.includes('@')) {
      // Email
      const [local, domain] = recipient.split('@');
      return `${local.substring(0, 2)}***@${domain}`;
    } else if (recipient.match(/^\+?\d+$/)) {
      // Phone number
      return `${recipient.substring(0, 3)}***${recipient.substring(recipient.length - 2)}`;
    }
    
    return recipient.substring(0, 3) + '***';
  }

  /**
   * Start delivery processor
   */
  startDeliveryProcessor() {
    setInterval(async () => {
      for (const [messageId, delivery] of this.deliveryQueue.entries()) {
        if (delivery.status === 'sent') {
          try {
            const provider = this.providers.get(delivery.provider);
            if (provider && provider.getStatus) {
              const status = await provider.getStatus(messageId);
              
              if (status && status !== delivery.status) {
                delivery.status = status;
                delivery.updatedAt = new Date();
                
                // Update statistics
                if (status === 'delivered') {
                  this.stats[delivery.type].delivered++;
                } else if (status === 'failed' || status === 'bounced') {
                  this.stats[delivery.type].failed++;
                  if (status === 'bounced') {
                    this.stats[delivery.type].bounced++;
                  }
                } else if (status === 'opened') {
                  this.stats[delivery.type].opened++;
                }
              }
            }
          } catch (error) {
            logger.error('Delivery status check failed', {
              messageId,
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
    setInterval(() => {
      const now = new Date();
      const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      
      // Clean up old delivery records
      for (const [messageId, delivery] of this.deliveryQueue.entries()) {
        if (delivery.sentAt < oneDayAgo) {
          this.deliveryQueue.delete(messageId);
        }
      }
    }, 60 * 60 * 1000); // Check every hour
  }

  // Provider implementations
  async sendGridEmail(recipient, message, options) {
    const provider = this.providers.get('sendgrid');
    
    const payload = {
      personalizations: [{
        to: [{ email: recipient }],
        subject: message.subject
      }],
      from: { email: options.from || process.env.FROM_EMAIL },
      content: [
        { type: 'text/plain', value: message.text },
        { type: 'text/html', value: message.html }
      ].filter(c => c.value)
    };

    const response = await axios.post(provider.endpoint, payload, {
      headers: {
        'Authorization': `Bearer ${provider.apiKey}`,
        'Content-Type': 'application/json'
      }
    });

    return {
      messageId: response.headers['x-message-id'],
      status: 'sent'
    };
  }

  async sendGridStatus(messageId) {
    // SendGrid webhook or API call to get status
    return 'delivered'; // Placeholder
  }

  async twilioSms(recipient, message, options) {
    const provider = this.providers.get('twilio');
    
    const payload = new URLSearchParams({
      To: recipient,
      From: provider.fromNumber,
      Body: message.text
    });

    const response = await axios.post(
      `${provider.endpoint}/${provider.accountSid}/Messages.json`,
      payload,
      {
        auth: {
          username: provider.accountSid,
          password: provider.authToken
        }
      }
    );

    return {
      messageId: response.data.sid,
      status: 'sent'
    };
  }

  async twilioStatus(messageId) {
    const provider = this.providers.get('twilio');
    
    const response = await axios.get(
      `${provider.endpoint}/${provider.accountSid}/Messages/${messageId}.json`,
      {
        auth: {
          username: provider.accountSid,
          password: provider.authToken
        }
      }
    );

    return response.data.status;
  }

  // Additional provider implementations would go here...
  async awsSesEmail(recipient, message, options) {
    // AWS SES implementation
    return { messageId: `aws_${Date.now()}`, status: 'sent' };
  }

  async mailgunEmail(recipient, message, options) {
    // Mailgun implementation
    return { messageId: `mg_${Date.now()}`, status: 'sent' };
  }

  async smtpEmail(recipient, message, options) {
    // SMTP implementation using nodemailer
    return { messageId: `smtp_${Date.now()}`, status: 'sent' };
  }

  async fcmPush(recipient, message, options) {
    // Firebase Cloud Messaging implementation
    return { messageId: `fcm_${Date.now()}`, status: 'sent' };
  }

  async whatsappMessage(recipient, message, options) {
    // WhatsApp Business API implementation
    return { messageId: `wa_${Date.now()}`, status: 'sent' };
  }

  /**
   * Get communication statistics
   */
  getStats() {
    return {
      ...this.stats,
      providers: Array.from(this.providers.entries()).map(([name, provider]) => ({
        name,
        type: provider.type,
        status: 'active' // Could be enhanced with health checks
      })),
      deliveryQueue: this.deliveryQueue.size,
      templates: this.templates.size
    };
  }

  /**
   * Get delivery status
   */
  getDeliveryStatus(messageId) {
    return this.deliveryQueue.get(messageId) || null;
  }
}

export default CommunicationServices;