import React from 'react';
import type { NavigationProps } from '@keystone-6/core/admin-ui/components';
import { NavigationContainer, NavItem, ListNavItems } from '@keystone-6/core/admin-ui/components';
import type { AdminConfig } from '@keystone-6/core/types';

function CustomNavigation({ lists, authenticatedItem }: NavigationProps) {
  return (
    <NavigationContainer>
      <NavItem href="/">Dashboard</NavItem>
      <ListNavItems lists={lists} />
      {!authenticatedItem && (
        <NavItem href="/signin">Se connecter</NavItem>
      )}
    </NavigationContainer>
  );
}

export const components: AdminConfig['components'] = {
  Navigation: CustomNavigation,
};
