'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { uploadAvatarImage, getSupabaseClient } from '@/lib/supabase';
import { CircleNotch, ArrowLeft } from '@phosphor-icons/react';

export default function EditAvatarPage() {
  const router = useRouter();
  const params = useParams();
  const sessionId = params.session_id as string;

  const [cameraEnabled, setCameraEnabled] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Enable camera on mount
  useEffect(() => {
    const enableCamera = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            width: { ideal: 512 },
            height: { ideal: 512 },
            facingMode: 'user',
          },
          audio: false,
        });

        streamRef.current = stream;

        const waitForVideoElement = () => {
          if (videoRef.current) {
            videoRef.current.srcObject = stream;

            videoRef.current.onloadedmetadata = () => {
              setCameraEnabled(true);
              setCameraError(null);
            };

            videoRef.current.onerror = (error) => {
              console.error('Video error:', error);
              setCameraError('Video failed to load');
              setCameraEnabled(false);
            };
          } else {
            setTimeout(waitForVideoElement, 50);
          }
        };

        waitForVideoElement();
      } catch (error) {
        console.error('Error accessing camera:', error);

        if (error instanceof Error) {
          if (error.name === 'NotAllowedError') {
            setCameraError('Camera access denied. Please allow camera permission and refresh.');
          } else if (error.name === 'NotFoundError') {
            setCameraError('No camera found. Please connect a camera.');
          } else if (error.name === 'NotReadableError') {
            setCameraError('Camera is already in use by another application.');
          } else {
            setCameraError(`Camera error: ${error.message}`);
          }
        } else {
          setCameraError('Camera access denied or not available');
        }
        setCameraEnabled(false);
      }
    };

    const timer = setTimeout(() => {
      enableCamera();
    }, 200);

    return () => {
      clearTimeout(timer);
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => {
          track.stop();
        });
        streamRef.current = null;
      }
    };
  }, []);

  const takePictureAndSubmit = async () => {
    if (!videoRef.current || !canvasRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const context = canvas.getContext('2d');

    if (!context || video.videoWidth === 0 || video.videoHeight === 0) return;

    setIsProcessing(true);
    setError(null);

    try {
      // Generate a unique ID for this picture
      const pictureId = crypto.randomUUID();
      console.log('Generated new picture ID:', pictureId);

      // Set canvas to 512x512 for the output image
      const targetSize = 512;
      canvas.width = targetSize;
      canvas.height = targetSize;

      // Calculate center crop from the video
      const videoWidth = video.videoWidth;
      const videoHeight = video.videoHeight;
      const minDimension = Math.min(videoWidth, videoHeight);
      const sx = (videoWidth - minDimension) / 2;
      const sy = (videoHeight - minDimension) / 2;

      // Draw center-cropped square from video, scaled to 512x512
      context.drawImage(video, sx, sy, minDimension, minDimension, 0, 0, targetSize, targetSize);

      // Convert canvas to blob
      const blob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob((b) => {
          if (b) resolve(b);
          else reject(new Error('Failed to create image blob'));
        }, 'image/png');
      });

      // Stop camera stream
      if (streamRef.current) {
        console.log('Stopping camera stream after picture taken');
        streamRef.current.getTracks().forEach((track) => {
          track.stop();
        });
        streamRef.current = null;
      }
      setCameraEnabled(false);

      // Upload to Supabase Storage
      console.log('Uploading picture:', pictureId);
      await uploadAvatarImage(pictureId, blob);

      // Get auth session for API call
      const supabase = getSupabaseClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        throw new Error('Not authenticated');
      }

      // Call the update-avatar API
      console.log('Calling update-avatar API for session:', sessionId);
      const response = await fetch('/api/update-avatar', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          session_id: sessionId,
          picture_id: pictureId,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to update avatar');
      }

      console.log('Avatar update initiated:', data);

      // Navigate back to dashboard
      router.push('/');
    } catch (err) {
      console.error('Error updating avatar:', err);
      setError(err instanceof Error ? err.message : 'Failed to update avatar');
      setIsProcessing(false);
    }
  };

  return (
    <section className="bg-background fixed inset-0 mx-auto flex h-svh flex-col items-center justify-center text-center">
      {/* Back button */}
      <Button
        variant="ghost"
        size="sm"
        className="absolute top-4 left-4"
        onClick={() => router.push('/')}
        disabled={isProcessing}
      >
        <ArrowLeft size={20} className="mr-2" />
        Back to Dashboard
      </Button>

      <h1 className="text-2xl font-semibold mb-4">Update Your Avatar</h1>

      {/* Video preview - 512x512 pixel square tile */}
      <div className="mb-6 relative">
        <div className="relative w-[512px] h-[512px]">
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="w-[512px] h-[512px] bg-gray-200 rounded-lg object-cover"
            style={{ display: cameraEnabled && !isProcessing ? 'block' : 'none' }}
          />
          <canvas ref={canvasRef} className="hidden" />
          {!cameraEnabled && !isProcessing && (
            <div className="absolute inset-0 w-[512px] h-[512px] bg-gray-200 rounded-lg flex items-center justify-center">
              <div className="text-center">
                <p className="text-gray-500 mb-2">{cameraError || 'Loading camera...'}</p>
                {cameraError && (
                  <button
                    onClick={() => window.location.reload()}
                    className="text-blue-500 hover:text-blue-700 underline text-sm"
                  >
                    Retry
                  </button>
                )}
              </div>
            </div>
          )}
          {isProcessing && (
            <div className="absolute inset-0 w-[512px] h-[512px] bg-gray-200 rounded-lg flex items-center justify-center">
              <div className="text-center">
                <CircleNotch size={48} className="animate-spin text-muted-foreground mx-auto mb-4" />
                <p className="text-gray-500">Processing your new avatar...</p>
                <p className="text-sm text-muted-foreground mt-2">This may take a moment</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {error && <p className="text-destructive mb-4">{error}</p>}

      {!isProcessing && (
        <p className="text-fg1 max-w-prose pt-1 leading-6 font-medium">
          Take a new picture to update your avatar.
          <br />
          Make sure your camera is enabled, then click &apos;Take Picture&apos;.
        </p>
      )}

      <Button
        variant="primary"
        size="lg"
        onClick={takePictureAndSubmit}
        className="mt-6 w-64 font-mono"
        disabled={!cameraEnabled || isProcessing}
      >
        {isProcessing ? (
          <>
            <CircleNotch size={20} className="mr-2 animate-spin" />
            Processing...
          </>
        ) : (
          'Take Picture'
        )}
      </Button>
    </section>
  );
}

