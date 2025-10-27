import { useEffect } from 'react';
import { useRouter } from '@keystone-6/core/admin-ui/router';

export default function SignInLink() {
  const router = useRouter();

  useEffect(() => {
    router.push('/signin');
  }, [router]);

  return null;
}
