import React from 'react';
import { NavigationContainer, NavItem, ListNavItems } from '@keystone-6/core/admin-ui/components';
import type { NavigationProps } from '@keystone-6/core/admin-ui/components';

export function Navigation({ lists, authenticatedItem }: NavigationProps) {
  // If not logged in, only show Dog list and login button
  if (!authenticatedItem) {
    return (
      <NavigationContainer>
        <NavItem href="/">Chiens</NavItem>
        <NavItem href="/signin">Se connecter</NavItem>
      </NavigationContainer>
    );
  }

  // If logged in, show all navigation items
  return (
    <NavigationContainer>
      <ListNavItems lists={lists} />
    </NavigationContainer>
  );
}
