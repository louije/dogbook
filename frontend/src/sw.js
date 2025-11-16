/**
 * Minimal Service Worker for Declarative Web Push
 * Safari requires a service worker to be registered for push notifications,
 * but with declarative web push, the browser handles notifications directly
 * so we don't need push event handlers
 */

const CACHE_NAME = 'dogbook-v1';

// Install event
self.addEventListener('install', (event) => {
  console.log('Service Worker installing');
  self.skipWaiting();
});

// Activate event
self.addEventListener('activate', (event) => {
  console.log('Service Worker activating');
  event.waitUntil(self.clients.claim());
});

// No push event handler needed - declarative web push handles it
