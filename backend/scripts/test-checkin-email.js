/**
 * Test Check-in Email
 * Sends a test check-in notification email from abhishek.rajput@hexerve.com to hr@hexerve.com
 */

import dotenv from 'dotenv';
import nodemailer from 'nodemailer';

dotenv.config({ path: './.env.production' });

const testCheckInEmail = async () => {
  try {
    console.log('🧪 Testing Check-in Email Notification...\n');
    console.log('📧 From:', 'abhishek.rajput@hexerve.com');
    console.log('📧 To:', process.env.HR_EMAIL || 'hr@hexerve.com');
    console.log('-------------------------------------------\n');

    // Verify SMTP configuration
    console.log('🔧 SMTP Configuration:');
    console.log('   Host:', process.env.SMTP_HOST);
    console.log('   Port:', process.env.SMTP_PORT);
    console.log('   User:', process.env.SMTP_USER);
    console.log('   Pass:', process.env.SMTP_PASS ? '***' : 'NOT SET');
    console.log('-------------------------------------------\n');

    // Create transporter
    console.log('📤 Creating SMTP transporter...');
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT) || 587,
      secure: false,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
      },
      tls: {
        rejectUnauthorized: false
      }
    });

    // Verify connection
    console.log('🔗 Verifying SMTP connection...');
    await transporter.verify();
    console.log('✅ SMTP connection verified!\n');

    // Prepare email
    const checkInTime = new Date();
    const time = checkInTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    const date = checkInTime.toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' });

    const emailContent = `
    <p>Dear HR Team,</p>
    <p>An employee has checked in.</p>
    <div style="background: #f9f9f9; padding: 20px; border-radius: 8px; margin: 20px 0;">
      <h3 style="color: #667eea; margin-top: 0;">🕐 Check-In Details</h3>
      <div style="margin: 10px 0;"><strong>Employee Name:</strong> Abhishek Rajput</div>
      <div style="margin: 10px 0;"><strong>Employee Email:</strong> abhishek.rajput@hexerve.com</div>
      <div style="margin: 10px 0;"><strong>Check-In Time:</strong> ${time}</div>
      <div style="margin: 10px 0;"><strong>Date:</strong> ${date}</div>
      <div style="margin: 10px 0;"><strong>Employee Code:</strong> EMP-001</div>
      <div style="margin: 10px 0;"><strong>Department:</strong> Engineering</div>
    </div>
    `;

    // Send email
    console.log('📤 Sending check-in email...');
    const info = await transporter.sendMail({
      from: `"WorkPlus HR" <${process.env.SMTP_USER}>`,
      to: process.env.HR_EMAIL || 'hr@hexerve.com',
      replyTo: 'abhishek.rajput@hexerve.com',
      subject: `Employee Check-In: Abhishek Rajput - ${time}`,
      html: emailContent,
      text: `Abhishek Rajput checked in at ${time}`
    });

    console.log('\n✅ Check-in email sent successfully!');
    console.log('\n📋 Email Details:');
    console.log('   Message ID:', info.messageId);
    console.log('   Subject: Employee Check-In: Abhishek Rajput - ' + time);
    console.log('   From: abhishek.rajput@hexerve.com');
    console.log('   To:', process.env.HR_EMAIL || 'hr@hexerve.com');
    console.log('   Status: Sent');
    console.log('\n✨ Test completed successfully!');

    process.exit(0);
  } catch (error) {
    console.error('\n❌ Error sending check-in email:', error.message);
    console.error('\nError Details:', error);
    console.error('\nTroubleshooting:');
    console.error('1. Check SMTP_HOST:', process.env.SMTP_HOST);
    console.error('2. Check SMTP_USER:', process.env.SMTP_USER);
    console.error('3. Check SMTP_PASS is set:', !!process.env.SMTP_PASS);
    console.error('4. Check HR_EMAIL:', process.env.HR_EMAIL);
    console.error('5. Verify Office 365 credentials are correct');
    console.error('6. Check if 2FA is enabled (may need app password)');
    process.exit(1);
  }
};

testCheckInEmail();
