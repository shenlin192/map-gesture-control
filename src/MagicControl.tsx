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
  recognizeGesturesInFrame,
  getSmoothLandmarks,
  initializeEmaSmoothersForHands,
} from './utils/handTrackingUtils';
import { drawLandmarksOnCanvas, drawDeadZone } from './utils/canvasUtils';
import { detectControlMode, calculatePanVector, calculateZoomSpeed } from './utils/gestureUtils';
import type { ControlMode } from './types';
import type { NormalizedLandmark } from '@mediapipe/tasks-vision';
import { MAX_SUPPORTED_HANDS } from './utils/constants';

// Helper function to format speed percentage
const formatSpeedPercentage = (speed: number): string => {
  return (speed * 100).toFixed(0).padStart(3, ' ');
};

// Helper function to generate gesture text based on control mode and state
const generateGestureText = (controlMode: ControlMode, vectorInfo: any): string => {
  switch (controlMode) {
    case 'ZOOM_IN':
    case 'ZOOM_OUT':
      const gestureLabel = controlMode === 'ZOOM_IN' ? 'Victory' : 'Close Pinch';
      if (vectorInfo.inDeadZone) {
        return `${gestureLabel} - In Dead Zone`;
      }
      const zoomDirection = controlMode.replace('_', ' ');
      return `${gestureLabel} - ${zoomDirection} (Speed: ${formatSpeedPercentage(vectorInfo.speed)}%)`;
    
    case 'PANNING':
      if (vectorInfo.inDeadZone) {
        return 'Pointing Up - In Dead Zone';
      }
      return `Pointing Up - Pan Active (Speed: ${formatSpeedPercentage(vectorInfo.speed)}%)`;
    
    case 'IDLE':
      return 'Open Palm/Other - Idle';
    
    default:
      return 'Unknown';
  }
};

// Helper function to process gesture state from landmarks
const processGestureState = (smoothedLandmarks: NormalizedLandmark[][]) => {
  if (smoothedLandmarks.length === 0) {
    return {
      controlMode: 'IDLE' as ControlMode,
      detectedGesture: 'No hand detected',
      panVector: null,
      zoomVector: null,
      shouldDrawDeadZone: false
    };
  }

  const primaryHand = smoothedLandmarks[0];
  const controlMode = detectControlMode(primaryHand);
  
  switch (controlMode) {
    case 'ZOOM_IN':
    case 'ZOOM_OUT':
      const zoomSpeedInfo = calculateZoomSpeed(primaryHand);
      const zoomVec = {
        direction: controlMode,
        ...zoomSpeedInfo
      };
      
      return {
        controlMode,
        detectedGesture: generateGestureText(controlMode, zoomVec),
        panVector: null,
        zoomVector: zoomVec,
        shouldDrawDeadZone: true
      };

    case 'PANNING':
      const panVec = calculatePanVector(primaryHand);
      
      return {
        controlMode,
        detectedGesture: generateGestureText(controlMode, panVec),
        panVector: panVec,
        zoomVector: null,
        shouldDrawDeadZone: true
      };

    default: // 'IDLE' and unknown cases
      return {
        controlMode,
        detectedGesture: generateGestureText(controlMode, null),
        panVector: null,
        zoomVector: null,
        shouldDrawDeadZone: false
      };
  }
};


function MagicControl() {
  const mapComponentContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapRef | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const requestRef = useRef<number | null>(null);
  const landmarkSmootherRef = useRef<EMASmoother[][]>([]);
  
  const [currentControlMode, setCurrentControlMode] = useState<ControlMode>('IDLE');
  const [detectedGesture, setDetectedGesture] = useState<string>('None');
  const [panVector, setPanVector] = useState<any>(null);
  const [zoomVector, setZoomVector] = useState<any>(null);

  const { gestureRecognizerRef, isMediaPipeReady } = useMediaPipe();
  const { drawingUtilsRef, isDrawingUtilsReady } = useCanvasSetup({ canvasRef, isReady: isMediaPipeReady });
  const { isWebcamReady } = useWebcamSetup({
    videoRef,
    canvasRef,
    isReady: isDrawingUtilsReady,
  });

  // Hook to handle map movement based on pan gestures
  useMapControl({
    mapRef,
    controlMode: currentControlMode,
    panVector,
  });

  const handleMapLoad = useCallback(() => {
    console.log('Map loaded successfully.');
  }, []);

  const predictWebcamLoop: () => void = useCallback(() => {
    if (
      !videoRef.current ||
      videoRef.current.readyState < HTMLMediaElement.HAVE_METADATA // Ensure video is ready enough
    ) {
      // Not ready yet, try again
      requestRef.current = requestAnimationFrame(predictWebcamLoop);
      return;
    }

    const results = recognizeGesturesInFrame(
      videoRef.current!,
      gestureRecognizerRef.current!
    );
    
    const smoothedLandmarks = getSmoothLandmarks(
      results,
      landmarkSmootherRef.current,
      MAX_SUPPORTED_HANDS
    );
    
     // Draw canvas with landmarks
     drawLandmarksOnCanvas(
      canvasRef.current!,
      videoRef.current!,
      drawingUtilsRef.current!,
      smoothedLandmarks,
    );
    
    // Process gesture state and update component state
    const gestureState = processGestureState(smoothedLandmarks);
    setCurrentControlMode(gestureState.controlMode);
    setDetectedGesture(gestureState.detectedGesture);
    setPanVector(gestureState.panVector);
    setZoomVector(gestureState.zoomVector);
    
    // Draw dead zone if needed
    if (gestureState.shouldDrawDeadZone && canvasRef.current) {
      drawDeadZone(canvasRef.current);
    }

    requestRef.current = requestAnimationFrame(predictWebcamLoop);
  }, [gestureRecognizerRef, drawingUtilsRef, videoRef, canvasRef, landmarkSmootherRef]);


  // Start tracking loop when webcam is ready
  useEffect(() => {
    if (isWebcamReady) {
      landmarkSmootherRef.current = initializeEmaSmoothersForHands(MAX_SUPPORTED_HANDS, 0.5);
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
        detectedGesture={detectedGesture} 
      />
      
      <div className="w-full h-full flex flex-col md:flex-row gap-3">
        <ReactMap
          containerRef={mapComponentContainerRef}
          mapRef={mapRef}
          onMapLoad={handleMapLoad}
        />
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
