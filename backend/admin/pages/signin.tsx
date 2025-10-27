import { useEffect } from 'react';

export default function SignInRedirect() {
  useEffect(() => {
    window.location.href = '/signin';
  }, []);

  return null;
}
