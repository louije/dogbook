import React from 'react';
import type { NavigationProps } from '@keystone-6/core/admin-ui/components';
import { NavigationContainer, NavItem, ListNavItems } from '@keystone-6/core/admin-ui/components';

export function CustomNavigation({ lists, authenticatedItem }: NavigationProps) {
  return (
    <NavigationContainer>
      <NavItem href="/">Dashboard</NavItem>
      <ListNavItems lists={lists} />
      {authenticatedItem.state === "unauthenticated" ? (
        <NavItem href="/signin">Se connecter</NavItem>
      ) : (
        <NavItem href="/api/auth/signout">Se déconnecter</NavItem>
      )}
    </NavigationContainer>
  );
}
