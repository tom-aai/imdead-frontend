'use client';

import { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { getSupabaseClient } from '@/lib/supabase';

export const LoginPage = () => {
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();
  const autoLogin = searchParams.get('autoLogin') === 'true';
  const hasAutoLoginTriggered = useRef(false);

  // Check if already logged in
  useEffect(() => {
    const checkAuth = async () => {
      const supabase = getSupabaseClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (session) {
        router.push('/');
        return;
      }

      // If autoLogin param is set and user is not authenticated, trigger login automatically
      if (autoLogin && !hasAutoLoginTriggered.current) {
        hasAutoLoginTriggered.current = true;
        handleLogin();
      }
    };

    checkAuth();
  }, [router, autoLogin]);

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
      <div className="flex flex-1 flex-col items-center px-6 pt-24 pb-8">
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
        <h1 className="mb-12 text-center">
          <span className="text-fgAccent block text-5xl font-bold tracking-tight md:text-6xl">
            Train Your Avatar On Your Expertise.
          </span>
          <span className="text-fgAccent mt-2 block text-5xl font-bold tracking-tight md:text-6xl">
            Scale Your Reach.
          </span>
        </h1>

        {/* Feature Steps */}
        <div className="mb-12 grid w-full max-w-4xl grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { title: 'Train', description: 'Train your avatar by talking to our AI.' },
            { title: 'Share', description: 'Share your avatar with your network.' },
            { title: 'Engage', description: 'Users talk to your avatar and send you messages.' },
            {
              title: 'Scale',
              description: (
                <>
                  Get inbound leads.
                  <br />
                  Grow your followers.
                </>
              ),
            },
          ].map((step, i) => (
            <div
              key={step.title}
              className="bg-bg2 border-separator1 flex flex-col items-center rounded-2xl border p-6 text-center"
            >
              <span className="text-fg3 mb-2 font-mono text-xs tracking-widest uppercase">
                {String(i + 1).padStart(2, '0')}
              </span>
              <h3 className="text-fgAccent mb-1 text-lg font-bold">{step.title}</h3>
              <p className="text-fg3 text-sm">{step.description}</p>
            </div>
          ))}
        </div>

        {/* Demo Section */}
        <div className="mb-12 flex w-full max-w-2xl flex-col items-center">
          <video autoPlay loop muted playsInline className="mb-6 w-full max-w-[256px] rounded-2xl">
            <source src="/demo-video.mp4" type="video/mp4" />
          </video>
          <p className="text-fgAccent mb-4 text-center text-xl font-semibold">
            Curious about Expert Avatar? Talk to Ashley, an expert in Expert Avatar!
          </p>
          <Link href="https://expertavatar.com/chat/9a852267-2ebb-4465-8ab4-96d4879958e0">
            <Button variant="primary" size="lg" className="font-mono">
              Talk to Ashley
            </Button>
          </Link>
        </div>

        {/* Pricing Card */}
        <div className="bg-bg2 border-separator1 mb-8 w-full max-w-lg rounded-2xl border p-8">
          <h2 className="text-fgAccent mb-6 text-center text-xl font-semibold">Pricing</h2>

          {/* What's Included */}
          <div className="mb-6">
            <h3 className="text-fg3 mb-3 text-sm font-medium tracking-wide uppercase">
              What&apos;s Included
            </h3>
            <ul className="space-y-2">
              <li className="text-foreground flex items-center gap-3">
                <span className="text-fgSuccess">✓</span>
                <span>Unlimited avatars</span>
              </li>
              <li className="text-foreground flex items-center gap-3">
                <span className="text-fgSuccess">✓</span>
                <span>Unlimited training minutes</span>
              </li>
              <li className="text-foreground flex items-center gap-3">
                <span className="text-fgSuccess">✓</span>
                <span>Unlimited minutes to check and answer messages</span>
              </li>
            </ul>
          </div>

          {/* Divider */}
          <div className="border-separator1 my-6 border-t" />

          {/* Usage Pricing */}
          <div>
            <h3 className="text-fg3 mb-3 text-sm font-medium tracking-wide uppercase">
              Audience Usage
            </h3>
            <div className="text-foreground space-y-3">
              <p>
                <span className="text-fgAccent font-semibold">60 minutes free</span> per month of
                others talking to your avatars
              </p>
              <p>
                After 60 minutes: <span className="font-semibold">$0.25 / minute</span>
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Footer with legal links */}
      <footer className="shrink-0 px-8 pb-8">
        <div className="text-fg3 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm">
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
