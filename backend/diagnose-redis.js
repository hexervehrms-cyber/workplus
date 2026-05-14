/**
 * Redis Connection Diagnostic Tool
 * Run this to diagnose Redis connection issues
 */

import dotenv from 'dotenv';
import { URL } from 'url';

dotenv.config({ path: './backend/.env' });

console.log('🔍 Redis Connection Diagnostic\n');
console.log('=' .repeat(60));

const redisUrl = process.env.REDIS_URL;

if (!redisUrl) {
  console.log('❌ REDIS_URL is not set');
  console.log('\nTo fix:');
  console.log('1. Add REDIS_URL to your .env file');
  console.log('2. Format: redis://[:password@]hostname[:port]');
  console.log('3. Example: redis://:mypassword@localhost:6379');
  process.exit(1);
}

console.log('✅ REDIS_URL is configured\n');

try {
  const url = new URL(redisUrl);
  
  console.log('📋 URL Components:');
  console.log(`   Protocol: ${url.protocol}`);
  console.log(`   Hostname: ${url.hostname}`);
  console.log(`   Port: ${url.port || '6379 (default)'}`);
  console.log(`   Username: ${url.username || '(none)'}`);
  console.log(`   Password: ${url.password ? '***' + url.password.slice(-3) : '(none)'}`);
  console.log(`   Database: ${url.pathname.slice(1) || '0 (default)'}`);
  
  console.log('\n📊 Analysis:');
  
  // Check protocol
  if (url.protocol !== 'redis:') {
    console.log('⚠️  Protocol is not "redis:" - this might be an issue');
  } else {
    console.log('✅ Protocol is correct (redis:)');
  }
  
  // Check hostname
  if (!url.hostname) {
    console.log('❌ Hostname is missing');
  } else {
    console.log(`✅ Hostname is set: ${url.hostname}`);
  }
  
  // Check port
  const port = url.port || 6379;
  if (port === 6379) {
    console.log(`✅ Port is default (6379)`);
  } else {
    console.log(`✅ Port is custom: ${port}`);
  }
  
  // Check password
  if (!url.password) {
    console.log('⚠️  No password configured - Redis might require authentication');
  } else {
    console.log('✅ Password is configured');
  }
  
  console.log('\n🔗 Full URL (sanitized):');
  const sanitized = `redis://${url.username ? url.username + ':***@' : ''}${url.hostname}:${url.port || 6379}${url.pathname}`;
  console.log(`   ${sanitized}`);
  
  console.log('\n💡 Common Issues:');
  console.log('1. Missing password - Render Redis usually requires a password');
  console.log('2. Wrong hostname - Check Render Redis instance details');
  console.log('3. Network access - Ensure backend can reach Redis');
  console.log('4. Firewall rules - Check Render security settings');
  
  console.log('\n📝 Next Steps:');
  console.log('1. Go to Render dashboard');
  console.log('2. Find your Redis instance');
  console.log('3. Copy the full connection string (including password)');
  console.log('4. Update REDIS_URL in Render environment variables');
  console.log('5. Redeploy the backend service');
  
} catch (error) {
  console.log('❌ Invalid Redis URL format');
  console.log(`   Error: ${error.message}`);
  console.log('\n📝 Expected format:');
  console.log('   redis://[:password@]hostname[:port][/database]');
  console.log('\n📝 Examples:');
  console.log('   redis://localhost:6379');
  console.log('   redis://:password@localhost:6379');
  console.log('   redis://user:password@redis.example.com:6379/0');
}

console.log('\n' + '='.repeat(60));
