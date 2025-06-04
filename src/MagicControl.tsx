import { useCallback, useEffect, useRef, useState } from 'react';
import {
  DrawingUtils,
  FilesetResolver,
  GestureRecognizer,
  type NormalizedLandmark,
} from '@mediapipe/tasks-vision';

import { EMASmoother } from './components/EMASmoother.ts';
import ReactMap from './components/ReactMap.tsx';
import CameraView from './components/Camera.tsx';
import type { MapRef } from 'react-map-gl/mapbox';

const MEDIAPIPE_GESTURE_MODEL_PATH: string =
  'https://storage.googleapis.com/mediapipe-models/gesture_recognizer/gesture_recognizer/float16/1/gesture_recognizer.task';

/**
 * Main component for hand gesture control of the map
 */
function MagicControl() {
  // Refs
  const mapComponentContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapRef | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gestureRecognizerRef = useRef<GestureRecognizer | null>(null);
  const drawingUtilsRef = useRef<DrawingUtils | null>(null);
  const requestRef = useRef<number | null>(null);

  // State
  const [gestureRecognizerLoaded, setGestureRecognizerLoaded] = useState<boolean>(false);

  // Gesture tracking refs
  const landmarkSmootherRef = useRef<EMASmoother[]>([]);

  /**
   * Handles successful map load
   */
  const handleMapLoad = useCallback(() => {
    console.log('Map loaded successfully.');
  }, []);

  /**
   * Initializes MediaPipe hand gesture recognition
   */
  const initializeMediaPipe = useCallback(async () => {
    console.log('Initializing MediaPipe...');
    try {
      const vision = await FilesetResolver.forVisionTasks(
        'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.3/wasm',
      );
      gestureRecognizerRef.current = await GestureRecognizer.createFromOptions(
        vision,
        {
          baseOptions: {
            modelAssetPath: MEDIAPIPE_GESTURE_MODEL_PATH,
            delegate: 'GPU',
          },
          runningMode: 'VIDEO',
          numHands: 2,
        },
      );
      drawingUtilsRef.current = new DrawingUtils(
        canvasRef.current?.getContext('2d') as CanvasRenderingContext2D,
      );
      console.log('MediaPipe Initialized.');
      setGestureRecognizerLoaded(true);
    } catch (error) {
      console.error('Failed to initialize MediaPipe:', error);
    }
  }, [setGestureRecognizerLoaded]);

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

          landmarkSmootherRef.current = Array(21)
            .fill(null)
            // .map(() => new EMASmoother(0.2, 0.2, 0.2, 10));

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
  }, [videoRef, canvasRef, landmarkSmootherRef]);

  const predictWebcamLoop = useCallback(() => {
    if (
      !gestureRecognizerRef.current ||
      !videoRef.current ||
      videoRef.current.readyState < HTMLMediaElement.HAVE_METADATA
    ) {
      requestRef.current = requestAnimationFrame(predictWebcamLoop);
      return;
    }

    const mapInstance = mapRef.current?.getMap();
    if (!mapInstance) {
      requestRef.current = requestAnimationFrame(predictWebcamLoop);
      return;
    }

    try {
      const startTimeMs = performance.now();
      const results = gestureRecognizerRef.current?.recognizeForVideo(
        videoRef.current,
        startTimeMs,
      );

      const canvasCtx = canvasRef.current?.getContext('2d');

      if (canvasCtx && canvasRef.current && videoRef.current) {
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

        if (results?.landmarks?.length > 0) {
          const allHands = results.landmarks.map((handLandmarks) =>
            handLandmarks.map(
              (lm, idx) =>
                landmarkSmootherRef.current[idx]?.smoothLandmark(lm) || lm,
            ),
          );

          if (drawingUtilsRef.current) {
            allHands.forEach((handLandmarks) => {
              drawingUtilsRef.current.drawConnectors(
                handLandmarks,
                GestureRecognizer.HAND_CONNECTIONS,
                { color: '#00FF00', lineWidth: 2 },
              );
              drawingUtilsRef.current.drawLandmarks(handLandmarks, {
                color: '#FF0000',
                lineWidth: 1,
                radius: 3,
              });
            });
          }
        }
        canvasCtx.restore();
      }
    } catch (err) {
      console.error('Error in prediction loop:', err);
    }

    requestRef.current = requestAnimationFrame(predictWebcamLoop);
  }, [mapRef, videoRef, canvasRef, gestureRecognizerRef, drawingUtilsRef, landmarkSmootherRef]);

  useEffect(() => {
    initializeMediaPipe();

    if (!gestureRecognizerLoaded) {
      console.log(
        'useEffect: gesture recognizer not loaded yet, skipping webcam setup.',
      );
      return;
    }

    console.log('useEffect: Webcam setup initiated as gesture recognizer is loaded.');
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
  }, [gestureRecognizerLoaded, initializeMediaPipe, setupWebcam]);

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
