import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiFetch } from '../lib/api';

export const useAuth = (allowedRoles: string[]) => {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkUser = async () => {
      try {
        const res = await apiFetch('/auth/me');
        const data = await res.json();

        if (!res.ok || !data.success) {
          router.push('/login');
          return;
        }

        if (allowedRoles.length > 0 && !allowedRoles.includes(data.data.role)) {
          // Redirect to correct dashboard based on actual role
          if (data.data.role === 'SUPER_ADMIN') {
            router.push('/dashboard/super-admin');
          } else if (data.data.role === 'ADMIN') {
            router.push('/dashboard/admin');
          } else {
            router.push('/dashboard/customer');
          }
          return;
        }

        setUser(data.data);
      } catch (err) {
        router.push('/login');
      } finally {
        setLoading(false);
      }
    };

    checkUser();
  }, [router]);

  const logout = async () => {
    try {
      await apiFetch('/auth/logout', { method: 'POST' });
      router.push('/login');
    } catch (err) {
      console.error('Logout error:', err);
    }
  };

  return { user, loading, logout };
};
