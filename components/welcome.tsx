import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface WelcomeProps {
  disabled: boolean;
  startButtonText: string;
  onStartCall: () => void;
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

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    const enableCamera = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ 
          video: { 
            width: { ideal: 640 },
            height: { ideal: 480 },
            facingMode: 'user'
          },
          audio: false
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
        streamRef.current.getTracks().forEach(track => {
          track.stop();
        });
        streamRef.current = null;
      }
    };
  }, []);

  const takePicture = () => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      const context = canvas.getContext('2d');
      
      if (context && video.videoWidth > 0 && video.videoHeight > 0) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        context.drawImage(video, 0, 0);
        
        canvas.toBlob((blob) => {
          if (blob) {
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = 'avatar-picture.png';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
            
            setHasTakenPicture(true);
          }
        }, 'image/png');
      }
    }
  };

  const handleButtonClick = () => {
    if (!hasTakenPicture) {
      takePicture();
    } else {
      onStartCall();
    }
  };

  const buttonText = hasTakenPicture ? 'Start Call' : 'Take Picture';
  const welcomeText = hasTakenPicture 
    ? 'Great! Your avatar picture has been saved. Ready to start your call?'
    : 'Welcome to Expert Avatar. Let\'s start by creating your avatar. Look at your camera, smile softly, pretend like you\'re about to join a video conference with an old friend, and click \'Take Picture\'.';

  return (
    <section
      ref={ref}
      inert={disabled}
      className={cn(
        'bg-background fixed inset-0 mx-auto flex h-svh flex-col items-center justify-center text-center',
        disabled ? 'z-10' : 'z-20'
      )}
    >
      {/* Video preview */}
      <div className="mb-6 relative">
        <div className="relative">
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="w-96 h-72 bg-gray-200 rounded-lg object-cover"
            style={{ display: cameraEnabled ? 'block' : 'none' }}
          />
          <canvas
            ref={canvasRef}
            className="hidden"
          />
          {!cameraEnabled && (
            <div className="absolute inset-0 bg-gray-200 rounded-lg flex items-center justify-center">
              <div className="text-center">
                <p className="text-gray-500 mb-2">
                  {cameraError || 'Loading camera...'}
                </p>
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
        </div>
      </div>

      <p className="text-fg1 max-w-prose pt-1 leading-6 font-medium">
        {welcomeText}
      </p>
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
