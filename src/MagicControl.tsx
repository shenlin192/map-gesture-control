import { useCallback, useEffect, useRef, useState } from 'react';
import { EMASmoother } from './components/EMASmoother.ts';
import ReactMap from './components/ReactMap.tsx';
import CameraView from './components/Camera.tsx';
import PanVectorInfo from './components/PanVectorInfo.tsx';
import ZoomVectorInfo from './components/ZoomVectorInfo.tsx';
import ControlStatus from './components/ControlStatus.tsx';
import type { MapRef } from 'react-map-gl/mapbox';
import { useMediaPipe } from './hooks/useMediaPipe';
import { useCanvasSetup } from './hooks/useCanvasSetup';
import { useWebcamSetup } from './hooks/useWebcamSetup';
import { useMapControl } from './hooks/useMapControl';
import {
  getSmoothLandmarks,
  initializeEmaSmoothersForHands,
  recognizeGesturesInFrame,
} from './utils/handTrackingUtils';
import { drawDeadZone, drawLandmarksOnCanvas } from './utils/canvasUtils';
import { getControlMode, getGestureVectors } from './utils/gestureUtils';
import type { ControlMode } from './types';
import { MAX_SUPPORTED_HANDS } from './constants.ts';
import FireworksDisplay from './components/FireworksDisplay.tsx';
import type { FireworksHandlers } from '@fireworks-js/react';
import { useFireworks } from './hooks/useFireworks.ts';

function MagicControl() {
  const mapComponentContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapRef | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const requestRef = useRef<number | null>(null);
  const landmarkSmootherRef = useRef<EMASmoother[][]>([]);
  const fireworksRef = useRef<FireworksHandlers>(null);

  const [currentControlMode, setCurrentControlMode] =
    useState<ControlMode>('IDLE');
  const [panVector, setPanVector] = useState<any>(null);
  const [zoomVector, setZoomVector] = useState<any>(null);

  const controlModeHistoryRef = useRef<ControlMode[]>([]);
  const DEBOUNCE_FRAMES = 10;

  const { gestureRecognizerRef, isMediaPipeReady } = useMediaPipe();
  const { drawingUtilsRef, isDrawingUtilsReady } = useCanvasSetup({
    canvasRef,
    isReady: isMediaPipeReady,
  });
  const { isWebcamReady } = useWebcamSetup({
    videoRef,
    canvasRef,
    isReady: isDrawingUtilsReady,
  });

  useMapControl({
    mapRef,
    controlMode: currentControlMode,
    panVector,
    zoomVector,
  });

  const { startFireworks, stopFireworks } = useFireworks({
    ref: fireworksRef,
  });

  const predictWebcamLoop: () => void = useCallback(() => {
    if (
      !videoRef.current ||
      videoRef.current.readyState < HTMLMediaElement.HAVE_METADATA // Ensure video is ready enough
    ) {
      // Not ready yet, try again
      requestRef.current = requestAnimationFrame(predictWebcamLoop);
      return;
    }

    // step 1: recognize gestures in frame
    const results = recognizeGesturesInFrame(
      videoRef.current!,
      gestureRecognizerRef.current!,
    );

    // step 2: smooth landmarks
    const smoothedLandmarks = getSmoothLandmarks(
      results,
      landmarkSmootherRef.current,
      MAX_SUPPORTED_HANDS,
    );

    // step 3: draw landmarks and dead zone on canvas
    drawLandmarksOnCanvas(
      canvasRef.current!,
      videoRef.current!,
      drawingUtilsRef.current!,
      smoothedLandmarks,
    );
    drawDeadZone(canvasRef.current!);

    // step 4: detect control mode with debouncing
    const detectedMode = getControlMode(smoothedLandmarks, results);
    // const debouncedMode = getDebouncedControlMode(
    //   detectedMode,
    //   currentControlMode,
    //   controlModeHistoryRef,
    //   DEBOUNCE_FRAMES
    // );

    setCurrentControlMode(detectedMode);

    if (detectedMode === 'FIREWORKS') {
      startFireworks();
    }
    if (detectedMode !== 'IDLE' && detectedMode !== 'FIREWORKS') {
      stopFireworks();
    }

    // step 5: calculate gesture vectors using debounced mode
    const gestureVectors = getGestureVectors(detectedMode, smoothedLandmarks);
    setPanVector(gestureVectors.panVector);
    setZoomVector(gestureVectors.zoomVector);

    requestRef.current = requestAnimationFrame(predictWebcamLoop);
  }, [
    gestureRecognizerRef,
    drawingUtilsRef,
    videoRef,
    canvasRef,
    landmarkSmootherRef,
  ]);

  // Start tracking loop when webcam is ready
  useEffect(() => {
    if (isWebcamReady) {
      landmarkSmootherRef.current = initializeEmaSmoothersForHands(
        MAX_SUPPORTED_HANDS,
        0.5,
      );
      controlModeHistoryRef.current = []; // Reset debounce history
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
      requestRef.current = requestAnimationFrame(predictWebcamLoop);
    }

    return () => {
      if (requestRef.current) {
        cancelAnimationFrame(requestRef.current);
        requestRef.current = null;
      }
    };
  }, [isWebcamReady, predictWebcamLoop]);

  return (
    <div className="w-full flex flex-col h-screen bg-gray-800 text-white items-center p-4 font-sans">
      <h1 className="text-3xl font-bold mb-4">Map Gesture Control</h1>

      <ControlStatus
        currentControlMode={currentControlMode}
        panVector={panVector}
        zoomVector={zoomVector}
      />

      <div className="w-full h-full flex flex-col md:flex-row gap-3">
        <div className="w-full h-full rounded-lg shadow-xl border-2 border-blue-500 bg-gray-700 relative overflow-hidden">
          <ReactMap
            containerRef={mapComponentContainerRef}
            mapRef={mapRef}
            onMapLoad={() => {}}
          />
          <FireworksDisplay ref={fireworksRef} />
        </div>
        <div className="w-full md:w-1/3 flex flex-col items-center gap-3">
          <CameraView videoRef={videoRef} canvasRef={canvasRef} />
          <PanVectorInfo panVector={panVector} />
          <ZoomVectorInfo zoomVector={zoomVector} />
        </div>
      </div>
    </div>
  );
}

export default MagicControl;
