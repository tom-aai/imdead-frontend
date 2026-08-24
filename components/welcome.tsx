import { useEffect, useRef, useState } from 'react';
import { HamburgerMenu } from '@/components/hamburger-menu';
import { Button } from '@/components/ui/button';
import { usePictureCapture } from '@/hooks/usePictureCapture';
import { cn } from '@/lib/utils';

interface WelcomeProps {
  disabled: boolean;
  startButtonText: string;
  onStartCall: (pictureId: string) => void;
}

export const Welcome = ({
  disabled,
  onStartCall,
  ref,
}: React.ComponentProps<'div'> & WelcomeProps) => {
  const [hasTakenPicture, setHasTakenPicture] = useState(false);
  const [pictureId, setPictureId] = useState<string | null>(null);
  const prevDisabledRef = useRef(disabled);

  // Camera capture (getUserMedia preview → 512×512 center-crop → upload) is
  // shared with the blog-upload flow via usePictureCapture. Run it only while
  // the onboarding screen is visible.
  const { videoRef, canvasRef, cameraEnabled, cameraError, isCapturing, capture } =
    usePictureCapture(!disabled);

  // Reset picture state when the screen becomes visible again after being
  // hidden (e.g. a session ended), so the camera restarts for a fresh capture.
  useEffect(() => {
    const wasDisabled = prevDisabledRef.current;
    const isNowEnabled = !disabled;

    if (wasDisabled && isNowEnabled) {
      setHasTakenPicture(false);
      setPictureId(null);
    }

    prevDisabledRef.current = disabled;
  }, [disabled]);

  const takePicture = async () => {
    const newPictureId = await capture();
    if (newPictureId) {
      setPictureId(newPictureId);
      setHasTakenPicture(true);
      // Automatically start the call after uploading the picture.
      onStartCall(newPictureId);
    }
  };

  const handleButtonClick = () => {
    if (!hasTakenPicture) {
      takePicture();
    } else if (pictureId) {
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
        disabled={!cameraEnabled || isCapturing}
      >
        {buttonText}
      </Button>
    </section>
  );
};
