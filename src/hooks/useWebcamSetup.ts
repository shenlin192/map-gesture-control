import { useCallback, useEffect } from 'react';
import type { EMASmoother } from '../components/EMASmoother';
import { initializeEmaSmoothersForHands } from '../utils/handTrackingUtils';

interface UseWebcamSetupProps {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  landmarkSmootherRef: { current: EMASmoother[][] };
  requestRef: { current: number | null };
  predictWebcamLoop: () => void;
  isReady: boolean;
  maxSupportedHands: number;
}

export function useWebcamSetup({
  videoRef,
  canvasRef,
  landmarkSmootherRef,
  requestRef,
  predictWebcamLoop,
  isReady,
  maxSupportedHands,
}: UseWebcamSetupProps) {
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
        
          landmarkSmootherRef.current = initializeEmaSmoothersForHands(maxSupportedHands, 0.5);
          requestRef.current = requestAnimationFrame(predictWebcamLoop);
        }
      };
      videoRef.current.onerror = () => {
        console.error('Webcam access error.');
      };
    } catch (error) {
      console.error('Error setting up webcam:', error);
    }
  }, [videoRef, canvasRef, landmarkSmootherRef, predictWebcamLoop, maxSupportedHands]);

  useEffect(() => {
    if (isReady) {
      console.log('Webcam setup complete. Starting prediction loop...');
      setupWebcam().catch(console.error);
    }
    return () => {
      if (requestRef.current) {
        cancelAnimationFrame(requestRef.current);
      }
      const videoElement = videoRef.current;
      if (videoElement && videoElement.srcObject) {
        const stream = videoElement.srcObject as MediaStream;
        stream.getTracks().forEach((track) => track.stop());
      }
    };
  }, [isReady, setupWebcam, requestRef, videoRef]);
}