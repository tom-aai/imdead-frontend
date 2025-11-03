'use client';

import { Button } from '@/components/ui/button';
import { useState } from 'react';
import { getSupabaseClient } from '@/lib/supabase';

export const LoginPage = () => {
  const [isLoading, setIsLoading] = useState(false);

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
    <section className="bg-background fixed inset-0 flex flex-col">
      {/* Header with Login button in top-right */}
      <div className="absolute top-8 right-8">
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

      {/* Rest of the page is blank */}
      <div className="flex-1" />
    </section>
  );
};

