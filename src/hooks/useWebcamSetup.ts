import { useCallback, useEffect, useState } from 'react';

interface UseWebcamSetupProps {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  isReady: boolean;
}

export function useWebcamSetup({
  videoRef,
  canvasRef,
  isReady,
}: UseWebcamSetupProps) {
  const [isWebcamReady, setIsWebcamReady] = useState(false);
  const setupWebcam = useCallback(async () => {
    if (!videoRef.current) {
      console.error('Video ref not available');
      return;
    }
    const constraints = { video: true };
    try {
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      videoRef.current.srcObject = stream;
      videoRef.current.onloadedmetadata = () => {
        if (videoRef.current) {
          videoRef.current.play();
          
          if (canvasRef.current) {
            canvasRef.current.width = videoRef.current.videoWidth;
            canvasRef.current.height = videoRef.current.videoHeight;
          }
        
          setIsWebcamReady(true);
        }
      };
      videoRef.current.onerror = () => {
        console.error('Webcam access error.');
        setIsWebcamReady(false);
      };
    } catch (error) {
      console.error('Error setting up webcam:', error);
      setIsWebcamReady(false);
    }
  }, [videoRef, canvasRef]);

  useEffect(() => {
    if (isReady) {
      console.log('Webcam setup complete. Starting webcam...');
      setupWebcam().catch(console.error);
    }
    return () => {
      const videoElement = videoRef.current;
      if (videoElement && videoElement.srcObject) {
        const stream = videoElement.srcObject as MediaStream;
        stream.getTracks().forEach((track) => track.stop());
      }
      setIsWebcamReady(false);
    };
  }, [isReady, setupWebcam, videoRef]);

  return { isWebcamReady };
}