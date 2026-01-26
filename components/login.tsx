'use client';

import { Button } from '@/components/ui/button';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { getSupabaseClient } from '@/lib/supabase';

export const LoginPage = () => {
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  // Check if already logged in
  useEffect(() => {
    const checkAuth = async () => {
      const supabase = getSupabaseClient();
      const { data: { session } } = await supabase.auth.getSession();
      
      if (session) {
        router.push('/');
      }
    };
    
    checkAuth();
  }, [router]);

  const handleLogin = async () => {
    setIsLoading(true);
    
    try {
      const supabase = getSupabaseClient();
      
      // Redirect back to our frontend callback after OAuth
      const redirectTo = `${window.location.origin}/auth/callback`;
      
      // Sign in with LinkedIn OAuth
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'linkedin_oidc',
        options: {
          redirectTo,
        },
      });
      
      if (error) {
        console.error('Authentication error:', error.message);
        setIsLoading(false);
      }
    } catch (error) {
      console.error('Failed to initiate authentication:', error);
      setIsLoading(false);
    }
  };

  return (
    <section className="bg-background fixed inset-0 flex flex-col overflow-y-auto">
      {/* Header with Login button in top-right */}
      <div className="absolute top-8 right-8 z-10">
        <Button 
          variant="primary" 
          size="lg" 
          onClick={handleLogin}
          disabled={isLoading}
          className="font-mono"
        >
          {isLoading ? 'loading...' : 'login'}
        </Button>
      </div>

      {/* Main content area */}
      <div className="flex-1 flex flex-col items-center px-6 pt-24 pb-8">
        {/* Hero Image */}
        <div className="mb-10">
          <Image
            src="/expert_avatar_pink.png"
            alt="Expert Avatar"
            width={480}
            height={480}
            className="rounded-2xl"
            priority
          />
        </div>

        {/* Main Title */}
        <h1 className="text-center mb-12">
          <span className="block text-5xl md:text-6xl font-bold text-fgAccent tracking-tight">
            Train Your Avatar On Your Expertise.
          </span>
          <span className="block text-5xl md:text-6xl font-bold text-fgAccent tracking-tight mt-2">
            Scale Your Reach.
          </span>
        </h1>

        {/* Pricing Card */}
        <div className="w-full max-w-lg bg-bg2 border border-separator1 rounded-2xl p-8 mb-8">
          <h2 className="text-xl font-semibold text-fgAccent mb-6 text-center">
            Pricing
          </h2>

          {/* What's Included */}
          <div className="mb-6">
            <h3 className="text-sm font-medium text-fg3 uppercase tracking-wide mb-3">
              What&apos;s Included
            </h3>
            <ul className="space-y-2">
              <li className="flex items-center gap-3 text-foreground">
                <span className="text-fgSuccess">✓</span>
                <span>Unlimited avatars</span>
              </li>
              <li className="flex items-center gap-3 text-foreground">
                <span className="text-fgSuccess">✓</span>
                <span>Unlimited training minutes</span>
              </li>
              <li className="flex items-center gap-3 text-foreground">
                <span className="text-fgSuccess">✓</span>
                <span>Unlimited minutes to check and answer messages</span>
              </li>
            </ul>
          </div>

          {/* Divider */}
          <div className="border-t border-separator1 my-6" />

          {/* Usage Pricing */}
          <div>
            <h3 className="text-sm font-medium text-fg3 uppercase tracking-wide mb-3">
              Audience Usage
            </h3>
            <div className="space-y-3 text-foreground">
              <p>
                <span className="font-semibold text-fgAccent">60 minutes free</span>
                {' '}per month of others talking to your avatars
              </p>
              <p>
                After 60 minutes:{' '}
                <span className="font-semibold">$0.25 / minute</span>
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Footer with legal links */}
      <footer className="pb-8 px-8 shrink-0">
        <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm text-fg3">
          <Link href="/terms" className="hover:text-foreground transition-colors">
            Terms of Service
          </Link>
          <span className="text-separator2">·</span>
          <Link href="/privacy" className="hover:text-foreground transition-colors">
            Privacy Policy
          </Link>
          <span className="text-separator2">·</span>
          <Link href="/biometric-policy" className="hover:text-foreground transition-colors">
            Biometric Policy
          </Link>
          <span className="text-separator2">·</span>
          <a
            href="mailto:support@melochora.com"
            className="hover:text-foreground transition-colors"
          >
            Contact Us
          </a>
        </div>
      </footer>
    </section>
  );
};
