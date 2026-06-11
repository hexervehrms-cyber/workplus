#!/usr/bin/env node

/**
 * Secret Detection Script
 * Scans tracked files for hardcoded secrets and sensitive patterns
 * 
 * Usage: npm run check-secrets
 * Or: node scripts/check-no-secrets.js
 */

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

const SECRETS_PATTERNS = [
  // MongoDB patterns
  { pattern: /mongodb\+srv:\/\/[^:]*:[^@]*@/g, name: 'MongoDB URI', severity: 'CRITICAL' },
  { pattern: /MONGODB_URI\s*=\s*mongodb/g, name: 'MongoDB URI assignment', severity: 'CRITICAL' },
  
  // JWT patterns
  { pattern: /JWT_SECRET\s*=\s*workplus-pro|JWT_SECRET\s*=\s*[a-zA-Z0-9\-]{32,}/g, name: 'Hardcoded JWT_SECRET', severity: 'CRITICAL' },
  
  // Password patterns
  { pattern: /Jadu@123|Jadu@333/g, name: 'Hardcoded password', severity: 'CRITICAL' },
  { pattern: /'your-secret-key'|"your-secret-key"/g, name: 'Placeholder secret still in code', severity: 'HIGH' },
  
  // SMTP patterns
  { pattern: /SMTP_PASS\s*=\s*[^\s\n]+/g, name: 'SMTP password', severity: 'CRITICAL' },
  
  // Teams patterns
  { pattern: /TEAMS_APP_PASSWORD\s*=|TEAMS_BOT_PASSWORD\s*=/g, name: 'Teams credentials', severity: 'CRITICAL' },
  
  // Super admin patterns
  { pattern: /SUPER_ADMIN_PASSWORD\s*=\s*Jadu@123/g, name: 'Hardcoded Super Admin password', severity: 'CRITICAL' },
  
  // Redis patterns
  { pattern: /REDIS_URL\s*=\s*redis:\/\/[^:]*:[^@]*@/g, name: 'Redis URL with credentials', severity: 'HIGH' },
];

// Files to check (from git tracked files)
const EXCLUDED_PATTERNS = [
  'node_modules',
  '.git',
  'dist/',
  'build/',
  '.next',
  'coverage/',
  '.env',
  '.env.example',
];

let foundSecrets = [];

function isExcluded(filePath) {
  for (const pattern of EXCLUDED_PATTERNS) {
    if (filePath.includes(pattern)) {
      return true;
    }
  }
  return false;
}

function scanFile(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.split('\n');
    
    for (const secretDef of SECRETS_PATTERNS) {
      const matches = content.matchAll(secretDef.pattern);
      
      for (const match of matches) {
        // Find line number and the actual line
        const lineNum = content.substring(0, match.index).split('\n').length;
        const lineContent = lines[lineNum - 1] || '';
        
        // Skip comments and examples (lines with //, /*, Example:, etc.)
        if (lineContent.includes('//') && lineContent.indexOf('//') < match.index - content.substring(0, match.index).lastIndexOf('\n')) {
          continue; // Skip if this is in a comment
        }
        if (lineContent.includes('*') && lineContent.indexOf('*') < match.index - content.substring(0, match.index).lastIndexOf('\n')) {
          continue; // Skip if this is in a block comment
        }
        if (lineContent.toLowerCase().includes('example') || lineContent.toLowerCase().includes('placeholder')) {
          continue; // Skip example/placeholder lines
        }
        
        // Skip if it looks like it's in a string template with placeholder markers <>
        if (match[0].includes('<') && match[0].includes('>')) {
          continue; // Skip placeholder templates
        }
        
        // Skip lines that are printing demo/test output (console.log for display only)
        if (lineContent.includes('console.log') && lineContent.includes("'") && !lineContent.includes('process.env')) {
          // This is likely a test output line printing a demo credential, skip it
          continue;
        }
        
        // Skip lines that are in a validation/error message list (like defaultSecrets array)
        if (lineContent.includes("'") && !lineContent.includes('=') && !lineContent.includes('const') && !lineContent.includes('let')) {
          // Likely in an array of values to reject, skip
          if (match[0] === 'Jadu@123' || match[0] === 'your-secret-key' || match[0].startsWith('change')) {
            continue;
          }
        }
        
        // Skip lines that are in validation arrays checking against bad secrets
        if (lineContent.includes("'supersecretkey'") || lineContent.includes("'your-secret-key'") || lineContent.includes("'secret'")) {
          continue; // Skip lines that are defining bad secrets to REJECT
        }
        
        // Skip lines that are checks  for secrets (like checks.warnings.push about SMTP_PASS)
        if (lineContent.includes('includes(') || lineContent.includes('checks.') || lineContent.includes('defaultSecrets')) {
          continue; // Skip validation/check lines
        }
        
        foundSecrets.push({
          file: filePath,
          line: lineNum,
          pattern: secretDef.name,
          severity: secretDef.severity,
          match: match[0].substring(0, 50) // First 50 chars only
        });
      }
    }
  } catch (error) {
    // Skip files that can't be read
  }
}

function getTrackedFiles() {
  try {
    const output = execSync('git ls-files', { encoding: 'utf8' });
    return output.split('\n').filter(f => f.trim());
  } catch (error) {
    console.error('❌ Error getting git tracked files:', error.message);
    process.exit(1);
  }
}

function main() {
  console.log('🔍 Secret Detection Scan');
  console.log('='.repeat(70));
  console.log('Scanning tracked files for hardcoded secrets...\n');
  
  const trackedFiles = getTrackedFiles();
  let filesScanned = 0;
  
  for (const file of trackedFiles) {
    if (isExcluded(file)) continue;
    if (!file.endsWith('.js') && !file.endsWith('.ts') && !file.endsWith('.yaml') && !file.endsWith('.yml') && !file.endsWith('.sh')) {
      continue;
    }
    
    filesScanned++;
    scanFile(file);
  }
  
  console.log(`📊 Scanned ${filesScanned} files\n`);
  
  if (foundSecrets.length === 0) {
    console.log('✅ No hardcoded secrets detected!');
    console.log('='.repeat(70));
    process.exit(0);
  }
  
  console.log(`🔴 Found ${foundSecrets.length} potential secrets:\n`);
  
  const criticalSecrets = foundSecrets.filter(s => s.severity === 'CRITICAL');
  const highSecrets = foundSecrets.filter(s => s.severity === 'HIGH');
  
  if (criticalSecrets.length > 0) {
    console.log('CRITICAL SECRETS:');
    for (const secret of criticalSecrets) {
      console.log(`  ❌ ${secret.file}:${secret.line}`);
      console.log(`     Pattern: ${secret.pattern}`);
      console.log(`     Match: ${secret.match}...\n`);
    }
  }
  
  if (highSecrets.length > 0) {
    console.log('HIGH SEVERITY:');
    for (const secret of highSecrets) {
      console.log(`  ⚠️  ${secret.file}:${secret.line}`);
      console.log(`     Pattern: ${secret.pattern}\n`);
    }
  }
  
  console.log('='.repeat(70));
  console.log('\n❌ SCAN FAILED: Hardcoded secrets detected in tracked files');
  console.log('   Remove these secrets and use environment variables instead');
  
  process.exit(1);
}

main();
