import { config } from '@keystone-6/core';
import { statelessSessions } from '@keystone-6/core/session';
import { createAuth } from '@keystone-6/auth';
import { lists } from './schema';

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
  },
  ui: {
    // Allow anyone to access the admin UI
    // They still need to log in to perform authenticated operations
    isAccessAllowed: () => true,
  },
  session,
}));
