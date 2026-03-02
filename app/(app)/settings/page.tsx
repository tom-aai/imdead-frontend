'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { CheckCircle, CircleNotch, Gear, Lightning, Trash, Warning } from '@phosphor-icons/react';
import { HamburgerMenu } from '@/components/hamburger-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { getSupabaseClient, signOut } from '@/lib/supabase';

interface BillingInfo {
  used_seconds: number;
  used_minutes: number;
  free_tier_seconds: number | null;
  free_tier_minutes: number | null;
  remaining_seconds: number | null;
  remaining_minutes: number | null;
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
  const [isManagingSubscription, setIsManagingSubscription] = useState(false);
  const [billingMessage, setBillingMessage] = useState<string | null>(null);

  // Account deletion state
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

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
        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (!session) {
          router.push('/login');
          return;
        }

        // Fetch preferences
        const response = await fetch('/api/user/preferences', {
          headers: {
            Authorization: `Bearer ${session.access_token}`,
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
              Authorization: `Bearer ${session.access_token}`,
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
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        router.push('/login');
        return;
      }

      const response = await fetch('/api/user/preferences', {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${session.access_token}`,
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
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        router.push('/login');
        return;
      }

      const response = await fetch('/api/billing/checkout', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${session.access_token}`,
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

  const handleManageSubscription = async () => {
    setIsManagingSubscription(true);
    setBillingMessage(null);

    try {
      const supabase = getSupabaseClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        router.push('/login');
        return;
      }

      const response = await fetch('/api/billing/portal', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to open subscription management');
      }

      const data = await response.json();
      if (data.portal_url) {
        // Redirect to Stripe Customer Portal
        window.location.href = data.portal_url;
      } else {
        throw new Error('No portal URL returned');
      }
    } catch (err) {
      console.error('Error opening subscription portal:', err);
      setBillingMessage(
        err instanceof Error ? err.message : 'Failed to open subscription management'
      );
    } finally {
      setIsManagingSubscription(false);
    }
  };

  const handleDeleteAccount = async () => {
    setIsDeleting(true);
    setDeleteError(null);

    try {
      const supabase = getSupabaseClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        router.push('/login');
        return;
      }

      const response = await fetch('/api/user/delete', {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to delete account');
      }

      // Sign out and redirect to login
      await signOut();
      router.push('/login');
    } catch (err) {
      console.error('Error deleting account:', err);
      setDeleteError(err instanceof Error ? err.message : 'Failed to delete account');
      setIsDeleting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="bg-background flex min-h-screen items-center justify-center">
        <CircleNotch size={32} className="text-muted-foreground animate-spin" />
      </div>
    );
  }

  return (
    <div className="bg-background min-h-screen">
      <HamburgerMenu />

      <div className="mx-auto max-w-xl px-4 py-12">
        <h1 className="mb-8 text-3xl font-bold">Settings</h1>

        {/* Email Notifications Section */}
        <div className="bg-card border-border space-y-4 rounded-lg border p-6">
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

          {error && <p className="text-destructive text-sm">{error}</p>}

          {successMessage && <p className="text-sm text-green-600">{successMessage}</p>}

          <Button onClick={handleSave} disabled={isSaving} className="w-full">
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
        <div className="bg-card border-border mt-6 space-y-4 rounded-lg border p-6">
          <h2 className="text-xl font-semibold">Usage & Billing</h2>

          {billingInfo ? (
            <>
              {billingInfo.is_admin ? (
                <div className="flex items-center gap-2 text-green-600">
                  <CheckCircle size={20} />
                  <span className="font-medium">Admin - Unlimited Usage</span>
                </div>
              ) : billingInfo.is_paid ? (
                <div className="space-y-4">
                  <div className="flex items-center gap-2 text-green-600">
                    <CheckCircle size={20} />
                    <span className="font-medium">Paid Plan Active</span>
                  </div>
                  <p className="text-muted-foreground text-sm">
                    This month: {billingInfo.used_minutes} minutes used
                  </p>
                  <Button
                    onClick={handleManageSubscription}
                    disabled={isManagingSubscription}
                    variant="outline"
                    className="w-full"
                  >
                    {isManagingSubscription ? (
                      <>
                        <CircleNotch size={16} className="mr-2 animate-spin" />
                        Loading...
                      </>
                    ) : (
                      <>
                        <Gear size={16} className="mr-2" />
                        Manage Subscription
                      </>
                    )}
                  </Button>
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
                      <span>{Math.round(billingInfo.free_tier_minutes ?? 0)} min total</span>
                    </div>
                    <div className="bg-muted h-3 w-full overflow-hidden rounded-full">
                      <div
                        className={`h-full rounded-full transition-all ${
                          billingInfo.is_exceeded
                            ? 'bg-primary'
                            : billingInfo.is_warning
                              ? 'bg-yellow-500'
                              : 'bg-primary'
                        }`}
                        style={{ width: `${Math.min(billingInfo.usage_percentage, 100)}%` }}
                      />
                    </div>
                    {billingInfo.is_exceeded ? (
                      <p className="text-primary text-sm font-medium">
                        Free tier exhausted. Upgrade to continue sharing your avatar.
                      </p>
                    ) : billingInfo.is_warning ? (
                      <p className="text-sm text-yellow-600">
                        {Math.round(billingInfo.remaining_minutes ?? 0)} minutes remaining this month.
                      </p>
                    ) : (
                      <p className="text-muted-foreground text-sm">
                        {Math.round(billingInfo.remaining_minutes ?? 0)} minutes remaining this month.
                      </p>
                    )}
                  </div>

                  {/* Upgrade Button */}
                  <Button
                    onClick={handleUpgrade}
                    disabled={isUpgrading}
                    variant={billingInfo.is_exceeded ? 'default' : 'outline'}
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
                <p
                  className={`text-sm ${billingMessage.includes('Success') ? 'text-green-600' : 'text-muted-foreground'}`}
                >
                  {billingMessage}
                </p>
              )}
            </>
          ) : (
            <div className="flex items-center justify-center py-4">
              <CircleNotch size={24} className="text-muted-foreground animate-spin" />
            </div>
          )}
        </div>

        {/* Delete Account Section */}
        <div className="bg-card border-destructive/30 mt-6 space-y-4 rounded-lg border p-6">
          <h2 className="text-xl font-semibold text-white">Danger Zone</h2>

          <p className="text-muted-foreground text-sm">
            Once you delete your account, there is no going back. All your data, avatars, and chat
            history will be permanently deleted. Any active subscription will be cancelled.
          </p>

          {deleteError && <p className="text-destructive text-sm">{deleteError}</p>}

          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" className="w-full" disabled={isDeleting}>
                {isDeleting ? (
                  <>
                    <CircleNotch size={16} className="mr-2 animate-spin" />
                    Deleting...
                  </>
                ) : (
                  <>
                    <Trash size={16} className="mr-2" />
                    Delete Account
                  </>
                )}
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle className="flex items-center gap-2">
                  <Warning size={20} className="text-destructive" />
                  Delete your account?
                </AlertDialogTitle>
                <AlertDialogDescription>
                  This action cannot be undone. All your data, avatars, and chat history will be
                  permanently deleted. Any active subscription will be cancelled immediately.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={handleDeleteAccount}
                  disabled={isDeleting}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  {isDeleting ? (
                    <>
                      <CircleNotch size={16} className="mr-2 animate-spin" />
                      Deleting...
                    </>
                  ) : (
                    'Delete Account'
                  )}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>
    </div>
  );
}
