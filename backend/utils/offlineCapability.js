/**
 * Offline Capability System
 * 
 * Provides comprehensive offline functionality for mobile apps:
 * - Local data storage and synchronization
 * - Offline queue management
 * - Conflict resolution strategies
 * - Background sync capabilities
 * - Data versioning and merging
 * - Network status monitoring
 * 
 * Features:
 * - Offline-first architecture
 * - Intelligent sync strategies
 * - Conflict detection and resolution
 * - Incremental data updates
 * - Bandwidth optimization
 * - Real-time sync status
 */

import logger from './logger.js';
import EventEmitter from 'events';

class OfflineCapability extends EventEmitter {
  constructor() {
    super();
    
    this.offlineQueues = new Map(); // User-specific offline queues
    this.syncStrategies = new Map(); // Data type sync strategies
    this.conflictResolvers = new Map(); // Conflict resolution functions
    this.networkStatus = new Map(); // User network status tracking
    this.syncStatus = new Map(); // User sync status
    this.dataVersions = new Map(); // Data versioning for conflict detection
    
    // Configuration
    this.config = {
      maxQueueSize: 1000,
      syncInterval: 30000, // 30 seconds
      retryAttempts: 3,
      retryDelay: 5000, // 5 seconds
      batchSize: 50,
      compressionEnabled: true
    };
    
    this.initialize();
  }

  initialize() {
    logger.info('📴 Initializing Offline Capability System');
    
    this.setupSyncStrategies();
    this.setupConflictResolvers();
    this.startSyncProcessor();
    this.startNetworkMonitor();
    
    logger.info('✅ Offline Capability System initialized');
  }

  /**
   * Setup sync strategies for different data types
   */
  setupSyncStrategies() {
    // Attendance data - immediate sync when online
    this.syncStrategies.set('attendance', {
      priority: 'high',
      syncMode: 'immediate',
      conflictResolution: 'client-wins',
      retryAttempts: 5,
      offlineCapable: true,
      requiredFields: ['employeeId', 'date', 'checkIn'],
      validation: (data) => {
        return data.employeeId && data.date && (data.checkIn || data.checkOut);
      }
    });

    // Leave requests - batch sync, server authority
    this.syncStrategies.set('leaves', {
      priority: 'medium',
      syncMode: 'batch',
      conflictResolution: 'server-wins',
      retryAttempts: 3,
      offlineCapable: true,
      requiredFields: ['employeeId', 'type', 'fromDate', 'toDate'],
      validation: (data) => {
        return data.employeeId && data.type && data.fromDate && data.toDate;
      }
    });

    // Expense submissions - batch sync with merge
    this.syncStrategies.set('expenses', {
      priority: 'medium',
      syncMode: 'batch',
      conflictResolution: 'merge',
      retryAttempts: 3,
      offlineCapable: true,
      requiredFields: ['employeeId', 'amount', 'category', 'date'],
      validation: (data) => {
        return data.employeeId && data.amount && data.category && data.date;
      }
    });

    // Task updates - immediate sync
    this.syncStrategies.set('tasks', {
      priority: 'high',
      syncMode: 'immediate',
      conflictResolution: 'merge',
      retryAttempts: 3,
      offlineCapable: true,
      requiredFields: ['id', 'status'],
      validation: (data) => {
        return data.id && data.status;
      }
    });

    // Profile updates - immediate sync, client wins
    this.syncStrategies.set('profile', {
      priority: 'medium',
      syncMode: 'immediate',
      conflictResolution: 'client-wins',
      retryAttempts: 3,
      offlineCapable: true,
      requiredFields: ['id'],
      validation: (data) => {
        return data.id;
      }
    });

    // Document uploads - immediate sync, no conflicts
    this.syncStrategies.set('documents', {
      priority: 'low',
      syncMode: 'immediate',
      conflictResolution: 'no-conflict',
      retryAttempts: 5,
      offlineCapable: false, // Requires network for file upload
      requiredFields: ['employeeId', 'type', 'file'],
      validation: (data) => {
        return data.employeeId && data.type && data.file;
      }
    });

    logger.info('✅ Sync strategies configured', {
      strategies: Array.from(this.syncStrategies.keys())
    });
  }

  /**
   * Setup conflict resolution strategies
   */
  setupConflictResolvers() {
    // Client wins - use local data
    this.conflictResolvers.set('client-wins', (local, remote) => {
      logger.info('🔄 Conflict resolved: client-wins', {
        localVersion: local.version,
        remoteVersion: remote.version
      });
      return { ...local, version: Math.max(local.version || 0, remote.version || 0) + 1 };
    });

    // Server wins - use remote data
    this.conflictResolvers.set('server-wins', (local, remote) => {
      logger.info('🔄 Conflict resolved: server-wins', {
        localVersion: local.version,
        remoteVersion: remote.version
      });
      return { ...remote, version: (remote.version || 0) + 1 };
    });

    // Merge strategy - combine non-conflicting fields
    this.conflictResolvers.set('merge', (local, remote) => {
      logger.info('🔄 Conflict resolved: merge', {
        localVersion: local.version,
        remoteVersion: remote.version
      });
      
      const merged = { ...remote };
      
      // Merge specific fields based on timestamps
      const mergeFields = ['status', 'comments', 'attachments'];
      
      for (const field of mergeFields) {
        if (local[field] && local[`${field}UpdatedAt`] > (remote[`${field}UpdatedAt`] || 0)) {
          merged[field] = local[field];
          merged[`${field}UpdatedAt`] = local[`${field}UpdatedAt`];
        }
      }
      
      merged.version = Math.max(local.version || 0, remote.version || 0) + 1;
      return merged;
    });

    // No conflict - always use local (for new items)
    this.conflictResolvers.set('no-conflict', (local, remote) => {
      return { ...local, version: (local.version || 0) + 1 };
    });

    logger.info('✅ Conflict resolvers configured');
  }

  /**
   * Add operation to offline queue
   */
  async addToOfflineQueue(userId, operation) {
    try {
      const { type, action, data, metadata = {} } = operation;
      
      // Validate operation
      const strategy = this.syncStrategies.get(type);
      if (!strategy) {
        throw new Error(`No sync strategy found for type: ${type}`);
      }

      if (!strategy.offlineCapable) {
        throw new Error(`Type ${type} is not offline capable`);
      }

      if (!strategy.validation(data)) {
        throw new Error(`Data validation failed for type: ${type}`);
      }

      // Initialize user queue if not exists
      if (!this.offlineQueues.has(userId)) {
        this.offlineQueues.set(userId, []);
      }

      const queue = this.offlineQueues.get(userId);
      
      // Check queue size limit
      if (queue.length >= this.config.maxQueueSize) {
        // Remove oldest low-priority items
        const lowPriorityIndex = queue.findIndex(item => 
          this.syncStrategies.get(item.type)?.priority === 'low'
        );
        
        if (lowPriorityIndex !== -1) {
          queue.splice(lowPriorityIndex, 1);
          logger.warn('📴 Removed low-priority item from full queue', { userId });
        } else {
          throw new Error('Offline queue is full');
        }
      }

      // Create queue item
      const queueItem = {
        id: `offline_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        type,
        action,
        data: { ...data },
        metadata: {
          ...metadata,
          createdAt: new Date().toISOString(),
          attempts: 0,
          priority: strategy.priority,
          syncMode: strategy.syncMode
        },
        status: 'queued'
      };

      // Add version for conflict detection
      queueItem.data.version = this.getNextVersion(type, data.id);
      queueItem.data.offlineId = queueItem.id;

      // Insert based on priority
      const priorityOrder = { high: 0, medium: 1, low: 2 };
      const insertIndex = queue.findIndex(item => 
        priorityOrder[this.syncStrategies.get(item.type)?.priority || 'low'] > 
        priorityOrder[strategy.priority]
      );

      if (insertIndex === -1) {
        queue.push(queueItem);
      } else {
        queue.splice(insertIndex, 0, queueItem);
      }

      logger.info('📴 Operation added to offline queue', {
        userId,
        type,
        action,
        queueSize: queue.length,
        priority: strategy.priority
      });

      // Emit event
      this.emit('offline_operation_queued', {
        userId,
        operation: queueItem
      });

      // Try immediate sync if network is available and strategy allows
      if (strategy.syncMode === 'immediate' && this.isOnline(userId)) {
        setImmediate(() => this.syncUserQueue(userId));
      }

      return queueItem.id;
    } catch (error) {
      logger.error('❌ Failed to add operation to offline queue', {
        userId,
        operation: operation.type,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Sync user's offline queue
   */
  async syncUserQueue(userId) {
    try {
      const queue = this.offlineQueues.get(userId);
      if (!queue || queue.length === 0) {
        return { synced: 0, failed: 0, conflicts: 0 };
      }

      logger.info('🔄 Starting offline queue sync', {
        userId,
        queueSize: queue.length
      });

      const results = {
        synced: 0,
        failed: 0,
        conflicts: 0,
        details: []
      };

      // Process items in batches
      const batchSize = this.config.batchSize;
      
      for (let i = 0; i < queue.length; i += batchSize) {
        const batch = queue.slice(i, i + batchSize);
        
        const batchResults = await Promise.allSettled(
          batch.map(item => this.syncQueueItem(userId, item))
        );

        for (let j = 0; j < batchResults.length; j++) {
          const result = batchResults[j];
          const item = batch[j];

          if (result.status === 'fulfilled') {
            const syncResult = result.value;
            
            if (syncResult.success) {
              results.synced++;
              if (syncResult.conflict) {
                results.conflicts++;
              }
              
              // Remove from queue
              const queueIndex = queue.findIndex(q => q.id === item.id);
              if (queueIndex !== -1) {
                queue.splice(queueIndex, 1);
              }
            } else {
              results.failed++;
              item.metadata.attempts++;
              item.status = 'failed';
              item.error = syncResult.error;
            }
            
            results.details.push({
              id: item.id,
              type: item.type,
              action: item.action,
              success: syncResult.success,
              conflict: syncResult.conflict,
              error: syncResult.error
            });
          } else {
            results.failed++;
            item.metadata.attempts++;
            item.status = 'failed';
            item.error = result.reason.message;
            
            results.details.push({
              id: item.id,
              type: item.type,
              action: item.action,
              success: false,
              error: result.reason.message
            });
          }
        }
      }

      // Remove items that exceeded retry attempts
      const maxAttempts = this.config.retryAttempts;
      const itemsToRemove = queue.filter(item => item.metadata.attempts >= maxAttempts);
      
      for (const item of itemsToRemove) {
        const index = queue.findIndex(q => q.id === item.id);
        if (index !== -1) {
          queue.splice(index, 1);
          logger.warn('📴 Removed item after max retry attempts', {
            userId,
            itemId: item.id,
            type: item.type,
            attempts: item.metadata.attempts
          });
        }
      }

      logger.info('✅ Offline queue sync completed', {
        userId,
        ...results,
        remainingItems: queue.length
      });

      // Update sync status
      this.updateSyncStatus(userId, {
        lastSync: new Date().toISOString(),
        ...results
      });

      // Emit sync completion event
      this.emit('sync_completed', {
        userId,
        results
      });

      // Notify user via socket
      if (global.socketManager) {
        global.socketManager.emitToUser(userId, 'offline_sync_completed', {
          timestamp: new Date().toISOString(),
          results
        });
      }

      return results;
    } catch (error) {
      logger.error('❌ Offline queue sync failed', {
        userId,
        error: error.message
      });
      
      // Emit sync error event
      this.emit('sync_error', {
        userId,
        error: error.message
      });

      throw error;
    }
  }

  /**
   * Sync individual queue item
   */
  async syncQueueItem(userId, item) {
    try {
      const { type, action, data } = item;
      const strategy = this.syncStrategies.get(type);
      
      logger.debug('🔄 Syncing queue item', {
        userId,
        itemId: item.id,
        type,
        action
      });

      // Check for conflicts
      let conflict = false;
      let resolvedData = data;

      if (action === 'update' && data.id) {
        const remoteData = await this.getRemoteData(type, data.id);
        
        if (remoteData && this.hasConflict(data, remoteData)) {
          conflict = true;
          const resolver = this.conflictResolvers.get(strategy.conflictResolution);
          resolvedData = resolver(data, remoteData);
          
          logger.info('🔄 Conflict detected and resolved', {
            userId,
            itemId: item.id,
            type,
            resolution: strategy.conflictResolution
          });
        }
      }

      // Perform the sync operation
      let result;
      switch (action) {
        case 'create':
          result = await this.createRemoteData(type, resolvedData);
          break;
        case 'update':
          result = await this.updateRemoteData(type, resolvedData);
          break;
        case 'delete':
          result = await this.deleteRemoteData(type, data.id);
          break;
        default:
          throw new Error(`Unknown action: ${action}`);
      }

      // Update local version tracking
      if (result && result.id) {
        this.updateDataVersion(type, result.id, result.version || 1);
      }

      return {
        success: true,
        conflict,
        result
      };
    } catch (error) {
      logger.error('❌ Queue item sync failed', {
        userId,
        itemId: item.id,
        type: item.type,
        action: item.action,
        error: error.message
      });

      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Check if there's a conflict between local and remote data
   */
  hasConflict(localData, remoteData) {
    // Simple version-based conflict detection
    const localVersion = localData.version || 0;
    const remoteVersion = remoteData.version || 0;
    const localUpdated = new Date(localData.updatedAt || 0).getTime();
    const remoteUpdated = new Date(remoteData.updatedAt || 0).getTime();

    // Conflict if remote data is newer than what we based our changes on
    return remoteVersion > localVersion || remoteUpdated > localUpdated;
  }

  /**
   * Get next version number for data versioning
   */
  getNextVersion(type, id) {
    const key = `${type}:${id}`;
    const currentVersion = this.dataVersions.get(key) || 0;
    const nextVersion = currentVersion + 1;
    this.dataVersions.set(key, nextVersion);
    return nextVersion;
  }

  /**
   * Update data version tracking
   */
  updateDataVersion(type, id, version) {
    const key = `${type}:${id}`;
    this.dataVersions.set(key, version);
  }

  /**
   * Check if user is online
   */
  isOnline(userId) {
    const status = this.networkStatus.get(userId);
    return status?.online === true;
  }

  /**
   * Update user network status
   */
  updateNetworkStatus(userId, online) {
    this.networkStatus.set(userId, {
      online,
      lastUpdate: new Date().toISOString()
    });

    logger.info(`📶 Network status updated: ${userId}`, { online });

    // Trigger sync if user came online
    if (online) {
      setImmediate(() => this.syncUserQueue(userId));
    }

    // Emit network status change
    this.emit('network_status_changed', {
      userId,
      online
    });

    // Notify user via socket
    if (global.socketManager) {
      global.socketManager.emitToUser(userId, 'network_status_changed', {
        online,
        timestamp: new Date().toISOString()
      });
    }
  }

  /**
   * Update sync status for user
   */
  updateSyncStatus(userId, status) {
    this.syncStatus.set(userId, {
      ...this.syncStatus.get(userId),
      ...status
    });
  }

  /**
   * Get user's offline queue status
   */
  getQueueStatus(userId) {
    const queue = this.offlineQueues.get(userId) || [];
    const networkStatus = this.networkStatus.get(userId);
    const syncStatus = this.syncStatus.get(userId);

    const statusBreakdown = queue.reduce((acc, item) => {
      acc[item.status] = (acc[item.status] || 0) + 1;
      return acc;
    }, {});

    const priorityBreakdown = queue.reduce((acc, item) => {
      const priority = this.syncStrategies.get(item.type)?.priority || 'unknown';
      acc[priority] = (acc[priority] || 0) + 1;
      return acc;
    }, {});

    return {
      queueSize: queue.length,
      statusBreakdown,
      priorityBreakdown,
      networkStatus,
      syncStatus,
      lastSync: syncStatus?.lastSync,
      isOnline: this.isOnline(userId)
    };
  }

  /**
   * Start sync processor
   */
  startSyncProcessor() {
    setInterval(async () => {
      try {
        // Process all user queues
        for (const [userId, queue] of this.offlineQueues.entries()) {
          if (queue.length > 0 && this.isOnline(userId)) {
            // Only sync batch mode items or failed immediate items
            const shouldSync = queue.some(item => {
              const strategy = this.syncStrategies.get(item.type);
              return strategy?.syncMode === 'batch' || 
                     (strategy?.syncMode === 'immediate' && item.status === 'failed');
            });

            if (shouldSync) {
              await this.syncUserQueue(userId);
            }
          }
        }
      } catch (error) {
        logger.error('Sync processor error', { error: error.message });
      }
    }, this.config.syncInterval);

    logger.info('🔄 Sync processor started', {
      interval: this.config.syncInterval
    });
  }

  /**
   * Start network monitor
   */
  startNetworkMonitor() {
    // Monitor for stale network status (cleanup)
    setInterval(() => {
      const staleThreshold = 5 * 60 * 1000; // 5 minutes
      const now = Date.now();

      for (const [userId, status] of this.networkStatus.entries()) {
        const lastUpdate = new Date(status.lastUpdate).getTime();
        
        if (now - lastUpdate > staleThreshold) {
          // Mark as offline if no recent updates
          if (status.online) {
            this.updateNetworkStatus(userId, false);
          }
        }
      }
    }, 60000); // Check every minute

    logger.info('📶 Network monitor started');
  }

  /**
   * Placeholder methods for remote data operations
   * These should be implemented to integrate with your actual API
   */
  async getRemoteData(type, id) {
    // Implement actual API call
    return null;
  }

  async createRemoteData(type, data) {
    // Implement actual API call
    return data;
  }

  async updateRemoteData(type, data) {
    // Implement actual API call
    return data;
  }

  async deleteRemoteData(type, id) {
    // Implement actual API call
    return { id, deleted: true };
  }

  /**
   * Get offline capability statistics
   */
  getStats() {
    const totalQueueSize = Array.from(this.offlineQueues.values())
      .reduce((total, queue) => total + queue.length, 0);

    const onlineUsers = Array.from(this.networkStatus.values())
      .filter(status => status.online).length;

    return {
      totalUsers: this.offlineQueues.size,
      onlineUsers,
      offlineUsers: this.offlineQueues.size - onlineUsers,
      totalQueueSize,
      syncStrategies: this.syncStrategies.size,
      conflictResolvers: this.conflictResolvers.size,
      dataVersions: this.dataVersions.size,
      config: this.config
    };
  }
}

export default OfflineCapability;