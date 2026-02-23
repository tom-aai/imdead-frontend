'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { CheckCircle, CircleNotch, Warning } from '@phosphor-icons/react';
import { HamburgerMenu } from '@/components/hamburger-menu';
import { ProtectedRoute } from '@/components/protected-route';
import { Button } from '@/components/ui/button';
import { VoiceConsentModal } from '@/components/voice-consent-modal';
import { VoiceRecorder } from '@/components/voice-recorder';
import { getSupabaseClient } from '@/lib/supabase';

type SubmissionState = 'idle' | 'submitting' | 'processing' | 'success' | 'error';

const SAMPLE_SCRIPT = `I am making a recording. The audio recording will be used to clone my voice. My expert avatar will use my cloned voice. I'm excited to hear how it turns out!`;

const POLL_INTERVAL = 3000; // 3 seconds

export default function RecloneVoicePage() {
  const router = useRouter();
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null);
  const [submissionState, setSubmissionState] = useState<SubmissionState>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [jobId, setJobId] = useState<string | null>(null);
  const [showConsentModal, setShowConsentModal] = useState(false);
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Clean up polling on unmount
  useEffect(() => {
    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
      }
    };
  }, []);

  const handleRecordingComplete = (audioBlob: Blob) => {
    console.log('Recording complete:', audioBlob.size, 'bytes');
    setRecordedBlob(audioBlob);
    setSubmissionState('idle');
    setErrorMessage(null);
  };

  const pollJobStatus = async (jobId: string, accessToken: string) => {
    try {
      const response = await fetch(`/api/reclone-voice/status/${jobId}`, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to check job status');
      }

      if (data.status === 'completed') {
        // Stop polling and show success
        if (pollIntervalRef.current) {
          clearInterval(pollIntervalRef.current);
          pollIntervalRef.current = null;
        }
        console.log('Voice re-cloned successfully:', data.result);
        setSubmissionState('success');
      } else if (data.status === 'failed') {
        // Stop polling and show error
        if (pollIntervalRef.current) {
          clearInterval(pollIntervalRef.current);
          pollIntervalRef.current = null;
        }
        throw new Error(data.error || 'Voice cloning failed');
      }
      // If still pending or processing, continue polling
    } catch (error) {
      console.error('Error polling job status:', error);
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
      }
      setSubmissionState('error');
      setErrorMessage(error instanceof Error ? error.message : 'Failed to check job status');
    }
  };

  const handleSubmit = async () => {
    if (!recordedBlob) return;

    setSubmissionState('submitting');
    setErrorMessage(null);

    try {
      const supabase = getSupabaseClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        throw new Error('You must be logged in to re-clone your voice');
      }

      const formData = new FormData();
      formData.append('audio', recordedBlob, 'voice-recording.wav');

      const response = await fetch('/api/reclone-voice', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to submit voice recording');
      }

      console.log('Voice reclone job enqueued:', data.job_id);
      setJobId(data.job_id);
      setSubmissionState('processing');

      // Start polling for job status
      pollIntervalRef.current = setInterval(() => {
        pollJobStatus(data.job_id, session.access_token);
      }, POLL_INTERVAL);

      // Also poll immediately
      pollJobStatus(data.job_id, session.access_token);
    } catch (error) {
      console.error('Failed to submit recording:', error);
      setSubmissionState('error');
      setErrorMessage(error instanceof Error ? error.message : 'An unexpected error occurred');
    }
  };

  const handleRecordAgain = () => {
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }
    setRecordedBlob(null);
    setSubmissionState('idle');
    setErrorMessage(null);
    setJobId(null);
  };

  const isProcessing = submissionState === 'submitting' || submissionState === 'processing';

  return (
    <ProtectedRoute>
      <div className="bg-background min-h-screen">
        {/* Header */}
        <div className="bg-background/95 supports-[backdrop-filter]:bg-background/60 border-border sticky top-0 z-10 border-b backdrop-blur">
          <div className="container mx-auto flex items-center justify-between px-8 py-6">
            <h1 className="text-2xl font-semibold">Re-Clone Voice</h1>
            <HamburgerMenu inline />
          </div>
        </div>

        {/* Main Content */}
        <div className="container mx-auto max-w-2xl px-8 py-12">
          {submissionState === 'success' ? (
            // Success state
            <div className="space-y-6 text-center">
              <div className="flex justify-center">
                <CheckCircle size={64} weight="fill" className="text-green-500" />
              </div>
              <h2 className="text-2xl font-semibold">Voice Cloned Successfully!</h2>
              <p className="text-muted-foreground">
                Your voice has been re-cloned. Your expert avatar will now use your new voice.
              </p>
              <Button
                variant="primary"
                size="lg"
                onClick={() => router.push('/dashboard')}
                className="mt-4"
              >
                Return to Dashboard
              </Button>
            </div>
          ) : (
            // Recording state
            <div className="space-y-8">
              {/* Guidelines */}
              <div className="bg-muted/30 space-y-4 rounded-lg p-6">
                <h2 className="text-lg font-semibold">Best Practices for Voice Cloning</h2>
                <ul className="space-y-2 text-sm">
                  <li className="flex items-start gap-2">
                    <span className="text-primary font-bold">•</span>
                    <span>
                      <strong>Avoid background noise</strong>
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-primary font-bold">•</span>
                    <span>
                      <strong>Record for about 10 seconds</strong>
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-primary font-bold">•</span>
                    <span>
                      <strong>Speak clearly</strong>
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-primary font-bold">•</span>
                    <span>
                      <strong>Avoid long pauses</strong>
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-primary font-bold">•</span>
                    <span>
                      <strong>Speak at your natural speed</strong>
                    </span>
                  </li>
                </ul>
              </div>

              {/* Sample Script */}
              <div className="bg-primary/5 border-primary/20 space-y-3 rounded-lg border p-6">
                <h3 className="text-primary text-sm font-semibold tracking-wide uppercase">
                  Unsure What To Say? Use This Script.
                </h3>
                <p className="text-lg leading-relaxed italic">&ldquo;{SAMPLE_SCRIPT}&rdquo;</p>
              </div>

              {/* Voice Recorder */}
              <div className="flex flex-col items-center py-8">
                {!recordedBlob ? (
                  <VoiceRecorder
                    onRecordingComplete={handleRecordingComplete}
                    disabled={isProcessing}
                  />
                ) : (
                  <div className="space-y-6 text-center">
                    {submissionState === 'processing' ? (
                      // Processing state
                      <div className="bg-primary/10 border-primary/30 rounded-lg border p-6">
                        <CircleNotch size={48} className="text-primary mx-auto mb-3 animate-spin" />
                        <p className="font-medium">Cloning your voice...</p>
                        <p className="text-muted-foreground mt-1 text-sm">
                          This may take a minute or two
                        </p>
                      </div>
                    ) : (
                      // Recording complete, ready to submit
                      <div className="rounded-lg border border-green-500/30 bg-green-500/10 p-6">
                        <CheckCircle
                          size={48}
                          weight="fill"
                          className="mx-auto mb-3 text-green-500"
                        />
                        <p className="font-medium">Recording Complete!</p>
                        <p className="text-muted-foreground mt-1 text-sm">
                          {(recordedBlob.size / 1024).toFixed(1)} KB recorded
                        </p>
                      </div>
                    )}

                    {/* Error message */}
                    {submissionState === 'error' && errorMessage && (
                      <div className="text-destructive flex items-center gap-2 text-sm">
                        <Warning size={16} weight="fill" />
                        {errorMessage}
                      </div>
                    )}

                    {/* Action buttons */}
                    {submissionState !== 'processing' && (
                      <div className="flex justify-center gap-4">
                        <Button
                          variant="outline"
                          onClick={handleRecordAgain}
                          disabled={isProcessing}
                        >
                          Record Again
                        </Button>
                        <Button
                          variant="primary"
                          onClick={() => {
                            // Show consent modal instead of submitting directly
                            setShowConsentModal(true);
                          }}
                          disabled={isProcessing}
                          className="gap-2"
                        >
                          Submit & Clone Voice
                        </Button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      <VoiceConsentModal
        open={showConsentModal}
        onOpenChange={setShowConsentModal}
        onConsent={() => {
          // User consented, proceed with submitting the recording
          handleSubmit();
        }}
        onCancel={() => {
          // User cancelled, stay on the recording page (modal will close)
        }}
      />
    </ProtectedRoute>
  );
}
