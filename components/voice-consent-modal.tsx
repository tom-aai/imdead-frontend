'use client';

import { useState } from 'react';
import { CircleNotch } from '@phosphor-icons/react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { getSupabaseClient } from '@/lib/supabase';

interface VoiceConsentModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConsent: () => void;
  onCancel: () => void;
}

export function VoiceConsentModal({
  open,
  onOpenChange,
  onConsent,
  onCancel,
}: VoiceConsentModalProps) {
  const [isChecked, setIsChecked] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleProceed = async () => {
    if (!isChecked || isSubmitting) return;

    setIsSubmitting(true);
    try {
      const supabase = getSupabaseClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        throw new Error('You must be logged in to provide consent');
      }

      // Call the consent API
      const response = await fetch('/api/user/voice-consent', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to record consent');
      }

      // Consent recorded successfully, call the onConsent callback
      onConsent();
      // Reset state
      setIsChecked(false);
      setIsSubmitting(false);
      onOpenChange(false);
    } catch (error) {
      console.error('Error recording consent:', error);
      setIsSubmitting(false);
      // You might want to show an error toast here
      alert(error instanceof Error ? error.message : 'Failed to record consent');
    }
  };

  const handleCancel = () => {
    setIsChecked(false);
    setIsSubmitting(false);
    onCancel();
    onOpenChange(false);
  };

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen && !isSubmitting) {
      // Modal is being closed (via X button or outside click)
      handleCancel();
    }
    onOpenChange(newOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Voice Cloning Consent</DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-4">
          <div className="space-y-4 text-sm leading-relaxed">
            <p>
              I consent to Expert Avatar using my voice recording and voiceprint (collectively,
              voice data) to create my Cloned Voice for my Expert avatar. I understand that:
            </p>
            <ul className="ml-4 list-inside list-disc space-y-2">
              <li>My Cloned Voice will generate AI responses I did not personally speak.</li>
              <li>My voice data will be retained while my account is active.</li>
              <li>
                My voice data will be shared with third-party voice cloning services who create my
                Cloned Voice and who may use my voice data to analyze and improve their services.
              </li>
              <li>
                I can revoke consent and delete my voice data by deleting my Expert Avatar account.
              </li>
            </ul>
            <p>
              I have read and agree to the{' '}
              <a
                href="https://expertavatar.com/terms"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:text-primary-hover underline"
              >
                Terms of Service
              </a>
              {', '}
              <a
                href="https://expertavatar.com/privacy"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:text-primary-hover underline"
              >
                Privacy Policy
              </a>
              {', and '}
              <a
                href="https://expertavatar.com/biometric-policy"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:text-primary-hover underline"
              >
                Biometric Information Retention & Destruction Policy
              </a>
              .
            </p>
          </div>

          <div className="flex items-start space-x-3 py-4">
            <Checkbox
              id="consent-checkbox"
              checked={isChecked}
              onCheckedChange={(checked) => setIsChecked(checked === true)}
              disabled={isSubmitting}
            />
            <label
              htmlFor="consent-checkbox"
              className="cursor-pointer text-sm leading-none font-medium peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
            >
              I consent to the above terms and conditions
            </label>
          </div>
        </div>

        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end sm:space-x-2">
          <Button variant="outline" onClick={handleCancel} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={handleProceed}
            disabled={!isChecked || isSubmitting}
            className="gap-2"
          >
            {isSubmitting ? (
              <>
                <CircleNotch size={16} className="animate-spin" />
                Processing...
              </>
            ) : (
              'Proceed'
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
