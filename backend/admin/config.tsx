import type { AdminConfig } from '@keystone-6/core/types';

export const components: AdminConfig['components'] = {};

export const pages: AdminConfig['pages'] = (args) => {
  // Only show "Se connecter" when not logged in
  if (!args.authenticatedItem) {
    return [
      {
        label: 'Se connecter',
        path: '/signin-redirect',
        component: () => {
          if (typeof window !== 'undefined') {
            window.location.href = '/signin';
          }
          return null;
        },
      },
    ];
  }
  return [];
};
