'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getSupabaseClient } from '@/lib/supabase';

export default function AuthCallback() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const supabase = getSupabaseClient();

    // Check for error params in the URL query string first
    const params = new URLSearchParams(window.location.search);
    const urlError = params.get('error');
    const errorDescription = params.get('error_description');

    if (urlError) {
      console.error('Authentication failed:', errorDescription || urlError);
      setError(errorDescription || 'Authentication failed. Please try again.');
      return;
    }

    // With implicit flow + detectSessionInUrl, the Supabase client automatically
    // picks up tokens from the URL hash fragment (#access_token=...) when initialized.
    // This happens asynchronously, so we use onAuthStateChange to reliably detect
    // when the session is established, instead of racing with getSession().
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' && session?.user) {
        // Store session info in localStorage for easy access
        localStorage.setItem(
          'supabase_user',
          JSON.stringify({
            id: session.user.id,
            email: session.user.email,
            provider: session.user.app_metadata?.provider,
            user_metadata: session.user.user_metadata,
          })
        );

        subscription.unsubscribe();
        router.push('/');
      }
    });

    // Also check if the session was already established by the time we subscribed
    // (in case detectSessionInUrl processed the hash before our listener was set up)
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        localStorage.setItem(
          'supabase_user',
          JSON.stringify({
            id: session.user.id,
            email: session.user.email,
            provider: session.user.app_metadata?.provider,
            user_metadata: session.user.user_metadata,
          })
        );

        subscription.unsubscribe();
        router.push('/');
      }
    });

    // Timeout: if neither the listener nor getSession produced a session after 10s,
    // something went wrong
    const timeout = setTimeout(() => {
      subscription.unsubscribe();
      setError('Sign in timed out. Please try again.');
    }, 10000);

    return () => {
      clearTimeout(timeout);
      subscription.unsubscribe();
    };
  }, [router]);

  if (error) {
    return (
      <div className="bg-background fixed inset-0 flex items-center justify-center">
        <div className="max-w-md px-6 text-center">
          <div className="mb-4 font-mono text-sm text-red-500">{error}</div>
          <button
            onClick={() => router.push('/login')}
            className="text-primary font-mono text-sm underline hover:no-underline"
          >
            Back to login
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-background fixed inset-0 flex items-center justify-center">
      <div className="text-center">
        <div className="font-mono text-sm">Completing sign in...</div>
      </div>
    </div>
  );
}
