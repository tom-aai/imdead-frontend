'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { HamburgerMenu } from '@/components/hamburger-menu';
import { Button } from '@/components/ui/button';
import { getSupabaseClient } from '@/lib/supabase';
import { CircleNotch, Lightning, CheckCircle } from '@phosphor-icons/react';

interface BillingInfo {
  used_seconds: number;
  used_minutes: number;
  free_tier_seconds: number;
  free_tier_minutes: number;
  remaining_seconds: number;
  remaining_minutes: number;
  usage_percentage: number;
  is_exceeded: boolean;
  is_warning: boolean;
  billing_status: string;
  is_admin: boolean;
  is_paid: boolean;
}

export default function SettingsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [emailNotificationsEnabled, setEmailNotificationsEnabled] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  
  // Billing state
  const [billingInfo, setBillingInfo] = useState<BillingInfo | null>(null);
  const [isUpgrading, setIsUpgrading] = useState(false);
  const [billingMessage, setBillingMessage] = useState<string | null>(null);

  // Check for billing redirect params
  useEffect(() => {
    const billingStatus = searchParams.get('billing');
    if (billingStatus === 'success') {
      setBillingMessage('Successfully upgraded to paid plan!');
      // Clear the URL param
      router.replace('/settings');
    } else if (billingStatus === 'cancelled') {
      setBillingMessage('Upgrade cancelled.');
      router.replace('/settings');
    }
  }, [searchParams, router]);

  // Fetch current preferences and billing info
  useEffect(() => {
    const fetchPreferences = async () => {
      try {
        const supabase = getSupabaseClient();
        const { data: { session } } = await supabase.auth.getSession();

        if (!session) {
          router.push('/login');
          return;
        }

        // Fetch preferences
        const response = await fetch('/api/user/preferences', {
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
          },
        });

        if (!response.ok) {
          throw new Error('Failed to fetch preferences');
        }

        const data = await response.json();
        setEmailNotificationsEnabled(data.email_notifications_enabled ?? true);
        
        // Fetch billing info
        try {
          const billingResponse = await fetch('/api/billing/usage', {
            headers: {
              'Authorization': `Bearer ${session.access_token}`,
            },
          });
          if (billingResponse.ok) {
            const billingData = await billingResponse.json();
            setBillingInfo(billingData);
          }
        } catch (billingErr) {
          console.warn('Could not fetch billing info:', billingErr);
        }
      } catch (err) {
        console.error('Error fetching preferences:', err);
        setError('Failed to load preferences');
      } finally {
        setIsLoading(false);
      }
    };

    fetchPreferences();
  }, [router]);

  const handleSave = async () => {
    setIsSaving(true);
    setError(null);
    setSuccessMessage(null);

    try {
      const supabase = getSupabaseClient();
      const { data: { session } } = await supabase.auth.getSession();

      if (!session) {
        router.push('/login');
        return;
      }

      const response = await fetch('/api/user/preferences', {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email_notifications_enabled: emailNotificationsEnabled,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to update preferences');
      }

      setSuccessMessage('Preferences saved successfully');
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err) {
      console.error('Error saving preferences:', err);
      setError(err instanceof Error ? err.message : 'Failed to save preferences');
    } finally {
      setIsSaving(false);
    }
  };

  const handleUpgrade = async () => {
    setIsUpgrading(true);
    setBillingMessage(null);
    
    try {
      const supabase = getSupabaseClient();
      const { data: { session } } = await supabase.auth.getSession();

      if (!session) {
        router.push('/login');
        return;
      }

      const response = await fetch('/api/billing/checkout', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to create checkout session');
      }

      const data = await response.json();
      if (data.checkout_url) {
        // Redirect to Stripe Checkout
        window.location.href = data.checkout_url;
      } else {
        throw new Error('No checkout URL returned');
      }
    } catch (err) {
      console.error('Error starting checkout:', err);
      setBillingMessage(err instanceof Error ? err.message : 'Failed to start checkout');
    } finally {
      setIsUpgrading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="bg-background min-h-screen flex items-center justify-center">
        <CircleNotch size={32} className="animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="bg-background min-h-screen">
      <HamburgerMenu />
      
      <div className="max-w-xl mx-auto px-4 py-12">
        <h1 className="text-3xl font-bold mb-8">Settings</h1>

        {/* Email Notifications Section */}
        <div className="bg-card border border-border rounded-lg p-6 space-y-4">
          <h2 className="text-xl font-semibold">Email Notifications</h2>
          
          <p className="text-muted-foreground">
            Receive email notifications when students send you messages through your avatar.
          </p>

          <div className="flex items-center justify-between">
            <label htmlFor="email-notifications" className="font-medium">
              Enable email notifications
            </label>
            <button
              id="email-notifications"
              type="button"
              role="switch"
              aria-checked={emailNotificationsEnabled}
              onClick={() => setEmailNotificationsEnabled(!emailNotificationsEnabled)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                emailNotificationsEnabled ? 'bg-primary' : 'bg-muted'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  emailNotificationsEnabled ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>

          {error && (
            <p className="text-destructive text-sm">{error}</p>
          )}

          {successMessage && (
            <p className="text-green-600 text-sm">{successMessage}</p>
          )}

          <Button
            onClick={handleSave}
            disabled={isSaving}
            className="w-full"
          >
            {isSaving ? (
              <>
                <CircleNotch size={16} className="mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              'Save Preferences'
            )}
          </Button>
        </div>

        {/* Usage & Billing Section */}
        <div className="bg-card border border-border rounded-lg p-6 space-y-4 mt-6">
          <h2 className="text-xl font-semibold">Usage & Billing</h2>
          
          {billingInfo ? (
            <>
              {billingInfo.is_admin ? (
                <div className="flex items-center gap-2 text-green-600">
                  <CheckCircle size={20} />
                  <span className="font-medium">Admin - Unlimited Usage</span>
                </div>
              ) : billingInfo.is_paid ? (
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-green-600">
                    <CheckCircle size={20} />
                    <span className="font-medium">Paid Plan Active</span>
                  </div>
                  <p className="text-muted-foreground text-sm">
                    This month: {billingInfo.used_minutes} minutes used
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  <p className="text-muted-foreground">
                    Your Expert Avatar includes 60 free minutes of chat sessions per month.
                  </p>
                  
                  {/* Usage Progress Bar */}
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>{Math.round(billingInfo.used_minutes)} min used</span>
                      <span>{Math.round(billingInfo.free_tier_minutes)} min total</span>
                    </div>
                    <div className="w-full bg-muted rounded-full h-3 overflow-hidden">
                      <div 
                        className={`h-full rounded-full transition-all ${
                          billingInfo.is_exceeded 
                            ? 'bg-destructive' 
                            : billingInfo.is_warning 
                              ? 'bg-yellow-500' 
                              : 'bg-primary'
                        }`}
                        style={{ width: `${Math.min(billingInfo.usage_percentage, 100)}%` }}
                      />
                    </div>
                    {billingInfo.is_exceeded ? (
                      <p className="text-destructive text-sm font-medium">
                        Free tier exhausted. Upgrade to continue sharing your avatar.
                      </p>
                    ) : billingInfo.is_warning ? (
                      <p className="text-yellow-600 text-sm">
                        {Math.round(billingInfo.remaining_minutes)} minutes remaining this month.
                      </p>
                    ) : (
                      <p className="text-muted-foreground text-sm">
                        {Math.round(billingInfo.remaining_minutes)} minutes remaining this month.
                      </p>
                    )}
                  </div>
                  
                  {/* Upgrade Button */}
                  <Button
                    onClick={handleUpgrade}
                    disabled={isUpgrading}
                    variant={billingInfo.is_exceeded ? "default" : "outline"}
                    className="w-full"
                  >
                    {isUpgrading ? (
                      <>
                        <CircleNotch size={16} className="mr-2 animate-spin" />
                        Loading...
                      </>
                    ) : (
                      <>
                        <Lightning size={16} className="mr-2" />
                        Upgrade to Paid
                      </>
                    )}
                  </Button>
                </div>
              )}
              
              {billingMessage && (
                <p className={`text-sm ${billingMessage.includes('Success') ? 'text-green-600' : 'text-muted-foreground'}`}>
                  {billingMessage}
                </p>
              )}
            </>
          ) : (
            <div className="flex items-center justify-center py-4">
              <CircleNotch size={24} className="animate-spin text-muted-foreground" />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

