/**
 * Dashboard Caching Utility
 * Provides in-memory caching for dashboard endpoints with TTL
 * Automatically invalidates cache on data changes
 */

class DashboardCache {
  constructor() {
    this.cache = new Map();
    this.ttl = 60000; // 60 seconds default TTL
  }

  /**
   * Generate cache key from endpoint and parameters
   */
  generateKey(endpoint, orgId, params = {}) {
    const paramStr = Object.entries(params)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${k}=${v}`)
      .join('&');
    return `${endpoint}:${orgId}:${paramStr}`;
  }

  /**
   * Get cached value if it exists and hasn't expired
   */
  get(endpoint, orgId, params = {}) {
    const key = this.generateKey(endpoint, orgId, params);
    const cached = this.cache.get(key);

    if (!cached) {
      return null;
    }

    // Check if cache has expired
    if (Date.now() > cached.expiresAt) {
      this.cache.delete(key);
      return null;
    }

    return cached.data;
  }

  /**
   * Set cache value with TTL
   */
  set(endpoint, orgId, data, params = {}, ttl = this.ttl) {
    const key = this.generateKey(endpoint, orgId, params);
    this.cache.set(key, {
      data,
      expiresAt: Date.now() + ttl,
      createdAt: Date.now()
    });
  }

  /**
   * Invalidate all cache entries for an organization
   */
  invalidateOrg(orgId) {
    const keysToDelete = [];
    for (const [key] of this.cache) {
      if (key.includes(`:${orgId}:`)) {
        keysToDelete.push(key);
      }
    }
    keysToDelete.forEach(key => this.cache.delete(key));
  }

  /**
   * Invalidate specific endpoint cache for an organization
   */
  invalidateEndpoint(endpoint, orgId) {
    const keysToDelete = [];
    for (const [key] of this.cache) {
      if (key.startsWith(`${endpoint}:${orgId}:`)) {
        keysToDelete.push(key);
      }
    }
    keysToDelete.forEach(key => this.cache.delete(key));
  }

  /**
   * Clear all cache
   */
  clear() {
    this.cache.clear();
  }

  /**
   * Get cache statistics
   */
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
      totalSizeMB: (totalSize / 1024 / 1024).toFixed(2)
    };
  }
}

// Export singleton instance
export const dashboardCache = new DashboardCache();

export default dashboardCache;
