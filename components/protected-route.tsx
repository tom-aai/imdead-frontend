'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getSupabaseClient } from '@/lib/supabase';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

export function ProtectedRoute({ children }: ProtectedRouteProps) {
  const router = useRouter();
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const supabase = getSupabaseClient();
        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (!session) {
          router.push('/login');
          return;
        }

        setIsAuthenticated(true);
      } catch (error) {
        console.error('Auth check failed:', error);
        router.push('/login');
      }
    };

    checkAuth();
  }, [router]);

  // Show nothing while checking auth
  if (isAuthenticated === null) {
    return (
      <div className="bg-background fixed inset-0 flex items-center justify-center">
        <div className="text-center">
          <div className="font-mono text-sm">Loading...</div>
        </div>
      </div>
    );
  }

  // Show children only if authenticated
  return isAuthenticated ? <>{children}</> : null;
}
