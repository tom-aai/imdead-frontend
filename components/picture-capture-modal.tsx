'use client';

import { CircleNotch } from '@phosphor-icons/react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { usePictureCapture } from '@/hooks/usePictureCapture';

interface PictureCaptureModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Called with the bare picture UUID after a successful capture + upload. */
  onCaptured: (pictureId: string) => void;
}

/**
 * Webcam capture step that gates the blog-upload text modal (D1/D2). Shares the
 * getUserMedia → 512×512 center-crop → upload logic with onboarding via
 * usePictureCapture, then hands the captured picture id to `onCaptured`.
 */
export const PictureCaptureModal = ({
  open,
  onOpenChange,
  onCaptured,
}: PictureCaptureModalProps) => {
  const { videoRef, canvasRef, cameraEnabled, cameraError, isCapturing, capture } =
    usePictureCapture(open);

  const handleTakePicture = async () => {
    const pictureId = await capture();
    if (pictureId) {
      onCaptured(pictureId);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (isCapturing) return;
        onOpenChange(next);
      }}
    >
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Take a Picture</DialogTitle>
          <DialogDescription>
            We&apos;ll use your picture to create the avatar for this post. Make sure your camera is
            enabled, then click &apos;Take Picture&apos;.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col items-center">
          <div className="relative aspect-square w-full max-w-[512px]">
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
                <p className="px-4 text-center text-gray-500">
                  {cameraError || 'Loading camera...'}
                </p>
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isCapturing}>
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={handleTakePicture}
            disabled={!cameraEnabled || isCapturing}
          >
            {isCapturing ? (
              <>
                <CircleNotch size={16} className="mr-2 animate-spin" />
                Uploading...
              </>
            ) : (
              'Take Picture'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
