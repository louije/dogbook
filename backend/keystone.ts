import { config } from '@keystone-6/core';
import { lists } from './schema';

// Access control for anonymous editing
const isAccessAllowed = ({ session, req }: any) => {
  // Allow access if there's a session OR if the secret path is in the URL
  const secretPath = process.env.EDITOR_SECRET_PATH || 'secret-edit';
  const hasSecretPath = req?.url?.includes(secretPath);
  return !!session || hasSecretPath;
};

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
      // For UI access, check for secret path in context
      return true; // We'll handle this with middleware
    },
  },
  session: {
    secret: process.env.SESSION_SECRET || 'change-me-in-production',
  },
});
