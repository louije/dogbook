import { config } from '@keystone-6/core';
import { statelessSessions } from '@keystone-6/core/session';
import { createAuth } from '@keystone-6/auth';
import { lists } from './schema';
import express from 'express';
import path from 'path';

const sessionConfig = {
  maxAge: 60 * 60 * 24 * 30, // 30 days
  secret: process.env.SESSION_SECRET || 'change-me-in-production-min-32-chars',
};

const { withAuth } = createAuth({
  listKey: 'User',
  identityField: 'email',
  secretField: 'password',
  sessionData: 'name email',
  initFirstItem: {
    fields: ['name', 'email', 'password'],
  },
  passwordResetLink: {
    sendToken: async ({ itemId, identity, token, context }) => {
      // We're not implementing password reset, but this prevents errors
      console.log(`Password reset requested for ${identity}`);
    },
  },
});

const session = statelessSessions(sessionConfig);

export default withAuth(config({
  db: {
    provider: 'sqlite',
    url: process.env.DATABASE_URL || 'file:../data/keystone.db',
  },
  lists,
  storage: {
    local_images: {
      kind: 'local',
      type: 'image',
      generateUrl: path => `/images${path}`,
      serverRoute: {
        path: '/images',
      },
      storagePath: '../data/images',
    },
  },
  server: {
    cors: {
      origin: true,
      credentials: true,
    },
    extendExpressApp: (app) => {
      // Serve the admin service worker
      app.get('/admin-sw.js', (req, res) => {
        res.setHeader('Content-Type', 'application/javascript');
        res.setHeader('Service-Worker-Allowed', '/');
        res.send(`
/**
 * Service Worker for Keystone Admin UI Push Notifications
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

// Push notification event
self.addEventListener('push', (event) => {
  console.log('[Admin SW] Push received', event);

  if (!event.data) {
    return;
  }

  const data = event.data.json();

  const options = {
    body: data.body,
    icon: data.icon || '/images/hello-big-dog.png',
    badge: data.badge || '/images/hello-dog.png',
    data: data.data,
    vibrate: [200, 100, 200],
    requireInteraction: true,
    actions: [
      {
        action: 'view',
        title: 'Voir'
      },
      {
        action: 'close',
        title: 'Fermer'
      }
    ]
  };

  event.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});

// Notification click event
self.addEventListener('notificationclick', (event) => {
  console.log('[Admin SW] Notification clicked', event);

  event.notification.close();

  if (event.action === 'close') {
    return;
  }

  // Open the admin URL
  const urlToOpen = event.notification.data?.url
    ? new URL(event.notification.data.url, self.location.origin).href
    : self.location.origin;

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then((clientList) => {
        // Check if app is already open
        for (const client of clientList) {
          if (client.url === urlToOpen && 'focus' in client) {
            return client.focus();
          }
        }

        // Open new window
        if (self.clients.openWindow) {
          return self.clients.openWindow(urlToOpen);
        }
      })
  );
});
        `);
      });
    },
  },
  ui: {
    // Allow anyone to access the admin UI
    // They still need to log in to perform authenticated operations
    isAccessAllowed: () => true,
  },
  session,
}));
