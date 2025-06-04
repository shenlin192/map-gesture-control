import { useCallback, useEffect, useRef } from 'react';
import { EMASmoother } from './components/EMASmoother.ts';
import ReactMap from './components/ReactMap.tsx';
import CameraView from './components/Camera.tsx';
import type { MapRef } from 'react-map-gl/mapbox';
import { useMediaPipe } from './hooks/useMediaPipe';
import { useCanvasSetup } from './hooks/useCanvasSetup';
import {
  initializeEmaSmoothersForHands,
  getSmoothedLandmarksForFrame,
  drawHandsOnCanvas,
} from './utils/handTrackingUtils';

const MAX_SUPPORTED_HANDS = 2; // Max number of hands MediaPipe is configured for

/**
 * Main component for hand gesture control of the map
 */
function MagicControl() {
  // Refs
  const mapComponentContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapRef | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const requestRef = useRef<number | null>(null);
  const landmarkSmootherRef = useRef<EMASmoother[][]>([]);

  const { gestureRecognizerRef, isMediaPipeLoaded } = useMediaPipe();
  const { drawingUtilsRef } = useCanvasSetup({ canvasRef, isMediaPipeLoaded });

  const handleMapLoad = useCallback(() => {
    console.log('Map loaded successfully.');
  }, []);

  const predictWebcamLoop: () => void = useCallback(() => {
    if (
      !gestureRecognizerRef.current ||
      !drawingUtilsRef.current ||
      !videoRef.current ||
      videoRef.current.readyState < HTMLMediaElement.HAVE_METADATA || // Ensure video is ready enough
      !canvasRef.current
    ) {
      // Not ready yet, try again
      requestRef.current = requestAnimationFrame(predictWebcamLoop);
      return;
    }

    const canvasCtx = canvasRef.current?.getContext('2d');
    if (!canvasCtx) {
      requestRef.current = requestAnimationFrame(predictWebcamLoop);
      return;
    }

    try {
      const startTimeMs = performance.now();
      const results = gestureRecognizerRef.current?.recognizeForVideo(
        videoRef.current, // Already checked for null above
        startTimeMs,
      );

      canvasCtx.save();
      canvasCtx.clearRect(
        0,
        0,
        canvasRef.current.width,
        canvasRef.current.height,
      );

      if (
        videoRef.current.videoWidth > 0 &&
        videoRef.current.videoHeight > 0 &&
        (canvasRef.current.width !== videoRef.current.videoWidth ||
          canvasRef.current.height !== videoRef.current.videoHeight)
      ) {
        canvasRef.current.width = videoRef.current.videoWidth;
        canvasRef.current.height = videoRef.current.videoHeight;
      }

      if (results?.landmarks && drawingUtilsRef.current && landmarkSmootherRef.current.length > 0) {
        const smoothedLandmarks = getSmoothedLandmarksForFrame(
          results.landmarks,
          landmarkSmootherRef.current,
          MAX_SUPPORTED_HANDS
        );
        if (smoothedLandmarks.length > 0) {
          drawHandsOnCanvas(drawingUtilsRef.current, smoothedLandmarks);
        }
      }
      canvasCtx.restore();
    } catch (err) {
      console.error('Error in prediction loop:', err);
    }

    requestRef.current = requestAnimationFrame(predictWebcamLoop);
  }, [gestureRecognizerRef, drawingUtilsRef, videoRef, canvasRef, landmarkSmootherRef]);

  const setupWebcam = useCallback(async () => {
    if (!videoRef.current) {
      console.error('Video ref not available');
      return;
    }

    console.log('Setting up webcam...');

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

          landmarkSmootherRef.current = initializeEmaSmoothersForHands(MAX_SUPPORTED_HANDS, 0.5);

          console.log('Webcam ready. Starting prediction loop...');
          requestRef.current = requestAnimationFrame(predictWebcamLoop);
        }
      };
      videoRef.current.onerror = () => {
        console.error('Webcam access error.');
      };
    } catch (error) {
      console.error('Error setting up webcam:', error);
    }
  }, [videoRef, canvasRef, landmarkSmootherRef, predictWebcamLoop]);

  useEffect(() => {
    if (drawingUtilsRef.current) {
      setupWebcam().catch(console.error);
    }
    return () => {
      if (requestRef.current) {
        cancelAnimationFrame(requestRef.current);
      }
      // Stop webcam tracks when component unmounts
      const videoElement = videoRef.current;
      if (videoElement && videoElement.srcObject) {
        const stream = videoElement.srcObject as MediaStream;
        stream.getTracks().forEach((track) => track.stop());
      }
    };
  }, [drawingUtilsRef, setupWebcam]);

  return (
    <div className="w-full flex flex-col h-screen bg-gray-800 text-white items-center p-4 font-sans">
      <h1 className="text-3xl font-bold mb-4">Mapbox Hand Landmark Display</h1>
      <div className="w-full flex flex-col md:flex-row gap-4">
        <ReactMap
          containerRef={mapComponentContainerRef}
          mapRef={mapRef}
          onMapLoad={handleMapLoad}
        />
        <div className="w-full md:w-1/3 flex flex-col items-center gap-3">
          <CameraView videoRef={videoRef} canvasRef={canvasRef} />
        </div>
      </div>
    </div>
  );
}

export default MagicControl;
