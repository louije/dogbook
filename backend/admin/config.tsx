import type { AdminConfig } from '@keystone-6/core/types';

export const components: AdminConfig['components'] = {};

export const pages: AdminConfig['pages'] = () => [
  {
    label: 'Se connecter',
    path: '/connexion',
  },
];
