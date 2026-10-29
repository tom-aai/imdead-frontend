'use client';

import { useState } from 'react';
import { CheckCircle, CircleNotch, Warning } from '@phosphor-icons/react';
import { Button } from '@/components/ui/button';
import { VoiceRecorder } from '@/components/voice-recorder';

interface VoiceScreenProps {
  sessionId: string;
  onCloned: (voiceId: string) => void;
}

type State = 'idle' | 'cloning' | 'error';

const SAMPLE_SCRIPT = `I am making a recording of my voice for my ghost to use. My ghost needs my voice. It has an important message for me.`;

export function VoiceScreen({ sessionId, onCloned }: VoiceScreenProps) {
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null);
  const [state, setState] = useState<State>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleRecordingComplete = (audioBlob: Blob) => {
    console.log('Recording complete:', audioBlob.size, 'bytes');
    setRecordedBlob(audioBlob);
    setState('idle');
    setErrorMessage(null);
  };

  const handleRecordAgain = () => {
    setRecordedBlob(null);
    setState('idle');
    setErrorMessage(null);
  };

  const handleSubmit = async () => {
    if (!recordedBlob) return;
    setState('cloning');
    setErrorMessage(null);
    try {
      // Keep the upload shape identical to the original: field `audio`, filename
      // `voice-recording.wav` (the deliberate webm-named-.wav quirk stays), no
      // manual Content-Type. We only append session_id so the clone is persisted.
      const formData = new FormData();
      formData.append('audio', recordedBlob, 'voice-recording.wav');
      formData.append('session_id', sessionId);

      const response = await fetch('/api/clone-voice', {
        method: 'POST',
        body: formData,
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to clone voice');
      }
      if (!data.voice_id) {
        throw new Error('Backend did not return a voice_id');
      }
      onCloned(data.voice_id);
    } catch (error) {
      console.error('Failed to clone voice:', error);
      setState('error');
      setErrorMessage(error instanceof Error ? error.message : 'An unexpected error occurred');
    }
  };

  return (
    <section className="bg-background min-h-svh overflow-y-auto">
      <div className="mx-auto max-w-2xl px-6 py-12">
        <h1 className="text-3xl font-semibold">Clone your voice</h1>
        <p className="text-muted-foreground mt-2">
          Record about 10 seconds so your ghost can speak in your own voice.
        </p>

        <div className="bg-primary/5 border-primary/20 mt-6 space-y-3 rounded-lg border p-6">
          <h3 className="text-primary text-sm font-semibold tracking-wide uppercase">
            Unsure what to say? Use this script.
          </h3>
          <p className="text-lg leading-relaxed italic">&ldquo;{SAMPLE_SCRIPT}&rdquo;</p>
        </div>

        <div className="flex flex-col items-center py-10">
          {state === 'cloning' ? (
            <div className="bg-primary/10 border-primary/30 rounded-lg border p-6 text-center">
              <CircleNotch size={48} className="text-primary mx-auto mb-3 animate-spin" />
              <p className="font-medium">Cloning your voice...</p>
              <p className="text-muted-foreground mt-1 text-sm">This can take up to a minute.</p>
            </div>
          ) : !recordedBlob ? (
            <VoiceRecorder onRecordingComplete={handleRecordingComplete} />
          ) : (
            <div className="space-y-6 text-center">
              <div className="rounded-lg border border-green-500/30 bg-green-500/10 p-6">
                <CheckCircle size={48} weight="fill" className="mx-auto mb-3 text-green-500" />
                <p className="font-medium">Recording complete!</p>
                <p className="text-muted-foreground mt-1 text-sm">
                  {(recordedBlob.size / 1024).toFixed(1)} KB recorded
                </p>
              </div>

              {state === 'error' && errorMessage && (
                <div className="text-destructive flex items-center justify-center gap-2 text-sm">
                  <Warning size={16} weight="fill" />
                  {errorMessage}
                </div>
              )}

              <div className="flex justify-center gap-4">
                <Button variant="outline" onClick={handleRecordAgain}>
                  Record again
                </Button>
                <Button variant="primary" onClick={handleSubmit}>
                  Use this recording
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
