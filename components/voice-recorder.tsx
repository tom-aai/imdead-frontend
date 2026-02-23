'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { CircleNotch, Microphone, Stop } from '@phosphor-icons/react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface VoiceRecorderProps {
  /** Callback when recording is complete */
  onRecordingComplete: (audioBlob: Blob) => void;
  /** Whether the recorder is disabled */
  disabled?: boolean;
  /** Optional className */
  className?: string;
}

export function VoiceRecorder({
  onRecordingComplete,
  disabled = false,
  className,
}: VoiceRecorderProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [microphoneError, setMicrophoneError] = useState<string | null>(null);
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [audioLevels, setAudioLevels] = useState<number[]>([0.1, 0.1, 0.1, 0.1, 0.1]);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  // Request microphone permission on mount
  useEffect(() => {
    const requestPermission = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        stream.getTracks().forEach((track) => track.stop());
        setHasPermission(true);
        setMicrophoneError(null);
      } catch (error) {
        setHasPermission(false);
        if (error instanceof Error) {
          if (error.name === 'NotAllowedError') {
            setMicrophoneError('Microphone access denied. Please allow microphone permission.');
          } else if (error.name === 'NotFoundError') {
            setMicrophoneError('No microphone found. Please connect a microphone.');
          } else {
            setMicrophoneError(`Microphone error: ${error.message}`);
          }
        }
      }
    };

    requestPermission();
  }, []);

  // Update audio levels from analyser
  const updateAudioLevels = useCallback(() => {
    if (!analyserRef.current) return;

    const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
    analyserRef.current.getByteFrequencyData(dataArray);

    // Custom frequency bands centered around male voice (fundamental ~85-180 Hz)
    // With fftSize=1024 and sampleRate=48000, each bin = 46.875 Hz
    // Bin index = frequency / 46.875
    const sampleRate = 48000;
    const binResolution = sampleRate / 1024; // ~46.875 Hz per bin

    // Frequency ranges for 5 bars, with middle bar (index 2) centered on male voice fundamental
    const frequencyBands = [
      { min: 40, max: 80 }, // Bar 0: Sub-bass rumble
      { min: 80, max: 150 }, // Bar 1: Low bass
      { min: 150, max: 300 }, // Bar 2 (MIDDLE): Male voice fundamental (~85-180 Hz) + first harmonics
      { min: 300, max: 1000 }, // Bar 3: Voice harmonics, first formant
      { min: 1000, max: 4000 }, // Bar 4: Upper harmonics, clarity/presence
    ];

    const levels: number[] = [];

    for (const band of frequencyBands) {
      const startBin = Math.floor(band.min / binResolution);
      const endBin = Math.min(Math.floor(band.max / binResolution), dataArray.length - 1);

      let sum = 0;
      const binCount = endBin - startBin + 1;
      for (let j = startBin; j <= endBin; j++) {
        sum += dataArray[j];
      }

      // Normalize to 0-1 range with moderate sensitivity
      const avg = sum / binCount;
      const level = Math.max(0.1, Math.pow(avg / 200, 0.85) * 1.2);
      levels.push(Math.min(1, level));
    }

    setAudioLevels(levels);

    if (isRecording) {
      animationFrameRef.current = requestAnimationFrame(updateAudioLevels);
    }
  }, [isRecording]);

  // Start recording
  const startRecording = async () => {
    try {
      setMicrophoneError(null);
      chunksRef.current = [];
      setElapsedTime(0);

      // Get audio stream
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          sampleRate: 48000,
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
        },
      });
      streamRef.current = stream;

      // Set up audio context for visualization
      const audioContext = new AudioContext();
      audioContextRef.current = audioContext;

      // Set up audio analyzer
      const source = audioContext.createMediaStreamSource(stream);
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 1024; // Higher FFT for better low-frequency resolution (~47 Hz per bin at 48kHz)
      analyser.smoothingTimeConstant = 0.4;
      source.connect(analyser);
      analyserRef.current = analyser;

      // Set up MediaRecorder
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'audio/webm;codecs=opus',
      });
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        // Send WebM directly to backend for conversion
        const webmBlob = new Blob(chunksRef.current, { type: 'audio/webm' });

        // Close the AudioContext
        try {
          await audioContext.close();
        } catch {
          // Context may already be closed
        }
        audioContextRef.current = null;

        onRecordingComplete(webmBlob);
      };

      mediaRecorder.start(100);
      setIsRecording(true);

      // Start timer
      timerRef.current = setInterval(() => {
        setElapsedTime((prev) => prev + 1);
      }, 1000);
    } catch (error) {
      console.error('Failed to start recording:', error);
      if (error instanceof Error) {
        setMicrophoneError(`Failed to start recording: ${error.message}`);
      }
    }
  };

  // Start audio level updates when recording starts
  useEffect(() => {
    if (isRecording && analyserRef.current) {
      updateAudioLevels();
    }
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [isRecording, updateAudioLevels]);

  // Stop recording
  const stopRecording = useCallback(() => {
    // Stop the timer
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    // Stop animation
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    analyserRef.current = null;
    setAudioLevels([0.1, 0.1, 0.1, 0.1, 0.1]);

    // Stop the media recorder
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }

    // Stop the stream tracks
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }

    setIsRecording(false);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopRecording();
    };
  }, [stopRecording]);

  // Format time as MM:SS
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className={cn('flex flex-col items-center gap-6', className)}>
      {/* Timer */}
      <div className="text-center">
        <div className="font-mono text-3xl font-bold">{formatTime(elapsedTime)}</div>
        {isRecording && <div className="text-muted-foreground mt-1 text-sm">Recording...</div>}
      </div>

      {/* Audio Level Visualizer - 5 bars */}
      {isRecording && (
        <div className="flex h-16 items-center justify-center gap-1.5">
          {audioLevels.map((level, index) => (
            <div
              key={index}
              className="bg-primary w-3 rounded-full transition-all duration-75"
              style={{
                height: `${level * 64}px`,
                opacity: 0.5 + level * 0.5,
              }}
            />
          ))}
        </div>
      )}

      {/* Error message */}
      {microphoneError && (
        <div className="text-destructive max-w-xs text-center text-sm">{microphoneError}</div>
      )}

      {/* Record/Stop Button */}
      <Button
        variant={isRecording ? 'destructive' : 'primary'}
        size="lg"
        onClick={isRecording ? stopRecording : startRecording}
        disabled={disabled || hasPermission === false}
        className="w-48 gap-2"
      >
        {hasPermission === null ? (
          <>
            <CircleNotch size={20} className="animate-spin" />
            Checking...
          </>
        ) : isRecording ? (
          <>
            <Stop size={20} weight="fill" />
            Stop Recording
          </>
        ) : (
          <>
            <Microphone size={20} weight="fill" />
            Start Recording
          </>
        )}
      </Button>
    </div>
  );
}
