'use client';

import { CircleNotch } from '@phosphor-icons/react';
import { Button } from '@/components/ui/button';
import { usePictureCapture } from '@/hooks/usePictureCapture';

interface PhotoScreenProps {
  sessionId: string;
  onCaptured: () => void;
}

export function PhotoScreen({ sessionId, onCaptured }: PhotoScreenProps) {
  // Camera capture (getUserMedia preview → 512×512 center-crop → upload) is the
  // same mechanism as the original onboarding; only the upload transport changed.
  const { videoRef, canvasRef, cameraEnabled, cameraError, isCapturing, capture } =
    usePictureCapture(true);

  const takePicture = async () => {
    const ok = await capture(sessionId);
    if (ok) {
      onCaptured();
    }
  };

  return (
    <section className="bg-background fixed inset-0 mx-auto flex h-svh flex-col items-center justify-center px-4 text-center">
      <h1 className="mb-6 text-3xl font-semibold">Take your picture</h1>

      {/* Video preview - 512x512 pixel square tile */}
      <div className="relative mb-6">
        <div className="relative h-[512px] max-h-[60vw] w-[512px] max-w-[90vw]">
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="h-full w-full -scale-x-100 rounded-lg bg-gray-200 object-cover"
            style={{ display: cameraEnabled ? 'block' : 'none' }}
          />
          <canvas ref={canvasRef} className="hidden" />
          {!cameraEnabled && (
            <div className="absolute inset-0 flex items-center justify-center rounded-lg bg-gray-200">
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

      {!isCapturing ? (
        <p className="text-fg1 max-w-prose pt-1 leading-6 font-medium">
          We&apos;ll turn your picture into your ghost.
          <br />
          Make sure your camera is enabled, then click &apos;Take Picture&apos;.
        </p>
      ) : (
        <p className="text-muted-foreground flex items-center gap-2 pt-1 font-medium">
          <CircleNotch size={18} className="animate-spin" />
          Creating your ghost...
        </p>
      )}

      <Button
        variant="primary"
        size="lg"
        onClick={takePicture}
        className="mt-6 w-64 font-mono"
        disabled={!cameraEnabled || isCapturing}
      >
        Take Picture
      </Button>
    </section>
  );
}
