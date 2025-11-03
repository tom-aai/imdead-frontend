'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getSupabaseClient } from '@/lib/supabase';

export default function AuthCallback() {
  const router = useRouter();

  useEffect(() => {
    const handleCallback = async () => {
      try {
        const supabase = getSupabaseClient();
        
        // Check if we have an error in the URL
        const params = new URLSearchParams(window.location.search);
        const error = params.get('error');
        const errorDescription = params.get('error_description');
        
        if (error) {
          console.error('Authentication failed:', errorDescription || error);
          router.push('/login');
          return;
        }
        
        // Supabase automatically handles the OAuth callback and stores the session
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        
        if (sessionError) {
          console.error('Session error:', sessionError.message);
          router.push('/login');
          return;
        }
        
        if (session && session.user) {
          // Store session info in localStorage for easy access
          localStorage.setItem('supabase_user', JSON.stringify({
            id: session.user.id,
            email: session.user.email,
            provider: session.user.app_metadata?.provider,
          }));
          
          router.push('/');
        } else {
          router.push('/login');
        }
      } catch (error) {
        console.error('Authentication error:', error);
        router.push('/login');
      }
    };

    handleCallback();
  }, [router]);

  return (
    <div className="bg-background fixed inset-0 flex items-center justify-center">
      <div className="text-center">
        <div className="font-mono text-sm">Completing sign in...</div>
      </div>
    </div>
  );
}

