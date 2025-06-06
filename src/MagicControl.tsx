import { useCallback, useEffect, useRef, useState } from 'react';
import { EMASmoother } from './components/EMASmoother.ts';
import ReactMap from './components/ReactMap.tsx';
import CameraView from './components/Camera.tsx';
import PanVectorInfo from './components/PanVectorInfo.tsx';
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
import { detectControlMode, calculatePanVector } from './utils/gestureUtils';
import type { ControlMode } from './types';

const MAX_SUPPORTED_HANDS = 2;

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

  const { gestureRecognizerRef, isMediaPipeReady } = useMediaPipe();
  const { drawingUtilsRef, isDrawingUtilsReady } = useCanvasSetup({ canvasRef, isReady: isMediaPipeReady });
  const { isWebcamReady } = useWebcamSetup({
    videoRef,
    canvasRef,
    isReady: isDrawingUtilsReady,
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

     // Draw canvas with landmarks and dead zone
     drawLandmarksOnCanvas(
      canvasRef.current!,
      videoRef.current!,
      drawingUtilsRef.current!,
      smoothedLandmarks,
    );
    
    // Step 1: recognize intent based on landmarks
    let controlMode: ControlMode = 'IDLE';
    if (smoothedLandmarks.length > 0) {
      const primaryHand = smoothedLandmarks[0];
      controlMode = detectControlMode(primaryHand);
      
      setCurrentControlMode(controlMode);
      
      switch (controlMode) {
        case 'ZOOMING':
          setDetectedGesture('Pinch - Zoom Mode');
          setPanVector(null);
          break;
        case 'PANNING':
          const panVec = calculatePanVector(primaryHand);
          setPanVector(panVec);
          drawDeadZone(canvasRef.current!); 
          if (panVec.inDeadZone) {
            setDetectedGesture('Pointing Up - In Dead Zone');
          } else {
            setDetectedGesture(`Pointing Up - Pan Active (Speed: ${(panVec.speed * 100).toFixed(0)}%)`);
          }
          break;
        case 'IDLE':
          setDetectedGesture('Open Palm/Other - Idle');
          setPanVector(null);
          break;
        default:
          setDetectedGesture('Unknown');
          setPanVector(null);
      }
    } else {
      setCurrentControlMode('IDLE');
      setDetectedGesture('No hand detected');
      setPanVector(null);
    }

    requestRef.current = requestAnimationFrame(predictWebcamLoop);
  }, [gestureRecognizerRef, drawingUtilsRef, videoRef, canvasRef, landmarkSmootherRef]);



  // Start tracking loop when webcam is ready
  useEffect(() => {
    if (isWebcamReady) {
      // Initialize EMA smoothers
      landmarkSmootherRef.current = initializeEmaSmoothersForHands(MAX_SUPPORTED_HANDS, 0.5);
      
      // Start the tracking loop
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
        </div>
      </div>
    </div>
  );
}

export default MagicControl;
