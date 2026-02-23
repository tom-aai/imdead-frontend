import { useEffect, useRef, useState } from 'react';
import { HamburgerMenu } from '@/components/hamburger-menu';
import { Button } from '@/components/ui/button';
import { uploadAvatarImage } from '@/lib/supabase';
import { cn } from '@/lib/utils';

interface WelcomeProps {
  disabled: boolean;
  startButtonText: string;
  onStartCall: (pictureId: string) => void;
}

export const Welcome = ({
  disabled,
  startButtonText,
  onStartCall,
  ref,
}: React.ComponentProps<'div'> & WelcomeProps) => {
  const [hasTakenPicture, setHasTakenPicture] = useState(false);
  const [cameraEnabled, setCameraEnabled] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [pictureId, setPictureId] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const prevDisabledRef = useRef(disabled);

  // Log when component mounts
  useEffect(() => {
    console.log('Welcome component mounted/remounted');
    return () => {
      console.log('Welcome component unmounting');
    };
  }, []);

  // Reset picture state when component becomes enabled (visible) again after being disabled
  useEffect(() => {
    const wasDisabled = prevDisabledRef.current;
    const isNowEnabled = !disabled;

    if (wasDisabled && isNowEnabled) {
      console.log(
        'Welcome component transitioned from disabled to enabled - resetting picture state'
      );
      setHasTakenPicture(false);
      setPictureId(null);
    }

    prevDisabledRef.current = disabled;
  }, [disabled]);

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

            videoRef.current.oncanplay = () => {
              // Video ready
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

  const takePicture = async () => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      const context = canvas.getContext('2d');

      if (context && video.videoWidth > 0 && video.videoHeight > 0) {
        // Generate a unique ID for this picture
        const newPictureId = crypto.randomUUID();
        console.log('Generated new picture ID:', newPictureId);
        setPictureId(newPictureId);

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

        canvas.toBlob(async (blob) => {
          if (blob) {
            try {
              // Upload to Supabase Storage
              console.log('Uploading picture:', newPictureId);
              await uploadAvatarImage(newPictureId, blob);

              // Stop camera stream after taking picture - we don't need it during the call
              if (streamRef.current) {
                console.log('Stopping camera stream after picture taken');
                streamRef.current.getTracks().forEach((track) => {
                  track.stop();
                });
                streamRef.current = null;
              }

              setHasTakenPicture(true);
              setCameraEnabled(false);

              // Automatically start the call after uploading the picture
              console.log('Calling onStartCall with picture ID:', newPictureId);
              onStartCall(newPictureId);
            } catch (error) {
              console.error('Failed to upload avatar image:', error);
              // You might want to show an error message to the user here
            }
          }
        }, 'image/png');
      }
    }
  };

  const handleButtonClick = () => {
    console.log('Button clicked. hasTakenPicture:', hasTakenPicture, 'pictureId:', pictureId);
    if (!hasTakenPicture) {
      console.log('Taking new picture...');
      takePicture();
    } else if (pictureId) {
      console.log('Starting call with existing picture ID:', pictureId);
      onStartCall(pictureId);
    }
  };

  const buttonText = hasTakenPicture ? 'Start Call' : 'Take Picture';

  return (
    <section
      ref={ref}
      inert={disabled}
      className={cn(
        'bg-background fixed inset-0 mx-auto flex h-svh flex-col items-center justify-center text-center',
        disabled ? 'z-10' : 'z-20'
      )}
    >
      {!disabled && <HamburgerMenu />}

      {/* Video preview - 512x512 pixel square tile */}
      <div className="relative mb-6">
        <div className="relative h-[512px] w-[512px]">
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="h-[512px] w-[512px] -scale-x-100 rounded-lg bg-gray-200 object-cover"
            style={{ display: cameraEnabled ? 'block' : 'none' }}
          />
          <canvas ref={canvasRef} className="hidden" />
          {!cameraEnabled && (
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
        </div>
      </div>

      {!hasTakenPicture && (
        <p className="text-fg1 max-w-prose pt-1 leading-6 font-medium">
          We&apos;ll use your picture to create your avatar.
          <br />
          Make sure your camera is enabled, then click &apos;Take Picture&apos;.
        </p>
      )}
      <Button
        variant="primary"
        size="lg"
        onClick={handleButtonClick}
        className="mt-6 w-64 font-mono"
        disabled={!cameraEnabled}
      >
        {buttonText}
      </Button>
    </section>
  );
};
