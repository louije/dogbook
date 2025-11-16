/**
 * Service Worker for Keystone Admin UI Push Notifications
 * Safari requires a service worker for push notifications,
 * but with declarative web push, the browser handles notifications directly
 */

// Install event
self.addEventListener('install', (event) => {
  console.log('[Admin SW] Installing');
  self.skipWaiting();
});

// Activate event
self.addEventListener('activate', (event) => {
  console.log('[Admin SW] Activating');
  event.waitUntil(self.clients.claim());
});

// No push event handler needed for declarative web push
// Safari handles notifications directly with userVisibleOnly: false
