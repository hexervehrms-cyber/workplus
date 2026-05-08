/**
 * Email Test Script
 * Tests the email notification system by sending a test email
 */

import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// Load environment variables
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: join(__dirname, '../.env') });

async function sendTestEmail() {
  try {
    console.log('🚀 Starting email test...\n');
    
    // Check if SMTP settings are configured
    if (!process.env.SMTP_HOST || !process.env.SMTP_USER) {
      console.error('❌ SMTP settings not configured in .env file');
      process.exit(1);
    }

    console.log('📧 SMTP Configuration:');
    console.log(`   Host: ${process.env.SMTP_HOST}`);
    console.log(`   Port: ${process.env.SMTP_PORT}`);
    console.log(`   User: ${process.env.SMTP_USER}`);
    console.log(`   From: ${process.env.FROM_EMAIL}\n`);

    // Import nodemailer
    const nodemailer = await import('nodemailer');
    
    // Create transporter
    const transporter = nodemailer.default.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT) || 587,
      secure: false,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
      },
      tls: {
        ciphers: 'SSLv3',
        rejectUnauthorized: false
      }
    });

    console.log('🔍 Verifying SMTP connection...');
    await transporter.verify();
    console.log('✅ SMTP connection verified successfully!\n');

    // Prepare test email
    const testEmailHTML = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background-color: #f4f4f4; }
    .email-container { max-width: 600px; margin: 20px auto; background: white; border-radius: 10px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }
    .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; }
    .header h1 { margin: 0; font-size: 28px; }
    .content { padding: 30px; }
    .success-box { background: #d4edda; border-left: 4px solid #28a745; padding: 20px; margin: 20px 0; border-radius: 4px; }
    .info-card { background: #f9f9f9; padding: 20px; margin: 20px 0; border-radius: 8px; border-left: 4px solid #667eea; }
    .footer { background: #f9f9f9; padding: 20px; text-align: center; color: #666; font-size: 12px; border-top: 1px solid #eee; }
    .timestamp { font-family: monospace; background: #f0f0f0; padding: 5px 10px; border-radius: 4px; display: inline-block; }
  </style>
</head>
<body>
  <div class="email-container">
    <div class="header">
      <h1>🎉 Email System Test</h1>
      <p>WorkPlus HRMS Email Notification System</p>
    </div>
    <div class="content">
      <div class="success-box">
        <strong>✅ Success!</strong> Your email notification system is working perfectly!
      </div>
      
      <p>Dear Team,</p>
      <p>This is a <strong>test email</strong> to verify that the WorkPlus HRMS email notification system is configured correctly and functioning as expected.</p>
      
      <div class="info-card">
        <h3 style="margin-top: 0; color: #667eea;">📊 Test Details</h3>
        <p><strong>From:</strong> ${process.env.FROM_EMAIL || process.env.SMTP_USER}</p>
        <p><strong>To:</strong> abhishek.rajput@hexerve.com</p>
        <p><strong>SMTP Server:</strong> ${process.env.SMTP_HOST}</p>
        <p><strong>Timestamp:</strong> <span class="timestamp">${new Date().toLocaleString()}</span></p>
      </div>
      
      <h3>✅ Verified Features:</h3>
      <ul>
        <li>✓ SMTP connection established</li>
        <li>✓ Authentication successful</li>
        <li>✓ HTML email rendering</li>
        <li>✓ Professional email template</li>
        <li>✓ Microsoft 365 integration</li>
      </ul>
      
      <h3>📧 Active Email Notifications:</h3>
      <ul>
        <li>💰 Salary slip approved</li>
        <li>📅 Leave requests (submitted, approved, rejected)</li>
        <li>💳 Expense claims (submitted, approved)</li>
        <li>🎉 Welcome email for new employees</li>
        <li>🔑 Password reset notifications</li>
        <li>⏰ Attendance reminders</li>
      </ul>
      
      <p style="margin-top: 30px;">If you received this email, your email notification system is <strong style="color: #28a745;">fully operational</strong>!</p>
    </div>
    <div class="footer">
      <p><strong>WorkPlus HRMS</strong></p>
      <p>This is an automated test email from the notification system.</p>
      <p>Support: <a href="mailto:${process.env.FROM_EMAIL}">${process.env.FROM_EMAIL}</a></p>
      <p>&copy; ${new Date().getFullYear()} WorkPlus. All rights reserved.</p>
    </div>
  </div>
</body>
</html>`;

    const plainText = `
EMAIL SYSTEM TEST - WorkPlus HRMS

Success! Your email notification system is working perfectly!

This is a test email to verify that the WorkPlus HRMS email notification system is configured correctly.

Test Details:
- From: ${process.env.FROM_EMAIL || process.env.SMTP_USER}
- To: abhishek.rajput@hexerve.com
- SMTP Server: ${process.env.SMTP_HOST}
- Timestamp: ${new Date().toLocaleString()}

Verified Features:
✓ SMTP connection established
✓ Authentication successful
✓ HTML email rendering
✓ Professional email template
✓ Microsoft 365 integration

Active Email Notifications:
- Salary slip approved
- Leave requests (submitted, approved, rejected)
- Expense claims (submitted, approved)
- Welcome email for new employees
- Password reset notifications
- Attendance reminders

If you received this email, your email notification system is fully operational!

---
WorkPlus HRMS
Support: ${process.env.FROM_EMAIL}
`;

    console.log('📤 Sending test email...');
    console.log(`   From: ${process.env.FROM_EMAIL || process.env.SMTP_USER}`);
    console.log(`   To: abhishek.rajput@hexerve.com`);
    console.log(`   Subject: Test Email - WorkPlus HRMS Notification System\n`);

    const info = await transporter.sendMail({
      from: `"WorkPlus HR" <${process.env.FROM_EMAIL || process.env.SMTP_USER}>`,
      to: 'abhishek.rajput@hexerve.com',
      subject: '🎉 Test Email - WorkPlus HRMS Notification System',
      html: testEmailHTML,
      text: plainText
    });

    console.log('✅ Test email sent successfully!\n');
    console.log('📬 Email Details:');
    console.log(`   Message ID: ${info.messageId}`);
    console.log(`   Response: ${info.response}\n`);
    
    console.log('🎉 Email test completed successfully!');
    console.log('📧 Please check abhishek.rajput@hexerve.com inbox (including spam folder).\n');
    
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Email test failed!');
    console.error(`   Error: ${error.message}\n`);
    
    if (error.code === 'EAUTH') {
      console.error('💡 Authentication failed. Please check:');
      console.error('   - SMTP_USER is correct');
      console.error('   - SMTP_PASS is correct');
      console.error('   - Account has SMTP access enabled\n');
    } else if (error.code === 'ECONNECTION') {
      console.error('💡 Connection failed. Please check:');
      console.error('   - SMTP_HOST is correct');
      console.error('   - SMTP_PORT is correct');
      console.error('   - Firewall allows outbound connections\n');
    } else {
      console.error('💡 Stack trace:');
      console.error(error.stack);
    }
    
    process.exit(1);
  }
}

// Run the test
sendTestEmail();
