import { useCallback, useEffect, useRef, useState } from 'react';
import { uploadAvatarImage } from '@/lib/supabase';

/**
 * Shared webcam-capture logic used by both onboarding (components/welcome.tsx)
 * and the blog-upload flow (components/picture-capture-modal.tsx).
 *
 * Owns the getUserMedia lifecycle, a hidden canvas for the 512×512 center-crop,
 * upload to `avatar-images-bucket` (via uploadAvatarImage), and camera/upload
 * error state. `capture()` returns the bare picture UUID on success so the
 * caller can thread it onward exactly as onboarding does.
 */
export interface UsePictureCaptureResult {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  cameraEnabled: boolean;
  cameraError: string | null;
  isCapturing: boolean;
  /** Take + upload a picture. Resolves to the bare picture UUID, or null on failure. */
  capture: () => Promise<string | null>;
  /** Stop the camera stream (idempotent). */
  stopCamera: () => void;
}

/**
 * @param active Whether the camera should be running. When it flips to true the
 *   hook requests the webcam; when false (or on unmount) it releases the stream.
 */
export function usePictureCapture(active: boolean): UsePictureCaptureResult {
  const [cameraEnabled, setCameraEnabled] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [isCapturing, setIsCapturing] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (!active) return;

    let cancelled = false;

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

        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }

        streamRef.current = stream;

        const waitForVideoElement = () => {
          if (cancelled) return;
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
      cancelled = true;
      clearTimeout(timer);
      stopCamera();
      setCameraEnabled(false);
    };
  }, [active, stopCamera]);

  const capture = useCallback(async (): Promise<string | null> => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return null;

    const context = canvas.getContext('2d');
    if (!context || video.videoWidth === 0 || video.videoHeight === 0) return null;

    // Generate a bare UUID for this picture (onboarding convention — see D4).
    const newPictureId = crypto.randomUUID();

    // Output image is a 512×512 center-cropped square.
    const targetSize = 512;
    canvas.width = targetSize;
    canvas.height = targetSize;

    const videoWidth = video.videoWidth;
    const videoHeight = video.videoHeight;
    const minDimension = Math.min(videoWidth, videoHeight);
    const sx = (videoWidth - minDimension) / 2;
    const sy = (videoHeight - minDimension) / 2;
    context.drawImage(video, sx, sy, minDimension, minDimension, 0, 0, targetSize, targetSize);

    const blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob((b) => resolve(b), 'image/png');
    });

    if (!blob) {
      setCameraError('Failed to capture image. Please try again.');
      return null;
    }

    setIsCapturing(true);
    try {
      await uploadAvatarImage(newPictureId, blob);
      // We no longer need the camera once the picture is uploaded.
      stopCamera();
      setCameraEnabled(false);
      return newPictureId;
    } catch (error) {
      console.error('Failed to upload avatar image:', error);
      setCameraError('Failed to upload your picture. Please try again.');
      return null;
    } finally {
      setIsCapturing(false);
    }
  }, [stopCamera]);

  return {
    videoRef,
    canvasRef,
    cameraEnabled,
    cameraError,
    isCapturing,
    capture,
    stopCamera,
  };
}
