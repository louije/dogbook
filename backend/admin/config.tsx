/** @jsxRuntime classic */
/** @jsx jsx */
import { jsx } from '@keystone-ui/core';
import { NavigationContainer, NavItem, ListNavItems } from '@keystone-6/core/admin-ui/components';
import type { NavigationProps } from '@keystone-6/core/admin-ui/components';
import type { AdminConfig } from '@keystone-6/core/types';

function CustomNavigation({ lists, authenticatedItem }: NavigationProps) {
  // If not logged in, only show Dog list and login button
  console.log("HELLO WORLD", authenticatedItem);
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

export const components: AdminConfig['components'] = {
  Navigation: CustomNavigation,
};
