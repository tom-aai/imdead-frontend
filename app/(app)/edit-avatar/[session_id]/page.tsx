'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { CircleNotch } from '@phosphor-icons/react';
import { HamburgerMenu } from '@/components/hamburger-menu';
import { Button } from '@/components/ui/button';
import { checkIsAdmin, getSupabaseClient, uploadAvatarImage } from '@/lib/supabase';

export default function EditAvatarPage() {
  const router = useRouter();
  const params = useParams();
  const sessionId = params.session_id as string;

  const [cameraEnabled, setCameraEnabled] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingStatus, setProcessingStatus] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Check if user is admin on mount
  useEffect(() => {
    const checkAdmin = async () => {
      try {
        const admin = await checkIsAdmin();
        setIsAdmin(admin);
      } catch (error) {
        console.error('Error checking admin status:', error);
        setIsAdmin(false);
      }
    };
    checkAdmin();
  }, []);

  // Poll for job completion
  const pollJobStatus = useCallback(async (jobId: string, accessToken: string) => {
    const maxAttempts = 60; // 5 minutes max (60 * 5 seconds)
    let attempts = 0;

    const poll = async (): Promise<boolean> => {
      attempts++;

      try {
        const response = await fetch(`/api/jobs/${jobId}`, {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        });

        if (!response.ok) {
          throw new Error('Failed to get job status');
        }

        const data = await response.json();
        console.log('[EditAvatar] Job status:', data.status);

        if (data.status === 'completed') {
          setProcessingStatus('Avatar image updated successfully!');
          return true;
        } else if (data.status === 'failed') {
          throw new Error(data.error || 'Avatar image update failed');
        } else if (attempts >= maxAttempts) {
          throw new Error('Avatar image update timed out. Please try again.');
        } else {
          // Still processing, update status and poll again
          setProcessingStatus(
            `Processing your new avatar image... (${Math.floor((attempts * 5) / 60)}m ${(attempts * 5) % 60}s)`
          );
          await new Promise((resolve) => setTimeout(resolve, 5000));
          return poll();
        }
      } catch (err) {
        console.error('[EditAvatar] Poll error:', err);
        throw err;
      }
    };

    return poll();
  }, []);

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

  // Common function to process and submit an image blob
  const processAndSubmitImage = useCallback(
    async (blob: Blob) => {
      setIsProcessing(true);
      setError(null);

      try {
        // Generate a unique ID for this picture
        const pictureId = crypto.randomUUID();
        console.log('Generated new picture ID:', pictureId);

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
        // The picture_id needs to include the full path as stored in Supabase: {userId}/{uuid}.png
        const userId = session.user.id;
        const fullPictureId = `${userId}/${pictureId}.png`;

        setProcessingStatus('Starting avatar image update...');

        console.log(
          'Calling update-avatar API for session:',
          sessionId,
          'with picture:',
          fullPictureId
        );
        const response = await fetch('/api/update-avatar', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            session_id: sessionId,
            picture_id: fullPictureId,
          }),
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || 'Failed to update avatar image');
        }

        console.log('Avatar update initiated:', data);

        // Poll for job completion if job_id is returned
        if (data.job_id) {
          setProcessingStatus('Processing your new avatar image...');
          await pollJobStatus(data.job_id, session.access_token);
        }

        // Navigate back to dashboard after job completes
        router.push('/dashboard');
      } catch (err) {
        console.error('Error updating avatar:', err);
        setError(err instanceof Error ? err.message : 'Failed to update avatar image');
        setIsProcessing(false);
      }
    },
    [sessionId, pollJobStatus, router]
  );

  const takePictureAndSubmit = async () => {
    if (!videoRef.current || !canvasRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const context = canvas.getContext('2d');

    if (!context || video.videoWidth === 0 || video.videoHeight === 0) return;

    try {
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

      // Process and submit the image
      await processAndSubmitImage(blob);
    } catch (err) {
      console.error('Error taking picture:', err);
      setError(err instanceof Error ? err.message : 'Failed to take picture');
      setIsProcessing(false);
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      // Load the image file
      const image = new Image();
      const imageUrl = URL.createObjectURL(file);

      await new Promise<void>((resolve, reject) => {
        image.onload = () => {
          URL.revokeObjectURL(imageUrl);
          resolve();
        };
        image.onerror = () => {
          URL.revokeObjectURL(imageUrl);
          reject(new Error('Failed to load image'));
        };
        image.src = imageUrl;
      });

      // Create a canvas to process the image
      const canvas = document.createElement('canvas');
      const context = canvas.getContext('2d');
      if (!context) {
        throw new Error('Failed to get canvas context');
      }

      // Set canvas to 512x512 for the output image
      const targetSize = 512;
      canvas.width = targetSize;
      canvas.height = targetSize;

      // Calculate center crop from the image
      const imageWidth = image.width;
      const imageHeight = image.height;
      const minDimension = Math.min(imageWidth, imageHeight);
      const sx = (imageWidth - minDimension) / 2;
      const sy = (imageHeight - minDimension) / 2;

      // Draw center-cropped square from image, scaled to 512x512
      context.drawImage(image, sx, sy, minDimension, minDimension, 0, 0, targetSize, targetSize);

      // Convert canvas to blob
      const blob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob((b) => {
          if (b) resolve(b);
          else reject(new Error('Failed to create image blob'));
        }, 'image/png');
      });

      // Process and submit the image
      await processAndSubmitImage(blob);
    } catch (err) {
      console.error('Error processing uploaded file:', err);
      setError(err instanceof Error ? err.message : 'Failed to process uploaded image');
      setIsProcessing(false);
    } finally {
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  return (
    <section className="bg-background fixed inset-0 mx-auto flex h-svh flex-col items-center justify-center text-center">
      <HamburgerMenu />

      <h1 className="mb-4 text-2xl font-semibold">Update Avatar Image</h1>

      {/* Video preview - 512x512 pixel square tile */}
      <div className="relative mb-6">
        <div className="relative h-[512px] w-[512px]">
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="h-[512px] w-[512px] -scale-x-100 rounded-lg bg-gray-200 object-cover"
            style={{ display: cameraEnabled && !isProcessing ? 'block' : 'none' }}
          />
          <canvas ref={canvasRef} className="hidden" />
          {!cameraEnabled && !isProcessing && (
            <div className="absolute inset-0 flex h-[512px] w-[512px] items-center justify-center rounded-lg bg-gray-200">
              <div className="text-center">
                <p className="mb-2 text-gray-500">{cameraError || 'Loading camera...'}</p>
                {cameraError && (
                  <button
                    onClick={() => window.location.reload()}
                    className="text-sm text-blue-500 underline hover:text-blue-700"
                  >
                    Retry
                  </button>
                )}
              </div>
            </div>
          )}
          {isProcessing && (
            <div className="absolute inset-0 flex h-[512px] w-[512px] items-center justify-center rounded-lg bg-gray-200">
              <div className="text-center">
                <CircleNotch
                  size={48}
                  className="text-muted-foreground mx-auto mb-4 animate-spin"
                />
                <p className="text-gray-500">
                  {processingStatus || 'Processing your new avatar image...'}
                </p>
                <p className="text-muted-foreground mt-2 text-sm">This may take a few minutes</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {error && <p className="text-destructive mb-4">{error}</p>}

      {!isProcessing && (
        <p className="text-fg1 max-w-prose pt-1 leading-6 font-medium">
          Take a new picture to update your avatar image.
          <br />
          Make sure your camera is enabled, then click &apos;Take Picture&apos;.
        </p>
      )}

      <div className="mt-6 flex flex-col items-center gap-4">
        <Button
          variant="primary"
          size="lg"
          onClick={takePictureAndSubmit}
          className="w-64 font-mono"
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

        {isAdmin && (
          <>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleFileUpload}
              className="hidden"
              disabled={isProcessing}
            />
            <Button
              variant="outline"
              size="lg"
              onClick={() => fileInputRef.current?.click()}
              className="w-64 font-mono"
              disabled={isProcessing}
            >
              Upload Image
            </Button>
          </>
        )}
      </div>
    </section>
  );
}
