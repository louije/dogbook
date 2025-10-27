/** @jsxRuntime classic */
/** @jsx jsx */
import { jsx, Heading } from '@keystone-ui/core';
import { useEffect } from 'react';

export default function Connexion() {
  useEffect(() => {
    // Redirect to the signin page
    window.location.href = '/signin';
  }, []);

  return (
    <div css={{ padding: '2rem' }}>
      <Heading>Redirection vers la page de connexion...</Heading>
    </div>
  );
}
