import { useCallback, useEffect, useRef, useState } from 'react';
import { EMASmoother } from './components/EMASmoother.ts';
import ReactMap from './components/ReactMap.tsx';
import CameraView from './components/Camera.tsx';
import type { MapRef } from 'react-map-gl/mapbox';
import { useMediaPipe } from './hooks/useMediaPipe';
import { useCanvasSetup } from './hooks/useCanvasSetup';
import { useWebcamSetup } from './hooks/useWebcamSetup';
import {
  recognizeGesturesInFrame,
  getSmoothLandmarks,
  drawLandmarksOnCanvas,
  initializeEmaSmoothersForHands,
} from './utils/handTrackingUtils';
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
    
    drawLandmarksOnCanvas(
      canvasRef.current!,
      videoRef.current!,
      drawingUtilsRef.current!,
      smoothedLandmarks
    );

    // Step 1: recognize intent based on landmarks
    if (smoothedLandmarks.length > 0) {
      const primaryHand = smoothedLandmarks[0];
      const controlMode = detectControlMode(primaryHand);
      
      setCurrentControlMode(controlMode);
      
      switch (controlMode) {
        case 'ZOOMING':
          setDetectedGesture('Pinch - Zoom Mode');
          setPanVector(null);
          break;
        case 'PANNING':
          const panVec = calculatePanVector(primaryHand);
          setPanVector(panVec);
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
    
    // Step 2: update map (not implemented yet)
    
    

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
      
      <div className="mb-4 p-4 bg-gray-700 rounded-lg">
        <div className="flex flex-col gap-3">
          <div className="flex gap-6">
            <div>
              <span className="font-semibold">Control Mode: </span>
              <span className={`px-2 py-1 rounded text-sm ${
                currentControlMode === 'PANNING' ? 'bg-blue-600' :
                currentControlMode === 'ZOOMING' ? 'bg-green-600' :
                'bg-gray-600'
              }`}>
                {currentControlMode}
              </span>
            </div>
            <div>
              <span className="font-semibold">Gesture: </span>
              <span className="text-yellow-300">{detectedGesture}</span>
            </div>
          </div>
          
          {panVector && !panVector.inDeadZone && (
            <div className="bg-gray-600 p-3 rounded text-sm">
              <div className="font-semibold text-blue-300 mb-2">Pan Vector Info (Natural Scrolling):</div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <span className="text-gray-300">Hand Direction:</span> ({panVector.rawDirection.x}, {panVector.rawDirection.y})
                </div>
                <div>
                  <span className="text-green-300">Map Pan Direction:</span> ({panVector.x.toFixed(3)}, {panVector.y.toFixed(3)})
                </div>
                <div>Speed: {(panVector.speed * 100).toFixed(0)}%</div>
                <div>Distance: {panVector.distance}</div>
                <div className="col-span-2 text-gray-400 text-xs mt-1">
                  Hand UP → Map DOWN | Hand DOWN → Map UP
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
      
      <div className="w-full h-full flex flex-col md:flex-row gap-3">
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
