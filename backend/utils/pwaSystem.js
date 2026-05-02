/**
 * Progressive Web App (PWA) System
 * 
 * Comprehensive PWA functionality including:
 * - Service Worker management
 * - App manifest generation
 * - Offline caching strategies
 * - Background sync
 * - App installation prompts
 * - Update notifications
 * - Performance monitoring
 * 
 * Features:
 * - Dynamic service worker generation
 * - Intelligent caching strategies
 * - Offline-first architecture
 * - Background data sync
 * - App update management
 * - Installation analytics
 */

import logger from './logger.js';
import fs from 'fs/promises';
import path from 'path';

class PWASystem {
  constructor() {
    this.cacheStrategies = new Map();
    this.serviceWorkerConfig = new Map();
    this.installPrompts = new Map();
    this.updateNotifications = new Map();
    this.analytics = new Map();
    
    // PWA Configuration
    this.config = {
      appName: 'WorkPlus Pro',
      shortName: 'WorkPlus',
      description: 'Enterprise HRMS & Workforce Management Platform',
      themeColor: '#007bff',
      backgroundColor: '#ffffff',
      display: 'standalone',
      orientation: 'portrait-primary',
      scope: '/',
      startUrl: '/',
      categories: ['business', 'productivity', 'utilities'],
      lang: 'en-US'
    };
    
    this.initialize();
  }

  initialize() {
    logger.info('📱 Initializing PWA System');
    
    this.setupCacheStrategies();
    this.setupServiceWorkerConfig();
    this.generateManifest();
    this.generateServiceWorker();
    
    logger.info('✅ PWA System initialized');
  }

  /**
   * Setup caching strategies for different resource types
   */
  setupCacheStrategies() {
    // App Shell - Cache First (static resources)
    this.cacheStrategies.set('app-shell', {
      strategy: 'CacheFirst',
      cacheName: 'app-shell-v1',
      patterns: [
        '/',
        '/static/js/*.js',
        '/static/css/*.css',
        '/static/media/*.{png,jpg,jpeg,svg,gif,webp}',
        '/manifest.json'
      ],
      options: {
        maxEntries: 100,
        maxAgeSeconds: 30 * 24 * 60 * 60, // 30 days
        purgeOnQuotaError: true
      }
    });

    // API Data - Network First with fallback
    this.cacheStrategies.set('api-data', {
      strategy: 'NetworkFirst',
      cacheName: 'api-data-v1',
      patterns: [
        '/api/employees',
        '/api/attendance',
        '/api/dashboard',
        '/api/announcements'
      ],
      options: {
        maxEntries: 50,
        maxAgeSeconds: 5 * 60, // 5 minutes
        networkTimeoutSeconds: 3,
        purgeOnQuotaError: true
      }
    });

    // User Data - Stale While Revalidate
    this.cacheStrategies.set('user-data', {
      strategy: 'StaleWhileRevalidate',
      cacheName: 'user-data-v1',
      patterns: [
        '/api/auth/me',
        '/api/profile',
        '/api/notifications'
      ],
      options: {
        maxEntries: 20,
        maxAgeSeconds: 60 * 60, // 1 hour
        purgeOnQuotaError: true
      }
    });

    // Images - Cache First with long expiry
    this.cacheStrategies.set('images', {
      strategy: 'CacheFirst',
      cacheName: 'images-v1',
      patterns: [
        '/uploads/*.{png,jpg,jpeg,gif,webp}',
        '/icons/*.{png,jpg,jpeg,svg,ico}',
        '/avatars/*.{png,jpg,jpeg,webp}'
      ],
      options: {
        maxEntries: 200,
        maxAgeSeconds: 90 * 24 * 60 * 60, // 90 days
        purgeOnQuotaError: true
      }
    });

    // Documents - Network First
    this.cacheStrategies.set('documents', {
      strategy: 'NetworkFirst',
      cacheName: 'documents-v1',
      patterns: [
        '/api/documents/*',
        '/api/payroll/payslips/*'
      ],
      options: {
        maxEntries: 30,
        maxAgeSeconds: 24 * 60 * 60, // 24 hours
        networkTimeoutSeconds: 10,
        purgeOnQuotaError: true
      }
    });

    // Fonts - Cache First
    this.cacheStrategies.set('fonts', {
      strategy: 'CacheFirst',
      cacheName: 'fonts-v1',
      patterns: [
        '/fonts/*.{woff,woff2,ttf,eot}',
        'https://fonts.googleapis.com/*',
        'https://fonts.gstatic.com/*'
      ],
      options: {
        maxEntries: 30,
        maxAgeSeconds: 365 * 24 * 60 * 60, // 1 year
        purgeOnQuotaError: false
      }
    });

    logger.info('✅ Cache strategies configured', {
      strategies: Array.from(this.cacheStrategies.keys())
    });
  }

  /**
   * Setup service worker configuration
   */
  setupServiceWorkerConfig() {
    this.serviceWorkerConfig.set('main', {
      version: '1.0.0',
      features: {
        backgroundSync: true,
        pushNotifications: true,
        offlineAnalytics: true,
        periodicBackgroundSync: true,
        badging: true
      },
      syncTags: [
        'attendance-sync',
        'leave-sync',
        'expense-sync',
        'task-sync',
        'profile-sync'
      ],
      notificationActions: [
        {
          action: 'view',
          title: 'View',
          icon: '/icons/view.png'
        },
        {
          action: 'dismiss',
          title: 'Dismiss',
          icon: '/icons/dismiss.png'
        }
      ]
    });
  }

  /**
   * Generate PWA manifest
   */
  async generateManifest() {
    try {
      const manifest = {
        name: this.config.appName,
        short_name: this.config.shortName,
        description: this.config.description,
        start_url: this.config.startUrl,
        scope: this.config.scope,
        display: this.config.display,
        orientation: this.config.orientation,
        theme_color: this.config.themeColor,
        background_color: this.config.backgroundColor,
        lang: this.config.lang,
        categories: this.config.categories,
        icons: [
          {
            src: '/icons/icon-72x72.png',
            sizes: '72x72',
            type: 'image/png',
            purpose: 'maskable any'
          },
          {
            src: '/icons/icon-96x96.png',
            sizes: '96x96',
            type: 'image/png',
            purpose: 'maskable any'
          },
          {
            src: '/icons/icon-128x128.png',
            sizes: '128x128',
            type: 'image/png',
            purpose: 'maskable any'
          },
          {
            src: '/icons/icon-144x144.png',
            sizes: '144x144',
            type: 'image/png',
            purpose: 'maskable any'
          },
          {
            src: '/icons/icon-152x152.png',
            sizes: '152x152',
            type: 'image/png',
            purpose: 'maskable any'
          },
          {
            src: '/icons/icon-192x192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'maskable any'
          },
          {
            src: '/icons/icon-384x384.png',
            sizes: '384x384',
            type: 'image/png',
            purpose: 'maskable any'
          },
          {
            src: '/icons/icon-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable any'
          }
        ],
        shortcuts: [
          {
            name: 'Mark Attendance',
            short_name: 'Attendance',
            description: 'Quick attendance marking',
            url: '/attendance?action=checkin',
            icons: [
              {
                src: '/icons/attendance-shortcut.png',
                sizes: '96x96'
              }
            ]
          },
          {
            name: 'Apply Leave',
            short_name: 'Leave',
            description: 'Apply for leave',
            url: '/leaves/apply',
            icons: [
              {
                src: '/icons/leave-shortcut.png',
                sizes: '96x96'
              }
            ]
          },
          {
            name: 'Submit Expense',
            short_name: 'Expense',
            description: 'Submit expense claim',
            url: '/expenses/submit',
            icons: [
              {
                src: '/icons/expense-shortcut.png',
                sizes: '96x96'
              }
            ]
          },
          {
            name: 'View Payslip',
            short_name: 'Payslip',
            description: 'View latest payslip',
            url: '/payroll',
            icons: [
              {
                src: '/icons/payslip-shortcut.png',
                sizes: '96x96'
              }
            ]
          }
        ],
        screenshots: [
          {
            src: '/screenshots/dashboard-mobile.png',
            sizes: '375x812',
            type: 'image/png',
            platform: 'narrow',
            label: 'Dashboard on mobile'
          },
          {
            src: '/screenshots/attendance-mobile.png',
            sizes: '375x812',
            type: 'image/png',
            platform: 'narrow',
            label: 'Attendance tracking'
          },
          {
            src: '/screenshots/dashboard-desktop.png',
            sizes: '1280x720',
            type: 'image/png',
            platform: 'wide',
            label: 'Dashboard on desktop'
          }
        ],
        related_applications: [
          {
            platform: 'play',
            url: 'https://play.google.com/store/apps/details?id=com.workpluspro.app',
            id: 'com.workpluspro.app'
          },
          {
            platform: 'itunes',
            url: 'https://apps.apple.com/app/workplus-pro/id123456789'
          }
        ],
        prefer_related_applications: false,
        edge_side_panel: {
          preferred_width: 400
        }
      };

      // Write manifest file
      const manifestPath = path.join(process.cwd(), 'backend', 'public', 'manifest.json');
      await fs.writeFile(manifestPath, JSON.stringify(manifest, null, 2));

      logger.info('✅ PWA manifest generated', {
        path: manifestPath,
        icons: manifest.icons.length,
        shortcuts: manifest.shortcuts.length
      });

      return manifest;
    } catch (error) {
      logger.error('❌ PWA manifest generation failed', {
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Generate service worker
   */
  async generateServiceWorker() {
    try {
      const config = this.serviceWorkerConfig.get('main');
      
      const serviceWorkerCode = `
// WorkPlus Pro Service Worker v${config.version}
// Generated automatically - do not edit manually

const CACHE_VERSION = '${config.version}';
const CACHE_PREFIX = 'workplus-pro';

// Cache configurations
const CACHE_STRATEGIES = ${JSON.stringify(Object.fromEntries(this.cacheStrategies), null, 2)};

// Background sync tags
const SYNC_TAGS = ${JSON.stringify(config.syncTags)};

// Notification actions
const NOTIFICATION_ACTIONS = ${JSON.stringify(config.notificationActions)};

// Install event
self.addEventListener('install', (event) => {
  console.log('[SW] Installing service worker v' + CACHE_VERSION);
  
  event.waitUntil(
    Promise.all([
      // Pre-cache app shell
      caches.open(CACHE_PREFIX + '-app-shell-v1').then((cache) => {
        return cache.addAll([
          '/',
          '/static/js/main.js',
          '/static/css/main.css',
          '/manifest.json',
          '/offline.html'
        ]);
      }),
      // Skip waiting to activate immediately
      self.skipWaiting()
    ])
  );
});

// Activate event
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating service worker v' + CACHE_VERSION);
  
  event.waitUntil(
    Promise.all([
      // Clean up old caches
      caches.keys().then((cacheNames) => {
        return Promise.all(
          cacheNames
            .filter((cacheName) => {
              return cacheName.startsWith(CACHE_PREFIX) && 
                     !Object.values(CACHE_STRATEGIES).some(strategy => 
                       cacheName === strategy.cacheName
                     );
            })
            .map((cacheName) => {
              console.log('[SW] Deleting old cache:', cacheName);
              return caches.delete(cacheName);
            })
        );
      }),
      // Claim all clients
      self.clients.claim()
    ])
  );
});

// Fetch event
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);
  
  // Skip non-GET requests and chrome-extension requests
  if (request.method !== 'GET' || url.protocol === 'chrome-extension:') {
    return;
  }
  
  // Find matching cache strategy
  const strategy = findCacheStrategy(request.url);
  
  if (strategy) {
    event.respondWith(handleRequest(request, strategy));
  }
});

// Background sync
self.addEventListener('sync', (event) => {
  console.log('[SW] Background sync triggered:', event.tag);
  
  if (SYNC_TAGS.includes(event.tag)) {
    event.waitUntil(handleBackgroundSync(event.tag));
  }
});

// Push notifications
self.addEventListener('push', (event) => {
  console.log('[SW] Push notification received');
  
  if (event.data) {
    const data = event.data.json();
    event.waitUntil(showNotification(data));
  }
});

// Notification click
self.addEventListener('notificationclick', (event) => {
  console.log('[SW] Notification clicked:', event.action);
  
  event.notification.close();
  
  if (event.action === 'view' && event.notification.data?.url) {
    event.waitUntil(
      clients.openWindow(event.notification.data.url)
    );
  } else if (event.action === 'dismiss') {
    // Just close the notification
  } else {
    // Default action - open app
    event.waitUntil(
      clients.matchAll({ type: 'window' }).then((clientList) => {
        if (clientList.length > 0) {
          return clientList[0].focus();
        }
        return clients.openWindow('/');
      })
    );
  }
});

// Periodic background sync
self.addEventListener('periodicsync', (event) => {
  console.log('[SW] Periodic sync triggered:', event.tag);
  
  if (event.tag === 'background-data-sync') {
    event.waitUntil(performPeriodicSync());
  }
});

// Message handling
self.addEventListener('message', (event) => {
  console.log('[SW] Message received:', event.data);
  
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

// Helper functions
function findCacheStrategy(url) {
  for (const [name, strategy] of Object.entries(CACHE_STRATEGIES)) {
    if (strategy.patterns.some(pattern => matchesPattern(url, pattern))) {
      return { name, ...strategy };
    }
  }
  return null;
}

function matchesPattern(url, pattern) {
  // Simple pattern matching - can be enhanced with regex
  if (pattern.includes('*')) {
    const regex = new RegExp(pattern.replace(/\\*/g, '.*'));
    return regex.test(url);
  }
  return url.includes(pattern);
}

async function handleRequest(request, strategy) {
  const cache = await caches.open(strategy.cacheName);
  
  switch (strategy.strategy) {
    case 'CacheFirst':
      return handleCacheFirst(request, cache, strategy);
    case 'NetworkFirst':
      return handleNetworkFirst(request, cache, strategy);
    case 'StaleWhileRevalidate':
      return handleStaleWhileRevalidate(request, cache, strategy);
    default:
      return fetch(request);
  }
}

async function handleCacheFirst(request, cache, strategy) {
  try {
    const cachedResponse = await cache.match(request);
    if (cachedResponse) {
      return cachedResponse;
    }
    
    const networkResponse = await fetch(request);
    if (networkResponse.ok) {
      cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  } catch (error) {
    console.error('[SW] Cache first failed:', error);
    return new Response('Offline', { status: 503 });
  }
}

async function handleNetworkFirst(request, cache, strategy) {
  try {
    const networkResponse = await Promise.race([
      fetch(request),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Network timeout')), 
        (strategy.options.networkTimeoutSeconds || 3) * 1000)
      )
    ]);
    
    if (networkResponse.ok) {
      cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  } catch (error) {
    console.log('[SW] Network failed, trying cache:', error.message);
    const cachedResponse = await cache.match(request);
    if (cachedResponse) {
      return cachedResponse;
    }
    
    // Return offline page for navigation requests
    if (request.mode === 'navigate') {
      return caches.match('/offline.html');
    }
    
    return new Response('Offline', { status: 503 });
  }
}

async function handleStaleWhileRevalidate(request, cache, strategy) {
  const cachedResponse = await cache.match(request);
  
  const networkPromise = fetch(request).then((networkResponse) => {
    if (networkResponse.ok) {
      cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  }).catch(() => {
    // Network failed, but we might have cache
    return cachedResponse;
  });
  
  return cachedResponse || networkPromise;
}

async function handleBackgroundSync(tag) {
  try {
    console.log('[SW] Handling background sync:', tag);
    
    // Get queued data from IndexedDB
    const queuedData = await getQueuedData(tag);
    
    if (queuedData.length > 0) {
      for (const item of queuedData) {
        try {
          await syncDataItem(item);
          await removeFromQueue(tag, item.id);
        } catch (error) {
          console.error('[SW] Sync item failed:', error);
          // Keep in queue for retry
        }
      }
    }
  } catch (error) {
    console.error('[SW] Background sync failed:', error);
    throw error; // This will cause the sync to be retried
  }
}

async function showNotification(data) {
  const options = {
    body: data.body,
    icon: data.icon || '/icons/icon-192x192.png',
    badge: data.badge || '/icons/badge.png',
    image: data.image,
    actions: data.actions || NOTIFICATION_ACTIONS,
    data: data.data || {},
    requireInteraction: data.requireInteraction || false,
    silent: data.silent || false,
    tag: data.tag || 'workplus-notification',
    renotify: true,
    timestamp: Date.now()
  };
  
  return self.registration.showNotification(data.title, options);
}

async function performPeriodicSync() {
  try {
    console.log('[SW] Performing periodic sync');
    
    // Sync critical data in background
    const syncPromises = SYNC_TAGS.map(tag => handleBackgroundSync(tag));
    await Promise.allSettled(syncPromises);
    
    console.log('[SW] Periodic sync completed');
  } catch (error) {
    console.error('[SW] Periodic sync failed:', error);
  }
}

// IndexedDB helpers for background sync
async function getQueuedData(tag) {
  // Implement IndexedDB operations
  return [];
}

async function syncDataItem(item) {
  // Implement actual sync logic
  const response = await fetch(item.url, {
    method: item.method,
    headers: item.headers,
    body: item.body
  });
  
  if (!response.ok) {
    throw new Error('Sync failed: ' + response.status);
  }
  
  return response;
}

async function removeFromQueue(tag, itemId) {
  // Implement IndexedDB removal
  console.log('[SW] Removed from queue:', tag, itemId);
}

console.log('[SW] Service worker loaded v' + CACHE_VERSION);
`;

      // Write service worker file
      const swPath = path.join(process.cwd(), 'public', 'sw.js');
      await fs.writeFile(swPath, serviceWorkerCode);

      logger.info('✅ Service worker generated', {
        path: swPath,
        version: config.version,
        features: Object.keys(config.features).filter(f => config.features[f])
      });

      return swPath;
    } catch (error) {
      logger.error('❌ Service worker generation failed', {
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Generate offline page
   */
  async generateOfflinePage() {
    try {
      const offlineHTML = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Offline - ${this.config.appName}</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            margin: 0;
            padding: 0;
            background: linear-gradient(135deg, #007bff, #0056b3);
            color: white;
            display: flex;
            align-items: center;
            justify-content: center;
            min-height: 100vh;
            text-align: center;
        }
        .offline-container {
            max-width: 400px;
            padding: 2rem;
        }
        .offline-icon {
            font-size: 4rem;
            margin-bottom: 1rem;
        }
        .offline-title {
            font-size: 1.5rem;
            font-weight: 600;
            margin-bottom: 1rem;
        }
        .offline-message {
            font-size: 1rem;
            opacity: 0.9;
            margin-bottom: 2rem;
            line-height: 1.5;
        }
        .retry-button {
            background: rgba(255, 255, 255, 0.2);
            border: 2px solid rgba(255, 255, 255, 0.3);
            color: white;
            padding: 0.75rem 1.5rem;
            border-radius: 0.5rem;
            font-size: 1rem;
            cursor: pointer;
            transition: all 0.3s ease;
        }
        .retry-button:hover {
            background: rgba(255, 255, 255, 0.3);
            border-color: rgba(255, 255, 255, 0.5);
        }
        .features-list {
            margin-top: 2rem;
            text-align: left;
        }
        .features-list h3 {
            margin-bottom: 1rem;
            font-size: 1.1rem;
        }
        .features-list ul {
            list-style: none;
            padding: 0;
        }
        .features-list li {
            padding: 0.5rem 0;
            opacity: 0.8;
        }
        .features-list li:before {
            content: "✓ ";
            color: #28a745;
            font-weight: bold;
        }
    </style>
</head>
<body>
    <div class="offline-container">
        <div class="offline-icon">📱</div>
        <h1 class="offline-title">You're Offline</h1>
        <p class="offline-message">
            No internet connection detected. Don't worry, you can still use many features of ${this.config.appName} while offline.
        </p>
        
        <button class="retry-button" onclick="window.location.reload()">
            Try Again
        </button>
        
        <div class="features-list">
            <h3>Available Offline:</h3>
            <ul>
                <li>View cached attendance records</li>
                <li>Mark attendance (syncs when online)</li>
                <li>View downloaded payslips</li>
                <li>Submit leave requests (syncs when online)</li>
                <li>View cached announcements</li>
                <li>Access employee directory</li>
            </ul>
        </div>
    </div>

    <script>
        // Check for network connectivity
        function checkOnlineStatus() {
            if (navigator.onLine) {
                window.location.reload();
            }
        }
        
        // Listen for online event
        window.addEventListener('online', checkOnlineStatus);
        
        // Periodic check
        setInterval(checkOnlineStatus, 5000);
        
        // Service worker registration check
        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.ready.then(() => {
                console.log('Service worker is ready');
            });
        }
    </script>
</body>
</html>
`;

      const offlinePath = path.join(process.cwd(), 'public', 'offline.html');
      await fs.writeFile(offlinePath, offlineHTML);

      logger.info('✅ Offline page generated', { path: offlinePath });
      
      return offlinePath;
    } catch (error) {
      logger.error('❌ Offline page generation failed', {
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Track app installation
   */
  trackInstallation(userId, platform, installMethod) {
    try {
      const installData = {
        userId,
        platform,
        installMethod, // 'browser-prompt', 'manual', 'app-store'
        timestamp: new Date().toISOString(),
        userAgent: null // Would be set from request
      };

      if (!this.analytics.has('installations')) {
        this.analytics.set('installations', []);
      }

      this.analytics.get('installations').push(installData);

      logger.info('📱 PWA installation tracked', {
        userId,
        platform,
        installMethod
      });

      return installData;
    } catch (error) {
      logger.error('❌ Installation tracking failed', {
        userId,
        platform,
        error: error.message
      });
    }
  }

  /**
   * Track app usage
   */
  trackUsage(userId, action, data = {}) {
    try {
      const usageData = {
        userId,
        action,
        data,
        timestamp: new Date().toISOString()
      };

      if (!this.analytics.has('usage')) {
        this.analytics.set('usage', []);
      }

      this.analytics.get('usage').push(usageData);

      // Keep only last 1000 usage events
      const usage = this.analytics.get('usage');
      if (usage.length > 1000) {
        usage.splice(0, usage.length - 1000);
      }

      return usageData;
    } catch (error) {
      logger.error('❌ Usage tracking failed', {
        userId,
        action,
        error: error.message
      });
    }
  }

  /**
   * Get PWA analytics
   */
  getAnalytics() {
    const installations = this.analytics.get('installations') || [];
    const usage = this.analytics.get('usage') || [];

    const installationsByPlatform = installations.reduce((acc, install) => {
      acc[install.platform] = (acc[install.platform] || 0) + 1;
      return acc;
    }, {});

    const usageByAction = usage.reduce((acc, event) => {
      acc[event.action] = (acc[event.action] || 0) + 1;
      return acc;
    }, {});

    return {
      totalInstallations: installations.length,
      installationsByPlatform,
      totalUsageEvents: usage.length,
      usageByAction,
      cacheStrategies: this.cacheStrategies.size,
      lastUpdated: new Date().toISOString()
    };
  }

  /**
   * Update PWA configuration
   */
  updateConfig(newConfig) {
    this.config = { ...this.config, ...newConfig };
    
    // Regenerate manifest and service worker
    this.generateManifest();
    this.generateServiceWorker();
    
    logger.info('✅ PWA configuration updated', {
      updatedFields: Object.keys(newConfig)
    });
  }

  /**
   * Get PWA status
   */
  getStatus() {
    return {
      config: this.config,
      cacheStrategies: Array.from(this.cacheStrategies.keys()),
      serviceWorkerVersion: this.serviceWorkerConfig.get('main')?.version,
      analytics: this.getAnalytics()
    };
  }
}

export default PWASystem;