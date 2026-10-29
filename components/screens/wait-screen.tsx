'use client';

import { useEffect, useRef, useState } from 'react';
import { CircleNotch } from '@phosphor-icons/react';

interface WaitScreenProps {
  sessionId: string;
  onReady: () => void;
}

const POLL_INTERVAL = 2000;

export function WaitScreen({ sessionId, onReady }: WaitScreenProps) {
  const [status, setStatus] = useState<{ voice: boolean; ghost: boolean }>({
    voice: false,
    ghost: false,
  });
  const onReadyRef = useRef(onReady);
  onReadyRef.current = onReady;

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    // Gate the session on BOTH the paired voice and the ghost image being ready,
    // so the first TTS turn can't die with 3014 voice_not_paired and LemonSlice
    // always has an image to fetch.
    const poll = async () => {
      try {
        const res = await fetch(`/api/status/${sessionId}`, { cache: 'no-store' });
        if (res.ok) {
          const data = await res.json();
          if (cancelled) return;
          setStatus({ voice: !!data.voice, ghost: !!data.ghost });
          if (data.voice && data.ghost) {
            onReadyRef.current();
            return;
          }
        }
      } catch (error) {
        console.error('Error polling status:', error);
      }
      if (!cancelled) {
        timer = setTimeout(poll, POLL_INTERVAL);
      }
    };

    poll();

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [sessionId]);

  return (
    <section className="bg-background fixed inset-0 flex h-svh flex-col items-center justify-center px-4 text-center">
      <CircleNotch size={56} className="text-primary mb-6 animate-spin" />
      <h1 className="text-3xl font-semibold">Summoning your ghost...</h1>
      <p className="text-muted-foreground mt-3 max-w-md">
        We&apos;re cloning your voice and aging you into the afterlife. This takes a moment.
      </p>
      <div className="text-muted-foreground mt-6 space-y-1 font-mono text-sm">
        <p>{status.voice ? '✓' : '…'} Voice ready</p>
        <p>{status.ghost ? '✓' : '…'} Ghost ready</p>
      </div>
    </section>
  );
}
