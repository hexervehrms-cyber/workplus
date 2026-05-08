/**
 * Production Deployment Checklist
 * Run this script to verify all production requirements are met
 * Usage: node backend/scripts/production-checklist.js
 */

import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Load environment
dotenv.config({ path: path.join(__dirname, '../.env.production') });

const checks = {
  passed: [],
  failed: [],
  warnings: []
};

console.log('\n🔍 WORKPLUS PRODUCTION DEPLOYMENT CHECKLIST\n');
console.log('=' .repeat(60));

// ============================================================================
// ENVIRONMENT VARIABLES
// ============================================================================

console.log('\n📋 ENVIRONMENT VARIABLES');
console.log('-'.repeat(60));

const requiredEnvVars = [
  'MONGODB_URI',
  'JWT_SECRET',
  'NODE_ENV',
  'CORS_ORIGIN',
  'SMTP_HOST',
  'SMTP_PORT',
  'SMTP_USER',
  'SMTP_PASS'
];

requiredEnvVars.forEach(varName => {
  if (process.env[varName]) {
    checks.passed.push(`✅ ${varName} is configured`);
  } else {
    checks.failed.push(`❌ ${varName} is missing`);
  }
});

// Check for weak JWT_SECRET
if (process.env.JWT_SECRET && process.env.JWT_SECRET.length < 32) {
  checks.warnings.push(`⚠️  JWT_SECRET is less than 32 characters (current: ${process.env.JWT_SECRET.length})`);
}

// Check for default values
if (process.env.JWT_SECRET === 'supersecretkey') {
  checks.failed.push('❌ JWT_SECRET is using default value - MUST change in production');
}

// ============================================================================
// FILE STRUCTURE
// ============================================================================

console.log('\n📁 FILE STRUCTURE');
console.log('-'.repeat(60));

const requiredFiles = [
  'backend/config/db.js',
  'backend/middleware/auth.js',
  'backend/middleware/errorHandler.js',
  'backend/middleware/optimization.js',
  'backend/middleware/validation.js',
  'backend/routes/health.js',
  'backend/scripts/createIndexes.js',
  'backend/utils/logger.js',
  'backend/utils/emailNotificationService.js'
];

requiredFiles.forEach(file => {
  const fullPath = path.join(__dirname, '../../', file);
  if (fs.existsSync(fullPath)) {
    checks.passed.push(`✅ ${file} exists`);
  } else {
    checks.failed.push(`❌ ${file} is missing`);
  }
});

// ============================================================================
// SECURITY CHECKS
// ============================================================================

console.log('\n🔒 SECURITY CHECKS');
console.log('-'.repeat(60));

// Check if credentials are in .env.production
const envProdContent = fs.readFileSync(path.join(__dirname, '../.env.production'), 'utf8');

if (envProdContent.includes('SMTP_PASS=')) {
  checks.warnings.push('⚠️  SMTP credentials stored in .env.production - consider using secrets manager');
}

if (process.env.NODE_ENV === 'production') {
  checks.passed.push('✅ NODE_ENV is set to production');
} else {
  checks.failed.push(`❌ NODE_ENV is ${process.env.NODE_ENV}, should be production`);
}

// ============================================================================
// DATABASE CONFIGURATION
// ============================================================================

console.log('\n🗄️  DATABASE CONFIGURATION');
console.log('-'.repeat(60));

if (process.env.MONGODB_URI && process.env.MONGODB_URI.includes('mongodb+srv')) {
  checks.passed.push('✅ MongoDB Atlas connection configured');
} else {
  checks.failed.push('❌ MongoDB Atlas connection not properly configured');
}

// ============================================================================
// CORS CONFIGURATION
// ============================================================================

console.log('\n🌐 CORS CONFIGURATION');
console.log('-'.repeat(60));

if (process.env.CORS_ORIGIN && process.env.CORS_ORIGIN.includes('https')) {
  checks.passed.push('✅ CORS configured with HTTPS frontend URL');
} else {
  checks.warnings.push('⚠️  CORS_ORIGIN should use HTTPS in production');
}

// ============================================================================
// PRINT RESULTS
// ============================================================================

console.log('\n' + '='.repeat(60));
console.log('\n📊 RESULTS\n');

console.log('✅ PASSED CHECKS:');
checks.passed.forEach(check => console.log(`   ${check}`));

if (checks.warnings.length > 0) {
  console.log('\n⚠️  WARNINGS:');
  checks.warnings.forEach(warning => console.log(`   ${warning}`));
}

if (checks.failed.length > 0) {
  console.log('\n❌ FAILED CHECKS:');
  checks.failed.forEach(failed => console.log(`   ${failed}`));
}

console.log('\n' + '='.repeat(60));

const totalChecks = checks.passed.length + checks.failed.length + checks.warnings.length;
const passRate = Math.round((checks.passed.length / totalChecks) * 100);

console.log(`\n📈 OVERALL: ${checks.passed.length}/${totalChecks} checks passed (${passRate}%)\n`);

if (checks.failed.length === 0 && checks.warnings.length === 0) {
  console.log('🎉 ALL CHECKS PASSED - READY FOR PRODUCTION DEPLOYMENT!\n');
  process.exit(0);
} else if (checks.failed.length === 0) {
  console.log('⚠️  WARNINGS PRESENT - Review before deployment\n');
  process.exit(0);
} else {
  console.log('❌ CRITICAL ISSUES FOUND - Fix before deployment\n');
  process.exit(1);
}
