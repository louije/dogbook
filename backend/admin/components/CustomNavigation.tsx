import React from 'react';
import type { NavigationProps } from '@keystone-6/core/admin-ui/components';
import { NavigationContainer, NavItem, ListNavItems } from '@keystone-6/core/admin-ui/components';

export function CustomNavigation({ lists, authenticatedItem }: NavigationProps) {
  const handleSignout = async (e: React.MouseEvent) => {
    e.preventDefault();
    try {
      await fetch('/api/auth/signout', { method: 'POST' });
      window.location.href = '/';
    } catch (error) {
      console.error('Signout failed:', error);
    }
  };

  return (
    <NavigationContainer>
      <NavItem href="/">Dashboard</NavItem>
      <ListNavItems lists={lists} />
      {authenticatedItem.state === "unauthenticated" ? (
        <NavItem href="/signin">Se connecter</NavItem>
      ) : (
        <NavItem href="#" onClick={handleSignout}>Se déconnecter</NavItem>
      )}
    </NavigationContainer>
  );
}
