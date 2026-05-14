/**
 * Redis Client Utility
 * Provides a singleton Redis client for caching and session management
 */

import logger from './logger.js';

let redisClient = null;
let isConnected = false;

/**
 * Initialize Redis client
 */
async function initializeRedis() {
  const redisUrl = process.env.REDIS_URL;
  
  if (!redisUrl) {
    logger.warn('REDIS_URL not configured - caching disabled');
    return null;
  }

  try {
    const { createClient } = await import('redis');
    redisClient = createClient({ url: redisUrl });

    redisClient.on('error', (err) => {
      logger.error('Redis client error:', err.message);
      isConnected = false;
    });

    redisClient.on('connect', () => {
      logger.info('Redis client connected');
      isConnected = true;
    });

    redisClient.on('ready', () => {
      logger.info('Redis client ready');
      isConnected = true;
    });

    await redisClient.connect();
    isConnected = true;
    logger.info('Redis client initialized successfully');
    return redisClient;
  } catch (error) {
    logger.warn('Failed to initialize Redis client', { error: error.message });
    isConnected = false;
    return null;
  }
}

/**
 * Get Redis client instance
 */
function getClient() {
  return redisClient;
}

/**
 * Check if Redis is connected
 */
function isRedisConnected() {
  return isConnected && redisClient !== null;
}

/**
 * Get value from Redis
 */
async function get(key) {
  if (!isRedisConnected()) {
    return null;
  }

  try {
    const value = await redisClient.get(key);
    return value ? JSON.parse(value) : null;
  } catch (error) {
    logger.warn('Redis get error', { key, error: error.message });
    return null;
  }
}

/**
 * Set value in Redis
 */
async function set(key, value, expirationSeconds = null) {
  if (!isRedisConnected()) {
    return false;
  }

  try {
    const options = {};
    if (expirationSeconds) {
      options.EX = expirationSeconds;
    }
    await redisClient.set(key, JSON.stringify(value), options);
    return true;
  } catch (error) {
    logger.warn('Redis set error', { key, error: error.message });
    return false;
  }
}

/**
 * Delete value from Redis
 */
async function del(key) {
  if (!isRedisConnected()) {
    return false;
  }

  try {
    await redisClient.del(key);
    return true;
  } catch (error) {
    logger.warn('Redis del error', { key, error: error.message });
    return false;
  }
}

/**
 * Clear all keys matching pattern
 */
async function deletePattern(pattern) {
  if (!isRedisConnected()) {
    return false;
  }

  try {
    const keys = await redisClient.keys(pattern);
    if (keys.length > 0) {
      await redisClient.del(keys);
    }
    return true;
  } catch (error) {
    logger.warn('Redis deletePattern error', { pattern, error: error.message });
    return false;
  }
}

/**
 * Increment value in Redis
 */
async function increment(key) {
  if (!isRedisConnected()) {
    return null;
  }

  try {
    return await redisClient.incr(key);
  } catch (error) {
    logger.warn('Redis increment error', { key, error: error.message });
    return null;
  }
}

/**
 * Close Redis connection
 */
async function close() {
  if (redisClient) {
    try {
      await redisClient.quit();
      isConnected = false;
      logger.info('Redis client closed');
    } catch (error) {
      logger.error('Error closing Redis client', { error: error.message });
    }
  }
}

export default {
  initializeRedis,
  getClient,
  isRedisConnected,
  get,
  set,
  del,
  deletePattern,
  increment,
  close
};
