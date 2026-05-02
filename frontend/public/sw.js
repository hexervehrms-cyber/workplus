
// WorkPlus Pro Service Worker v1.0.0
// Generated automatically - do not edit manually

const CACHE_VERSION = '1.0.0';
const CACHE_PREFIX = 'workplus-pro';

// Cache configurations
const CACHE_STRATEGIES = {
  "app-shell": {
    "strategy": "CacheFirst",
    "cacheName": "app-shell-v1",
    "patterns": [
      "/",
      "/static/js/*.js",
      "/static/css/*.css",
      "/static/media/*.{png,jpg,jpeg,svg,gif,webp}",
      "/manifest.json"
    ],
    "options": {
      "maxEntries": 100,
      "maxAgeSeconds": 2592000,
      "purgeOnQuotaError": true
    }
  },
  "api-data": {
    "strategy": "NetworkFirst",
    "cacheName": "api-data-v1",
    "patterns": [
      "/api/employees",
      "/api/attendance",
      "/api/dashboard",
      "/api/announcements"
    ],
    "options": {
      "maxEntries": 50,
      "maxAgeSeconds": 300,
      "networkTimeoutSeconds": 3,
      "purgeOnQuotaError": true
    }
  },
  "user-data": {
    "strategy": "StaleWhileRevalidate",
    "cacheName": "user-data-v1",
    "patterns": [
      "/api/auth/me",
      "/api/profile",
      "/api/notifications"
    ],
    "options": {
      "maxEntries": 20,
      "maxAgeSeconds": 3600,
      "purgeOnQuotaError": true
    }
  },
  "images": {
    "strategy": "CacheFirst",
    "cacheName": "images-v1",
    "patterns": [
      "/uploads/*.{png,jpg,jpeg,gif,webp}",
      "/icons/*.{png,jpg,jpeg,svg,ico}",
      "/avatars/*.{png,jpg,jpeg,webp}"
    ],
    "options": {
      "maxEntries": 200,
      "maxAgeSeconds": 7776000,
      "purgeOnQuotaError": true
    }
  },
  "documents": {
    "strategy": "NetworkFirst",
    "cacheName": "documents-v1",
    "patterns": [
      "/api/documents/*",
      "/api/payroll/payslips/*"
    ],
    "options": {
      "maxEntries": 30,
      "maxAgeSeconds": 86400,
      "networkTimeoutSeconds": 10,
      "purgeOnQuotaError": true
    }
  },
  "fonts": {
    "strategy": "CacheFirst",
    "cacheName": "fonts-v1",
    "patterns": [
      "/fonts/*.{woff,woff2,ttf,eot}",
      "https://fonts.googleapis.com/*",
      "https://fonts.gstatic.com/*"
    ],
    "options": {
      "maxEntries": 30,
      "maxAgeSeconds": 31536000,
      "purgeOnQuotaError": false
    }
  }
};

// Background sync tags
const SYNC_TAGS = ["attendance-sync","leave-sync","expense-sync","task-sync","profile-sync"];

// Notification actions
const NOTIFICATION_ACTIONS = [{"action":"view","title":"View","icon":"/icons/view.png"},{"action":"dismiss","title":"Dismiss","icon":"/icons/dismiss.png"}];

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
    const regex = new RegExp(pattern.replace(/\*/g, '.*'));
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
