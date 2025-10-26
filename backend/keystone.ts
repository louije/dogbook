import { config } from '@keystone-6/core';
import { statelessSessions } from '@keystone-6/core/session';
import { lists } from './schema';

const sessionConfig = {
  maxAge: 60 * 60 * 24 * 30, // 30 days
  secret: process.env.SESSION_SECRET || 'change-me-in-production-min-32-chars',
};

const session = statelessSessions(sessionConfig);

export default config({
  db: {
    provider: 'sqlite',
    url: process.env.DATABASE_URL || 'file:./keystone.db',
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
      storagePath: 'public/images',
    },
  },
  server: {
    cors: {
      origin: true,
      credentials: true,
    },
  },
  ui: {
    isAccessAllowed: async (context) => {
      // Allow all access for now (anonymous editing)
      return true;
    },
  },
  session,
});
