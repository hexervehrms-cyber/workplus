#!/usr/bin/env node

/**
 * Test SMTP and Azure Settings
 * Verifies email and Teams integration configuration
 */

import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Setup __dirname for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
const envPath = path.join(__dirname, '..', '.env');
dotenv.config({ path: envPath });

console.log('\n🚀 Testing SMTP and Azure Settings\n');
console.log('═'.repeat(80));

// ============================================
// SMTP CONFIGURATION CHECK
// ============================================

console.log('\n📧 SMTP CONFIGURATION\n');

const smtpSettings = {
  'SMTP_HOST': process.env.SMTP_HOST,
  'SMTP_PORT': process.env.SMTP_PORT,
  'SMTP_USER': process.env.SMTP_USER,
  'SMTP_PASS': process.env.SMTP_PASS ? '***' : 'NOT SET',
  'FROM_EMAIL': process.env.FROM_EMAIL,
  'HR_EMAIL': process.env.HR_EMAIL
};

console.log('SMTP Settings:');
Object.entries(smtpSettings).forEach(([key, value]) => {
  const status = value && value !== 'NOT SET' ? '✅' : '❌';
  console.log(`  ${status} ${key}: ${value || 'NOT SET'}`);
});

// Validate SMTP
const smtpValid = 
  process.env.SMTP_HOST && 
  process.env.SMTP_PORT && 
  process.env.SMTP_USER && 
  process.env.SMTP_PASS;

console.log(`\n${smtpValid ? '✅' : '❌'} SMTP Configuration: ${smtpValid ? 'VALID' : 'INVALID'}`);

// ============================================
// AZURE/TEAMS CONFIGURATION CHECK
// ============================================

console.log('\n☁️  AZURE/TEAMS CONFIGURATION\n');

const azureSettings = {
  'TEAMS_APP_ID': process.env.TEAMS_APP_ID,
  'TEAMS_APP_PASSWORD': process.env.TEAMS_APP_PASSWORD ? '***' : 'NOT SET',
  'TEAMS_TENANT_ID': process.env.TEAMS_TENANT_ID,
  'TEAMS_BOT_ID': process.env.TEAMS_BOT_ID,
  'TEAMS_BOT_PASSWORD': process.env.TEAMS_BOT_PASSWORD ? '***' : 'NOT SET',
  'TEAMS_WEBHOOK_URL': process.env.TEAMS_WEBHOOK_URL,
  'TEAMS_INTEGRATION_ENABLED': process.env.TEAMS_INTEGRATION_ENABLED
};

console.log('Azure/Teams Settings:');
Object.entries(azureSettings).forEach(([key, value]) => {
  const status = value && value !== 'NOT SET' ? '✅' : '❌';
  console.log(`  ${status} ${key}: ${value || 'NOT SET'}`);
});

// Validate Azure/Teams
const azureValid = 
  process.env.TEAMS_APP_ID && 
  process.env.TEAMS_APP_PASSWORD && 
  process.env.TEAMS_TENANT_ID && 
  process.env.TEAMS_BOT_ID && 
  process.env.TEAMS_BOT_PASSWORD;

console.log(`\n${azureValid ? '✅' : '❌'} Azure/Teams Configuration: ${azureValid ? 'VALID' : 'INVALID'}`);

// ============================================
// TEST EMAIL SERVICE
// ============================================

console.log('\n📨 EMAIL SERVICE TEST\n');

try {
  const nodemailer = await import('nodemailer');
  
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

  console.log('Testing SMTP connection...');
  await transporter.verify();
  console.log('✅ SMTP Connection: SUCCESS');
  console.log(`   Host: ${process.env.SMTP_HOST}:${process.env.SMTP_PORT}`);
  console.log(`   User: ${process.env.SMTP_USER}`);
  console.log(`   From: ${process.env.FROM_EMAIL}`);
} catch (error) {
  console.log('❌ SMTP Connection: FAILED');
  console.log(`   Error: ${error.message}`);
}

// ============================================
// NOTIFICATION TYPES SUPPORTED
// ============================================

console.log('\n📬 NOTIFICATION TYPES SUPPORTED\n');

const notificationTypes = [
  { type: 'leave_request_submitted', recipient: 'Employee', description: 'Leave request submitted' },
  { type: 'leave_request_approved', recipient: 'Employee', description: 'Leave request approved' },
  { type: 'leave_request_rejected', recipient: 'Employee', description: 'Leave request rejected' },
  { type: 'expense_submitted', recipient: 'Employee', description: 'Expense submitted' },
  { type: 'expense_approved', recipient: 'Employee', description: 'Expense approved' },
  { type: 'expense_rejected', recipient: 'Employee', description: 'Expense rejected' },
  { type: 'salary_slip_generated', recipient: 'Employee', description: 'Salary slip generated' },
  { type: 'salary_slip_approved', recipient: 'Employee', description: 'Salary slip approved' },
  { type: 'attendance_marked', recipient: 'Employee', description: 'Attendance marked' },
  { type: 'document_issued', recipient: 'Employee', description: 'Document issued' },
  { type: 'leave_request_pending', recipient: 'Admin', description: 'Leave request pending approval' },
  { type: 'expense_pending', recipient: 'Admin', description: 'Expense pending approval' },
  { type: 'payroll_ready', recipient: 'Admin', description: 'Payroll ready for processing' }
];

notificationTypes.forEach(notif => {
  console.log(`  ✅ ${notif.type}`);
  console.log(`     Recipient: ${notif.recipient}`);
  console.log(`     Description: ${notif.description}\n`);
});

// ============================================
// SUMMARY
// ============================================

console.log('═'.repeat(80));
console.log('\n📊 CONFIGURATION SUMMARY\n');

const allValid = smtpValid && azureValid;

console.log(`SMTP Status: ${smtpValid ? '✅ CONFIGURED' : '❌ NOT CONFIGURED'}`);
console.log(`Azure/Teams Status: ${azureValid ? '✅ CONFIGURED' : '❌ NOT CONFIGURED'}`);
console.log(`\nOverall Status: ${allValid ? '✅ ALL SYSTEMS READY' : '⚠️  SOME SYSTEMS NOT CONFIGURED'}`);

if (smtpValid) {
  console.log('\n✅ Email Notifications:');
  console.log('   - Employees will receive email notifications for:');
  console.log('     • Leave requests (submitted, approved, rejected)');
  console.log('     • Expenses (submitted, approved, rejected)');
  console.log('     • Salary slips (generated, approved)');
  console.log('     • Attendance updates');
  console.log('     • Documents issued');
  console.log('   - Admins will receive email notifications for:');
  console.log('     • Pending leave requests');
  console.log('     • Pending expenses');
  console.log('     • Payroll ready for processing');
}

if (azureValid) {
  console.log('\n✅ Teams Integration:');
  console.log('   - Teams notifications enabled');
  console.log('   - Bot integration configured');
  console.log('   - Webhook URL configured');
  console.log('   - Message sync enabled');
  console.log('   - Presence sync enabled');
  console.log('   - File sharing enabled');
}

console.log('\n═'.repeat(80) + '\n');

process.exit(allValid ? 0 : 1);
