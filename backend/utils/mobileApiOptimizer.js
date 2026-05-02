/**
 * Mobile API Optimizer
 * 
 * Optimizes API responses and functionality for mobile consumption:
 * - Lightweight response formats
 * - Data compression and pagination
 * - Offline-first architecture
 * - Bandwidth optimization
 * - Mobile-specific caching strategies
 * - Progressive data loading
 * - Background sync capabilities
 * 
 * Features:
 * - Response size optimization
 * - Field selection and filtering
 * - Image compression and resizing
 * - Lazy loading support
 * - Incremental sync
 * - Conflict resolution
 */

import logger from './logger.js';
import sharp from 'sharp';
import zlib from 'zlib';
import { promisify } from 'util';

const gzip = promisify(zlib.gzip);
const gunzip = promisify(zlib.gunzip);

class MobileApiOptimizer {
  constructor() {
    this.compressionThreshold = 1024; // 1KB
    this.maxImageSize = 500; // 500px max width/height
    this.cacheStrategies = new Map();
    this.syncQueues = new Map();
    this.conflictResolvers = new Map();
    
    this.initialize();
  }

  initialize() {
    logger.info('📱 Initializing Mobile API Optimizer');
    
    this.setupCacheStrategies();
    this.setupConflictResolvers();
    this.startBackgroundSync();
    
    logger.info('✅ Mobile API Optimizer initialized');
  }

  /**
   * Setup caching strategies for different data types
   */
  setupCacheStrategies() {
    // Employee data - cache for 1 hour, sync on change
    this.cacheStrategies.set('employees', {
      ttl: 3600000, // 1 hour
      strategy: 'cache-first',
      syncOnChange: true,
      fields: ['id', 'name', 'email', 'department', 'designation', 'avatar']
    });

    // Attendance data - cache for 5 minutes, always fresh for today
    this.cacheStrategies.set('attendance', {
      ttl: 300000, // 5 minutes
      strategy: 'network-first',
      syncOnChange: true,
      fields: ['id', 'employeeId', 'date', 'checkIn', 'checkOut', 'status', 'workingHours']
    });

    // Leave requests - cache for 10 minutes
    this.cacheStrategies.set('leaves', {
      ttl: 600000, // 10 minutes
      strategy: 'cache-first',
      syncOnChange: true,
      fields: ['id', 'employeeId', 'type', 'fromDate', 'toDate', 'status', 'reason']
    });

    // Payroll data - cache for 24 hours (rarely changes)
    this.cacheStrategies.set('payroll', {
      ttl: 86400000, // 24 hours
      strategy: 'cache-first',
      syncOnChange: false,
      fields: ['id', 'employeeId', 'month', 'year', 'basicSalary', 'netPay', 'status']
    });

    // Announcements - cache for 30 minutes
    this.cacheStrategies.set('announcements', {
      ttl: 1800000, // 30 minutes
      strategy: 'network-first',
      syncOnChange: true,
      fields: ['id', 'title', 'content', 'priority', 'createdAt', 'expiresAt']
    });

    // Tasks - cache for 5 minutes
    this.cacheStrategies.set('tasks', {
      ttl: 300000, // 5 minutes
      strategy: 'network-first',
      syncOnChange: true,
      fields: ['id', 'title', 'description', 'status', 'priority', 'dueDate', 'assignedTo']
    });

    logger.info('✅ Cache strategies configured', {
      strategies: Array.from(this.cacheStrategies.keys())
    });
  }

  /**
   * Setup conflict resolvers for offline sync
   */
  setupConflictResolvers() {
    // Last-write-wins for most data
    this.conflictResolvers.set('default', (local, remote) => {
      return local.updatedAt > remote.updatedAt ? local : remote;
    });

    // Attendance: prefer local check-in/out times
    this.conflictResolvers.set('attendance', (local, remote) => {
      const resolved = { ...remote };
      
      // Keep local check-in/out times if they exist
      if (local.checkIn && !remote.checkIn) {
        resolved.checkIn = local.checkIn;
      }
      if (local.checkOut && !remote.checkOut) {
        resolved.checkOut = local.checkOut;
      }
      
      return resolved;
    });

    // Leave requests: prefer remote status, local content
    this.conflictResolvers.set('leaves', (local, remote) => {
      return {
        ...local,
        status: remote.status, // Server has authority over approval status
        approvedBy: remote.approvedBy,
        approvedAt: remote.approvedAt,
        comments: remote.comments
      };
    });

    logger.info('✅ Conflict resolvers configured');
  }

  /**
   * Optimize API response for mobile
   */
  async optimizeResponse(data, options = {}) {
    try {
      const {
        fields,
        compress = true,
        imageOptimization = true,
        pagination = {},
        cacheStrategy = 'default'
      } = options;

      let optimizedData = data;

      // Field selection
      if (fields && Array.isArray(fields)) {
        optimizedData = this.selectFields(optimizedData, fields);
      }

      // Image optimization
      if (imageOptimization) {
        optimizedData = await this.optimizeImages(optimizedData);
      }

      // Pagination
      if (pagination.page && pagination.limit) {
        optimizedData = this.paginateData(optimizedData, pagination);
      }

      // Data compression
      let response = {
        success: true,
        data: optimizedData,
        meta: {
          timestamp: new Date().toISOString(),
          compressed: false,
          cacheStrategy,
          size: JSON.stringify(optimizedData).length
        }
      };

      if (compress && response.meta.size > this.compressionThreshold) {
        const compressed = await gzip(JSON.stringify(response));
        response = {
          compressed: true,
          data: compressed.toString('base64'),
          meta: {
            ...response.meta,
            compressed: true,
            originalSize: response.meta.size,
            compressedSize: compressed.length,
            compressionRatio: (compressed.length / response.meta.size * 100).toFixed(2) + '%'
          }
        };
      }

      logger.debug('📱 Response optimized for mobile', {
        originalSize: response.meta.originalSize || response.meta.size,
        finalSize: response.meta.compressedSize || response.meta.size,
        compressed: response.meta.compressed,
        fields: fields?.length || 'all'
      });

      return response;
    } catch (error) {
      logger.error('❌ Mobile response optimization failed', {
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Select specific fields from data
   */
  selectFields(data, fields) {
    if (!data) return data;

    if (Array.isArray(data)) {
      return data.map(item => this.selectFieldsFromObject(item, fields));
    } else if (typeof data === 'object') {
      return this.selectFieldsFromObject(data, fields);
    }

    return data;
  }

  /**
   * Select fields from a single object
   */
  selectFieldsFromObject(obj, fields) {
    if (!obj || typeof obj !== 'object') return obj;

    const selected = {};
    
    for (const field of fields) {
      if (field.includes('.')) {
        // Nested field selection
        const [parent, ...nested] = field.split('.');
        if (obj[parent]) {
          if (!selected[parent]) selected[parent] = {};
          this.setNestedValue(selected[parent], nested.join('.'), this.getNestedValue(obj[parent], nested.join('.')));
        }
      } else {
        // Direct field selection
        if (obj.hasOwnProperty(field)) {
          selected[field] = obj[field];
        }
      }
    }

    return selected;
  }

  /**
   * Get nested value from object
   */
  getNestedValue(obj, path) {
    return path.split('.').reduce((current, key) => current?.[key], obj);
  }

  /**
   * Set nested value in object
   */
  setNestedValue(obj, path, value) {
    const keys = path.split('.');
    const lastKey = keys.pop();
    const target = keys.reduce((current, key) => {
      if (!current[key]) current[key] = {};
      return current[key];
    }, obj);
    target[lastKey] = value;
  }

  /**
   * Optimize images in data
   */
  async optimizeImages(data) {
    if (!data) return data;

    try {
      if (Array.isArray(data)) {
        return await Promise.all(data.map(item => this.optimizeImages(item)));
      } else if (typeof data === 'object') {
        const optimized = { ...data };
        
        for (const [key, value] of Object.entries(optimized)) {
          if (this.isImageField(key, value)) {
            optimized[key] = await this.optimizeImageUrl(value);
          } else if (typeof value === 'object') {
            optimized[key] = await this.optimizeImages(value);
          }
        }
        
        return optimized;
      }
    } catch (error) {
      logger.error('Image optimization failed', { error: error.message });
    }

    return data;
  }

  /**
   * Check if field contains image data
   */
  isImageField(key, value) {
    const imageFields = ['avatar', 'photo', 'image', 'thumbnail', 'profilePicture'];
    const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];
    
    return imageFields.includes(key) || 
           (typeof value === 'string' && imageExtensions.some(ext => value.toLowerCase().includes(ext)));
  }

  /**
   * Optimize image URL for mobile
   */
  async optimizeImageUrl(imageUrl) {
    if (!imageUrl || typeof imageUrl !== 'string') {
      return imageUrl;
    }

    try {
      // Add mobile optimization parameters to image URL
      const url = new URL(imageUrl, 'http://localhost'); // Base URL for relative paths
      
      // Add mobile-specific parameters
      url.searchParams.set('w', this.maxImageSize.toString());
      url.searchParams.set('h', this.maxImageSize.toString());
      url.searchParams.set('q', '80'); // 80% quality
      url.searchParams.set('f', 'webp'); // WebP format for better compression
      
      return url.pathname + url.search;
    } catch (error) {
      logger.error('Image URL optimization failed', { 
        imageUrl, 
        error: error.message 
      });
      return imageUrl;
    }
  }

  /**
   * Paginate data
   */
  paginateData(data, pagination) {
    if (!Array.isArray(data)) {
      return data;
    }

    const { page = 1, limit = 20 } = pagination;
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + limit;

    const paginatedData = data.slice(startIndex, endIndex);

    return {
      items: paginatedData,
      pagination: {
        page,
        limit,
        total: data.length,
        totalPages: Math.ceil(data.length / limit),
        hasNext: endIndex < data.length,
        hasPrev: page > 1
      }
    };
  }

  /**
   * Create offline sync package
   */
  async createSyncPackage(userId, dataTypes = [], lastSyncTime = null) {
    try {
      const syncPackage = {
        userId,
        timestamp: new Date().toISOString(),
        lastSyncTime,
        changes: {},
        deletions: {},
        conflicts: []
      };

      for (const dataType of dataTypes) {
        const strategy = this.cacheStrategies.get(dataType);
        if (!strategy) continue;

        // Get changes since last sync
        const changes = await this.getChangesSince(dataType, userId, lastSyncTime);
        const deletions = await this.getDeletionsSince(dataType, userId, lastSyncTime);

        if (changes.length > 0) {
          syncPackage.changes[dataType] = await this.optimizeResponse(changes, {
            fields: strategy.fields,
            compress: false // Will be compressed at package level
          });
        }

        if (deletions.length > 0) {
          syncPackage.deletions[dataType] = deletions.map(item => ({ id: item.id, deletedAt: item.deletedAt }));
        }
      }

      // Compress entire sync package
      const compressed = await gzip(JSON.stringify(syncPackage));
      
      logger.info('📦 Sync package created', {
        userId,
        dataTypes,
        originalSize: JSON.stringify(syncPackage).length,
        compressedSize: compressed.length,
        compressionRatio: (compressed.length / JSON.stringify(syncPackage).length * 100).toFixed(2) + '%'
      });

      return {
        compressed: true,
        data: compressed.toString('base64'),
        meta: {
          userId,
          timestamp: syncPackage.timestamp,
          dataTypes,
          originalSize: JSON.stringify(syncPackage).length,
          compressedSize: compressed.length
        }
      };
    } catch (error) {
      logger.error('❌ Sync package creation failed', {
        userId,
        dataTypes,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Process offline sync data
   */
  async processSyncData(userId, syncData) {
    try {
      logger.info('🔄 Processing offline sync data', { userId });

      const results = {
        processed: 0,
        conflicts: 0,
        errors: 0,
        details: {}
      };

      // Decompress if needed
      let data = syncData;
      if (syncData.compressed) {
        const decompressed = await gunzip(Buffer.from(syncData.data, 'base64'));
        data = JSON.parse(decompressed.toString());
      }

      // Process each data type
      for (const [dataType, items] of Object.entries(data.changes || {})) {
        try {
          const typeResults = await this.processSyncDataType(dataType, items, userId);
          results.details[dataType] = typeResults;
          results.processed += typeResults.processed;
          results.conflicts += typeResults.conflicts;
          results.errors += typeResults.errors;
        } catch (error) {
          logger.error(`Sync processing failed for ${dataType}`, {
            userId,
            error: error.message
          });
          results.errors++;
        }
      }

      logger.info('✅ Offline sync processing completed', {
        userId,
        ...results
      });

      return results;
    } catch (error) {
      logger.error('❌ Offline sync processing failed', {
        userId,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Process sync data for specific type
   */
  async processSyncDataType(dataType, items, userId) {
    const results = {
      processed: 0,
      conflicts: 0,
      errors: 0,
      items: []
    };

    const resolver = this.conflictResolvers.get(dataType) || this.conflictResolvers.get('default');

    for (const item of items) {
      try {
        // Check for conflicts
        const existing = await this.getExistingItem(dataType, item.id);
        
        if (existing && existing.updatedAt !== item.originalUpdatedAt) {
          // Conflict detected - resolve it
          const resolved = resolver(item, existing);
          await this.updateItem(dataType, resolved);
          results.conflicts++;
          
          results.items.push({
            id: item.id,
            status: 'conflict_resolved',
            resolution: 'merged'
          });
        } else {
          // No conflict - apply changes
          if (existing) {
            await this.updateItem(dataType, item);
          } else {
            await this.createItem(dataType, item);
          }
          results.processed++;
          
          results.items.push({
            id: item.id,
            status: 'processed',
            action: existing ? 'updated' : 'created'
          });
        }
      } catch (error) {
        logger.error(`Item processing failed: ${dataType}/${item.id}`, {
          error: error.message
        });
        results.errors++;
        
        results.items.push({
          id: item.id,
          status: 'error',
          error: error.message
        });
      }
    }

    return results;
  }

  /**
   * Start background sync processor
   */
  startBackgroundSync() {
    setInterval(async () => {
      try {
        // Process pending sync queues
        for (const [userId, queue] of this.syncQueues.entries()) {
          if (queue.length > 0) {
            const batch = queue.splice(0, 10); // Process 10 items at a time
            
            for (const syncItem of batch) {
              try {
                await this.processSyncData(userId, syncItem.data);
                
                // Emit sync completion event
                if (global.socketManager) {
                  global.socketManager.emitToUser(userId, 'sync_completed', {
                    timestamp: new Date().toISOString(),
                    status: 'success'
                  });
                }
              } catch (error) {
                logger.error('Background sync failed', {
                  userId,
                  error: error.message
                });
                
                // Emit sync error event
                if (global.socketManager) {
                  global.socketManager.emitToUser(userId, 'sync_error', {
                    timestamp: new Date().toISOString(),
                    error: error.message
                  });
                }
              }
            }
          }
        }
      } catch (error) {
        logger.error('Background sync processor error', {
          error: error.message
        });
      }
    }, 10000); // Run every 10 seconds
  }

  /**
   * Add item to sync queue
   */
  addToSyncQueue(userId, syncData) {
    if (!this.syncQueues.has(userId)) {
      this.syncQueues.set(userId, []);
    }
    
    this.syncQueues.get(userId).push({
      timestamp: new Date().toISOString(),
      data: syncData
    });
    
    logger.info('📥 Item added to sync queue', {
      userId,
      queueSize: this.syncQueues.get(userId).length
    });
  }

  /**
   * Get incremental changes since timestamp
   */
  async getChangesSince(dataType, userId, timestamp) {
    // This would integrate with your actual data models
    // Placeholder implementation
    return [];
  }

  /**
   * Get deletions since timestamp
   */
  async getDeletionsSince(dataType, userId, timestamp) {
    // This would integrate with your actual data models
    // Placeholder implementation
    return [];
  }

  /**
   * Get existing item by ID
   */
  async getExistingItem(dataType, itemId) {
    // This would integrate with your actual data models
    // Placeholder implementation
    return null;
  }

  /**
   * Update existing item
   */
  async updateItem(dataType, item) {
    // This would integrate with your actual data models
    // Placeholder implementation
    return item;
  }

  /**
   * Create new item
   */
  async createItem(dataType, item) {
    // This would integrate with your actual data models
    // Placeholder implementation
    return item;
  }

  /**
   * Get mobile optimization statistics
   */
  getStats() {
    return {
      cacheStrategies: this.cacheStrategies.size,
      conflictResolvers: this.conflictResolvers.size,
      activeSyncQueues: this.syncQueues.size,
      totalQueuedItems: Array.from(this.syncQueues.values()).reduce((total, queue) => total + queue.length, 0),
      compressionThreshold: this.compressionThreshold,
      maxImageSize: this.maxImageSize
    };
  }
}

export default MobileApiOptimizer;