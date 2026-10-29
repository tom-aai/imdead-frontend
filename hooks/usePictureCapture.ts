import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Webcam-capture logic for the "I'm Dead" photo screen.
 *
 * Owns the getUserMedia lifecycle, a hidden canvas for the 512×512 center-crop,
 * and camera/upload error state. The canvas capture mechanics are copied verbatim
 * from the original Expert Avatar onboarding; only the transport changed: instead
 * of uploading straight to Supabase Storage, `capture()` POSTs the PNG to the local
 * backend (`/api/upload-image`) as multipart (`file` + `session_id`), which stores
 * the original and runs the Gemini ghost transform inline.
 */
export interface UsePictureCaptureResult {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  cameraEnabled: boolean;
  cameraError: string | null;
  isCapturing: boolean;
  /** Take + upload a picture for the given session. Resolves true on success. */
  capture: (sessionId: string) => Promise<boolean>;
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

  const capture = useCallback(
    async (sessionId: string): Promise<boolean> => {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      if (!video || !canvas) return false;

      const context = canvas.getContext('2d');
      if (!context || video.videoWidth === 0 || video.videoHeight === 0) return false;

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
        return false;
      }

      setIsCapturing(true);
      try {
        // Mirror the old upload-avatar multipart shape: `file` + `session_id`.
        const formData = new FormData();
        formData.append('file', blob, 'photo.png');
        formData.append('session_id', sessionId);

        const response = await fetch('/api/upload-image', {
          method: 'POST',
          body: formData,
        });

        if (!response.ok) {
          const data = await response.json().catch(() => ({}));
          throw new Error(data.error || 'Failed to upload image');
        }

        // We no longer need the camera once the picture is uploaded.
        stopCamera();
        setCameraEnabled(false);
        return true;
      } catch (error) {
        console.error('Failed to upload image:', error);
        setCameraError('Failed to upload your picture. Please try again.');
        return false;
      } finally {
        setIsCapturing(false);
      }
    },
    [stopCamera]
  );

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
