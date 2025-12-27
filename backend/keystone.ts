import { config } from '@keystone-6/core';
import { statelessSessions } from '@keystone-6/core/session';
import { createAuth } from '@keystone-6/auth';
import { lists } from './schema';
import express from 'express';
import path from 'path';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
import { validateMagicToken } from './auth';

const sessionConfig = {
  maxAge: 60 * 60 * 24 * 30, // 30 days
  secret: (() => {
    if (!process.env.SESSION_SECRET) {
      throw new Error('SESSION_SECRET environment variable is required');
    }
    if (process.env.SESSION_SECRET.length < 32) {
      throw new Error('SESSION_SECRET must be at least 32 characters');
    }
    return process.env.SESSION_SECRET;
  })(),
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
      origin: process.env.FRONTEND_URL || 'http://localhost:8080',
      credentials: true,
    },
    extendExpressApp: (app, context) => {
      // Parse cookies before any routes
      app.use(cookieParser());

      // Rate limiting
      const apiLimiter = rateLimit({
        windowMs: 15 * 60 * 1000, // 15 minutes
        max: 100, // 100 requests per 15 min window
        standardHeaders: true,
        legacyHeaders: false,
        message: { error: 'Too many requests, please try again later.' },
      });

      const uploadLimiter = rateLimit({
        windowMs: 60 * 60 * 1000, // 1 hour
        max: 60, // 60 uploads per hour
        standardHeaders: true,
        legacyHeaders: false,
        message: { error: 'Upload limit reached. Please try again later.' },
        // Only count requests that include file uploads
        skip: (req) => !req.headers['content-type']?.includes('multipart/form-data'),
      });

      app.use('/api/graphql', uploadLimiter);
      app.use('/api/graphql', apiLimiter);
      app.use('/api/validate-magic-token', apiLimiter);

      // Validate magic token endpoint
      app.get('/api/validate-magic-token', async (req, res) => {
        const token = req.cookies?.magicToken;
        if (!token) {
          return res.json({ valid: false });
        }

        const keystoneContext = await context.withRequest(req, res);
        const isValid = await validateMagicToken(token, keystoneContext);
        res.json({ valid: isValid });
      });

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
  console.log('[Admin SW] Notification data:', event.notification.data);

  event.notification.close();

  if (event.action === 'close') {
    console.log('[Admin SW] Close action, not opening anything');
    return;
  }

  // Open the admin URL
  const relativeUrl = event.notification.data?.url || '/';
  const urlToOpen = new URL(relativeUrl, self.location.origin).href;

  console.log('[Admin SW] Opening URL:', urlToOpen);
  console.log('[Admin SW] Origin:', self.location.origin);

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then((clientList) => {
        console.log('[Admin SW] Found clients:', clientList.length);

        // If we have an existing admin window, navigate it to the URL
        if (clientList.length > 0) {
          const client = clientList[0];
          console.log('[Admin SW] Navigating existing client to:', urlToOpen);
          return client.focus().then(() => {
            return client.navigate(urlToOpen);
          });
        }

        // No existing window, try to open new one
        console.log('[Admin SW] Opening new window');
        if (self.clients.openWindow) {
          return self.clients.openWindow(urlToOpen).then(windowClient => {
            console.log('[Admin SW] Window opened:', windowClient);
            return windowClient;
          });
        }
      })
      .catch(error => {
        console.error('[Admin SW] Error handling click:', error);
      })
  );
});
        `);
      });
    },
  },
  ui: {
    // Lock down admin UI to authenticated users only
    isAccessAllowed: ({ session }) => !!session,
  },
  session,
}));
