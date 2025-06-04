import { useCallback, useEffect, useRef } from 'react';
import {
  DrawingUtils,
  GestureRecognizer,
} from '@mediapipe/tasks-vision';

import { EMASmoother } from './components/EMASmoother.ts';
import ReactMap from './components/ReactMap.tsx';
import CameraView from './components/Camera.tsx';
import type { MapRef } from 'react-map-gl/mapbox';
import { useMediaPipe } from './hooks/useMediaPipe';

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

  // Use the custom hook for MediaPipe initialization
  const { gestureRecognizerRef, drawingUtilsRef, isMediaPipeLoaded } = useMediaPipe({ canvasRef });

  // Gesture tracking refs
  const landmarkSmootherRef = useRef<EMASmoother[][]>([]); // Array of arrays for multi-hand smoothing

  /**
   * Handles successful map load
   */
  const handleMapLoad = useCallback(() => {
    console.log('Map loaded successfully.');
  }, []);


  const predictWebcamLoop = useCallback(() => {
    if (
      !gestureRecognizerRef.current ||
      !drawingUtilsRef.current ||
      !videoRef.current?.currentTime ||
      !canvasRef.current
    ) {
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
        videoRef.current,
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

      if (results?.landmarks?.length > 0 && landmarkSmootherRef.current.length > 0) {
        const allHandsSmoothed = results.landmarks.map((handLandmarks, handIndex) => {
          if (handIndex >= MAX_SUPPORTED_HANDS) {
            return handLandmarks; // Safety: Should not exceed configured numHands
          }
          const handSpecificSmoothers = landmarkSmootherRef.current[handIndex];
          if (!handSpecificSmoothers) {
            return handLandmarks; // Safety: Smoother array for this hand doesn't exist
          }
          return handLandmarks.map((lm, landmarkIdx) =>
            handSpecificSmoothers[landmarkIdx]?.smoothLandmark(lm) || lm,
          );
        });

        allHandsSmoothed.forEach((singleHandSmoothedLandmarks) => {
          drawingUtilsRef.current!.drawConnectors(
            singleHandSmoothedLandmarks,
            GestureRecognizer.HAND_CONNECTIONS,
            { color: '#FFFFFF', lineWidth: 3 }, // White connectors
          );
          drawingUtilsRef.current!.drawLandmarks(singleHandSmoothedLandmarks, {
            color: '#FF9800', // Orange landmarks
            fillColor: '#FF9800',
            lineWidth: 1,
            radius: (data: any) => {
              // Adjust landmark size based on Z-depth
              return DrawingUtils.lerp(data.from!.z!, -0.15, 0.1, 5, 1);
            },
          });
        });
      }
      canvasCtx.restore();
    } catch (err) {
      console.error('Error in prediction loop:', err);
    }

    requestRef.current = requestAnimationFrame(predictWebcamLoop);
  }, [mapRef, videoRef, canvasRef, gestureRecognizerRef, drawingUtilsRef, landmarkSmootherRef]);

  /**
   * Sets up the webcam stream and starts the prediction loop
   */
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

          // Initialize smoothers for each potential hand and each landmark
          landmarkSmootherRef.current = Array(MAX_SUPPORTED_HANDS)
            .fill(null)
            .map(() => // For each hand
              Array(21).fill(null)
              .map(() => new EMASmoother(0.5)),
            );

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
    if (!isMediaPipeLoaded) {
      console.log(
        'useEffect: MediaPipe not loaded yet, skipping webcam setup.',
      );
      return;
    }

    console.log('useEffect: Webcam setup initiated as MediaPipe is loaded.');
    setupWebcam().catch(console.error);

    return () => {
      if (requestRef.current) {
        cancelAnimationFrame(requestRef.current);
      }
      if (videoRef.current?.srcObject) {
        const stream = videoRef.current.srcObject as MediaStream;
        stream.getTracks().forEach((track) => track.stop());
      }
    };
  }, [isMediaPipeLoaded, setupWebcam]);

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
