/**
 * Dashboard Caching Utility
 * L1 in-memory + L2 Redis when connected (safe for multi-instance).
 */

import redis from './redis.js';
import logger from './logger.js';

class DashboardCache {
  constructor() {
    this.cache = new Map();
    this.ttl = 60000;
  }

  generateKey(endpoint, orgId, params = {}) {
    const paramStr = Object.entries(params)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${k}=${v}`)
      .join('&');
    return `${endpoint}:${orgId}:${paramStr}`;
  }

  redisKey(key) {
    return `dash:${key}`;
  }

  get(endpoint, orgId, params = {}) {
    const key = this.generateKey(endpoint, orgId, params);
    const cached = this.cache.get(key);

    if (!cached) {
      return null;
    }

    if (Date.now() > cached.expiresAt) {
      this.cache.delete(key);
      return null;
    }

    return cached.data;
  }

  async getAsync(endpoint, orgId, params = {}) {
    const key = this.generateKey(endpoint, orgId, params);

    if (redis.isRedisConnected()) {
      try {
        const remote = await redis.get(this.redisKey(key));
        if (remote) {
          this.cache.set(key, {
            data: remote,
            expiresAt: Date.now() + this.ttl,
            createdAt: Date.now()
          });
          return remote;
        }
      } catch (err) {
        logger.warn('Dashboard cache Redis get failed', { error: err.message });
      }
    }

    return this.get(endpoint, orgId, params);
  }

  set(endpoint, orgId, data, params = {}, ttl = this.ttl) {
    const key = this.generateKey(endpoint, orgId, params);
    this.cache.set(key, {
      data,
      expiresAt: Date.now() + ttl,
      createdAt: Date.now()
    });

    if (redis.isRedisConnected()) {
      const seconds = Math.max(1, Math.ceil(ttl / 1000));
      void redis.setex(this.redisKey(key), seconds, data).catch((err) => {
        logger.warn('Dashboard cache Redis set failed', { error: err.message });
      });
    }
  }

  async setAsync(endpoint, orgId, data, params = {}, ttl = this.ttl) {
    this.set(endpoint, orgId, data, params, ttl);
  }

  invalidateOrg(orgId) {
    const keysToDelete = [];
    for (const [key] of this.cache) {
      if (key.includes(`:${orgId}:`)) {
        keysToDelete.push(key);
      }
    }
    keysToDelete.forEach((key) => this.cache.delete(key));

    if (redis.isRedisConnected()) {
      void redis.deletePattern(`dash:*:${orgId}:*`).catch((err) => {
        logger.warn('Dashboard cache Redis invalidateOrg failed', { error: err.message });
      });
    }
  }

  invalidateEndpoint(endpoint, orgId) {
    const keysToDelete = [];
    for (const [key] of this.cache) {
      if (key.startsWith(`${endpoint}:${orgId}:`)) {
        keysToDelete.push(key);
      }
    }
    keysToDelete.forEach((key) => this.cache.delete(key));

    if (redis.isRedisConnected()) {
      void redis.deletePattern(`dash:${endpoint}:${orgId}:*`).catch((err) => {
        logger.warn('Dashboard cache Redis invalidateEndpoint failed', { error: err.message });
      });
    }
  }

  clear() {
    this.cache.clear();
    if (redis.isRedisConnected()) {
      void redis.deletePattern('dash:*').catch(() => {});
    }
  }

  getStats() {
    let totalSize = 0;
    let expiredCount = 0;
    const now = Date.now();

    for (const [, cached] of this.cache) {
      if (now > cached.expiresAt) {
        expiredCount++;
      }
      totalSize += JSON.stringify(cached.data).length;
    }

    return {
      totalEntries: this.cache.size,
      expiredEntries: expiredCount,
      totalSizeBytes: totalSize,
      totalSizeMB: (totalSize / 1024 / 1024).toFixed(2),
      redisConnected: redis.isRedisConnected()
    };
  }
}

export const dashboardCache = new DashboardCache();

export default dashboardCache;
