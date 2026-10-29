'use client';

import { useState } from 'react';
import { CircleNotch } from '@phosphor-icons/react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';

interface ConsentScreenProps {
  sessionId: string;
  onConsented: (name: string) => void;
}

export function ConsentScreen({ sessionId, onConsented }: ConsentScreenProps) {
  const [name, setName] = useState('');
  const [isChecked, setIsChecked] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canContinue = name.trim().length > 0 && isChecked && !isSubmitting;

  const handleContinue = async () => {
    if (!canContinue) return;
    setIsSubmitting(true);
    setError(null);
    try {
      // The name is PII: it goes only to the backend consent record keyed by
      // session_id — never into the LiveKit token identity, room name, or metadata.
      const response = await fetch('/api/consent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_id: sessionId, name: name.trim() }),
      });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to record consent');
      }
      onConsented(name.trim());
    } catch (err) {
      console.error('Error recording consent:', err);
      setError(err instanceof Error ? err.message : 'Failed to record consent');
      setIsSubmitting(false);
    }
  };

  return (
    <section className="bg-background min-h-svh overflow-y-auto">
      <div className="mx-auto max-w-2xl px-6 py-12">
        <h1 className="text-3xl font-semibold">Before you meet your ghost</h1>

        <div className="mt-6 space-y-4 text-sm leading-relaxed">
          <p>
            To bring your ghost to life, we clone both your <strong>voice</strong> and your{' '}
            <strong>likeness</strong>. Your voice is cloned with AssemblyAI&apos;s new
            text-to-speech, <strong>AssemblyAI-TTS-1</strong>, and your photo is transformed into a
            ghostly avatar. By entering your name and continuing, you confirm that{' '}
            <strong>you are the person being cloned</strong> and that you consent to the cloning of
            your voice and likeness. You understand that:
          </p>
          <ul className="ml-4 list-inside list-disc space-y-2">
            <li>
              Your cloned voice and likeness will generate AI responses you did not say or do.
            </li>
            <li>
              Your voice and image data will be shared with third-party services (AssemblyAI for
              voice, Google Gemini for the image) that create your ghost and may use the data to
              analyze and improve their services.
            </li>
            <li>This is a one-time demo; your data is kept only for the duration of the event.</li>
          </ul>
          <p>
            I have read and agree to the{' '}
            <a
              href="/terms"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:text-primary-hover underline"
            >
              Terms of Service
            </a>
            {', '}
            <a
              href="/privacy"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:text-primary-hover underline"
            >
              Privacy Policy
            </a>
            {', and '}
            <a
              href="/biometric-policy"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:text-primary-hover underline"
            >
              Biometric Information Retention &amp; Destruction Policy
            </a>
            .
          </p>
        </div>

        {/* Name — required, ties a real person to the act of consenting. */}
        <div className="mt-8 space-y-2">
          <label htmlFor="consent-name" className="text-sm font-medium">
            Your name
          </label>
          <input
            id="consent-name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            disabled={isSubmitting}
            placeholder="Enter your full name"
            autoComplete="name"
            className="border-input bg-background focus-visible:ring-ring w-full rounded-md border px-3 py-2 text-sm focus-visible:ring-2 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50"
          />
        </div>

        <div className="mt-6 flex items-start space-x-3">
          <Checkbox
            id="consent-checkbox"
            checked={isChecked}
            onCheckedChange={(checked) => setIsChecked(checked === true)}
            disabled={isSubmitting}
          />
          <label
            htmlFor="consent-checkbox"
            className="cursor-pointer text-sm leading-snug font-medium"
          >
            I confirm I am the person being cloned and I consent to the cloning of my voice and
            likeness.
          </label>
        </div>

        {error && <p className="text-destructive mt-4 text-sm">{error}</p>}

        <div className="mt-8">
          <Button
            variant="primary"
            size="lg"
            onClick={handleContinue}
            disabled={!canContinue}
            className="w-full gap-2 sm:w-auto"
          >
            {isSubmitting ? (
              <>
                <CircleNotch size={16} className="animate-spin" />
                Recording consent...
              </>
            ) : (
              'I agree — continue'
            )}
          </Button>
        </div>
      </div>
    </section>
  );
}
