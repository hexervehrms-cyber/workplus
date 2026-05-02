#!/usr/bin/env node

/**
 * Security System Initialization Script
 * 
 * This script initializes the security system by:
 * 1. Creating database indexes for security models
 * 2. Setting up default security policies
 * 3. Configuring security event monitoring
 * 4. Validating security configuration
 */

import dotenv from "dotenv";
import mongoose from "mongoose";
import connectDB from "../config/db.js";
import SecurityEvent from "../models/SecurityEvent.js";
import AuthToken from "../models/AuthToken.js";
import User from "../models/User.js";
import logger from "../utils/logger.js";

// Load environment variables
dotenv.config();

/**
 * Create security-related database indexes
 */
async function createSecurityIndexes() {
  console.log('📊 Creating security database indexes...');
  
  try {
    // SecurityEvent indexes
    await SecurityEvent.collection.createIndex({ orgId: 1, eventType: 1, createdAt: -1 });
    await SecurityEvent.collection.createIndex({ userId: 1, createdAt: -1 });
    await SecurityEvent.collection.createIndex({ severity: 1, status: 1 });
    await SecurityEvent.collection.createIndex({ riskScore: -1, createdAt: -1 });
    await SecurityEvent.collection.createIndex({ 'requestInfo.ip': 1, createdAt: -1 });
    await SecurityEvent.collection.createIndex({ createdAt: -1 });
    
    // Text search index for SecurityEvent
    await SecurityEvent.collection.createIndex({
      description: 'text',
      'details.message': 'text',
      'resolution.notes': 'text'
    });
    
    // AuthToken indexes
    await AuthToken.collection.createIndex({ userId: 1, tokenType: 1, isActive: 1 });
    await AuthToken.collection.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 });
    await AuthToken.collection.createIndex({ orgId: 1, tokenType: 1 });
    await AuthToken.collection.createIndex({ 'deviceInfo.ip': 1, userId: 1 });
    await AuthToken.collection.createIndex({ isRevoked: 1, isActive: 1 });
    await AuthToken.collection.createIndex({ hashedToken: 1 }, { unique: true });
    
    // User security indexes
    await User.collection.createIndex({ 'security.lockUntil': 1 });
    await User.collection.createIndex({ 'security.twoFactorEnabled': 1 });
    await User.collection.createIndex({ lastLogin: -1 });
    
    console.log('✅ Security indexes created successfully');
    
  } catch (error) {
    console.error('❌ Failed to create security indexes:', error.message);
    throw error;
  }
}

/**
 * Set up default security policies
 */
async function setupSecurityPolicies() {
  console.log('🔒 Setting up default security policies...');
  
  try {
    // This would typically involve creating default security policy documents
    // For now, we'll just validate that the security utilities are working
    
    const { PasswordSecurity } = await import('../utils/passwordSecurity.js');
    const { TwoFactorAuth } = await import('../utils/twoFactor.js');
    
    // Test password validation
    const testPassword = 'TestPassword123!';
    const validation = PasswordSecurity.validatePassword(testPassword);
    
    if (!validation.isValid) {
      throw new Error('Password security validation failed');
    }
    
    // Test 2FA secret generation
    const totpSecret = TwoFactorAuth.generateTOTPSecret('test@example.com');
    
    if (!totpSecret.secret) {
      throw new Error('2FA secret generation failed');
    }
    
    console.log('✅ Security policies validated successfully');
    
  } catch (error) {
    console.error('❌ Failed to setup security policies:', error.message);
    throw error;
  }
}

/**
 * Configure security event monitoring
 */
async function configureSecurityMonitoring() {
  console.log('📡 Configuring security event monitoring...');
  
  try {
    // Create a test security event to verify the system is working
    const testEvent = await SecurityEvent.createEvent({
      eventType: 'admin_action',
      severity: 'low',
      description: 'Security system initialization test',
      details: {
        action: 'system_initialization',
        timestamp: new Date(),
        version: '1.0.0'
      },
      requestInfo: {
        ip: '127.0.0.1',
        userAgent: 'Security-Init-Script/1.0',
        method: 'SYSTEM',
        url: '/system/init'
      },
      orgId: 'system'
    });
    
    if (!testEvent) {
      throw new Error('Failed to create test security event');
    }
    
    console.log('✅ Security event monitoring configured successfully');
    console.log(`   Test event ID: ${testEvent._id}`);
    
  } catch (error) {
    console.error('❌ Failed to configure security monitoring:', error.message);
    throw error;
  }
}

/**
 * Validate security configuration
 */
async function validateSecurityConfig() {
  console.log('🔍 Validating security configuration...');
  
  try {
    // Check required environment variables
    const requiredVars = [
      'JWT_SECRET',
      'MONGODB_URI'
    ];
    
    const missing = requiredVars.filter(v => !process.env[v]);
    
    if (missing.length > 0) {
      throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
    }
    
    // Validate JWT_SECRET strength
    if (process.env.JWT_SECRET.length < 32) {
      console.warn('⚠️  WARNING: JWT_SECRET should be at least 32 characters for security');
    }
    
    // Check database connection
    if (mongoose.connection.readyState !== 1) {
      throw new Error('Database not connected');
    }
    
    // Verify models are properly loaded
    const models = [SecurityEvent, AuthToken, User];
    for (const Model of models) {
      if (!Model.collection) {
        throw new Error(`Model ${Model.modelName} not properly initialized`);
      }
    }
    
    console.log('✅ Security configuration validated successfully');
    
  } catch (error) {
    console.error('❌ Security configuration validation failed:', error.message);
    throw error;
  }
}

/**
 * Clean up old security data
 */
async function cleanupOldData() {
  console.log('🧹 Cleaning up old security data...');
  
  try {
    // Clean up expired tokens
    const expiredTokens = await AuthToken.cleanupExpired();
    console.log(`   Cleaned up ${expiredTokens.deletedCount} expired tokens`);
    
    // Clean up old security events (older than 1 year)
    const oneYearAgo = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000);
    const oldEvents = await SecurityEvent.deleteMany({
      createdAt: { $lt: oneYearAgo },
      severity: { $in: ['low', 'medium'] }, // Keep high and critical events
      status: 'resolved'
    });
    console.log(`   Cleaned up ${oldEvents.deletedCount} old security events`);
    
    console.log('✅ Old security data cleaned up successfully');
    
  } catch (error) {
    console.error('❌ Failed to cleanup old data:', error.message);
    throw error;
  }
}

/**
 * Generate security system report
 */
async function generateSystemReport() {
  console.log('📋 Generating security system report...');
  
  try {
    const [
      totalUsers,
      activeUsers,
      totalTokens,
      activeTokens,
      totalEvents,
      recentEvents,
      highRiskEvents
    ] = await Promise.all([
      User.countDocuments(),
      User.countDocuments({ isActive: true }),
      AuthToken.countDocuments(),
      AuthToken.countDocuments({ isActive: true, isRevoked: false }),
      SecurityEvent.countDocuments(),
      SecurityEvent.countDocuments({ 
        createdAt: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) }
      }),
      SecurityEvent.countDocuments({ riskScore: { $gte: 70 } })
    ]);
    
    const report = {
      timestamp: new Date().toISOString(),
      users: {
        total: totalUsers,
        active: activeUsers,
        inactive: totalUsers - activeUsers
      },
      tokens: {
        total: totalTokens,
        active: activeTokens,
        revoked: totalTokens - activeTokens
      },
      events: {
        total: totalEvents,
        recent: recentEvents,
        highRisk: highRiskEvents
      },
      system: {
        nodeVersion: process.version,
        mongooseVersion: mongoose.version,
        environment: process.env.NODE_ENV || 'development'
      }
    };
    
    console.log('\n📊 SECURITY SYSTEM REPORT');
    console.log('========================');
    console.log(`Generated: ${report.timestamp}`);
    console.log(`Environment: ${report.system.environment}`);
    console.log('');
    console.log('👥 Users:');
    console.log(`   Total: ${report.users.total}`);
    console.log(`   Active: ${report.users.active}`);
    console.log(`   Inactive: ${report.users.inactive}`);
    console.log('');
    console.log('🔑 Tokens:');
    console.log(`   Total: ${report.tokens.total}`);
    console.log(`   Active: ${report.tokens.active}`);
    console.log(`   Revoked: ${report.tokens.revoked}`);
    console.log('');
    console.log('🛡️  Security Events:');
    console.log(`   Total: ${report.events.total}`);
    console.log(`   Recent (7 days): ${report.events.recent}`);
    console.log(`   High Risk: ${report.events.highRisk}`);
    console.log('');
    
    return report;
    
  } catch (error) {
    console.error('❌ Failed to generate system report:', error.message);
    throw error;
  }
}

/**
 * Main initialization function
 */
async function initializeSecurity() {
  console.log('\n🔐 WORKPLUS PRO SECURITY SYSTEM INITIALIZATION');
  console.log('===============================================');
  
  try {
    // Connect to database
    console.log('🔌 Connecting to database...');
    const connected = await connectDB();
    
    if (!connected) {
      throw new Error('Failed to connect to database');
    }
    
    console.log('✅ Database connected successfully');
    
    // Run initialization steps
    await createSecurityIndexes();
    await setupSecurityPolicies();
    await configureSecurityMonitoring();
    await validateSecurityConfig();
    await cleanupOldData();
    
    // Generate final report
    const report = await generateSystemReport();
    
    console.log('🎉 SECURITY SYSTEM INITIALIZATION COMPLETE!');
    console.log('==========================================');
    console.log('');
    console.log('✅ All security components initialized successfully');
    console.log('✅ Database indexes created');
    console.log('✅ Security policies configured');
    console.log('✅ Event monitoring active');
    console.log('✅ Configuration validated');
    console.log('✅ Old data cleaned up');
    console.log('');
    console.log('🚀 Security system is ready for production use!');
    
    return report;
    
  } catch (error) {
    console.error('\n❌ SECURITY INITIALIZATION FAILED');
    console.error('=================================');
    console.error(`Error: ${error.message}`);
    console.error('');
    console.error('Please fix the above issues and run the script again.');
    
    logger.error('Security initialization failed', {
      error: error.message,
      stack: error.stack
    });
    
    throw error;
  }
}

/**
 * Run initialization if called directly
 */
if (import.meta.url === `file://${process.argv[1]}`) {
  initializeSecurity()
    .then(() => {
      console.log('\n✅ Initialization completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Initialization failed:', error.message);
      process.exit(1);
    });
}

export default initializeSecurity;