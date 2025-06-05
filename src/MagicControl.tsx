import { useCallback, useRef } from 'react';
import { EMASmoother } from './components/EMASmoother.ts';
import ReactMap from './components/ReactMap.tsx';
import CameraView from './components/Camera.tsx';
import type { MapRef } from 'react-map-gl/mapbox';
import { useMediaPipe } from './hooks/useMediaPipe';
import { useCanvasSetup } from './hooks/useCanvasSetup';
import { useWebcamSetup } from './hooks/useWebcamSetup';
import {
  processFrameAndDrawHands,
} from './utils/handTrackingUtils';

const MAX_SUPPORTED_HANDS = 2;

function MagicControl() {
  const mapComponentContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapRef | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const requestRef = useRef<number | null>(null);
  const landmarkSmootherRef = useRef<EMASmoother[][]>([]);

  const { gestureRecognizerRef, isMediaPipeLoaded } = useMediaPipe();
  const { drawingUtilsRef, isDrawingUtilsReady } = useCanvasSetup({ canvasRef, isMediaPipeLoaded });

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

    processFrameAndDrawHands(
      canvasRef.current!,
      videoRef.current!,
      gestureRecognizerRef.current!,
      drawingUtilsRef.current!,
      landmarkSmootherRef.current,
      MAX_SUPPORTED_HANDS,
    );

    // TODO process Frame and update map

    requestRef.current = requestAnimationFrame(predictWebcamLoop);
  }, [gestureRecognizerRef, drawingUtilsRef, videoRef, canvasRef, landmarkSmootherRef]);

  useWebcamSetup({
    videoRef,
    canvasRef,
    landmarkSmootherRef,
    requestRef,
    predictWebcamLoop,
    isReady: isDrawingUtilsReady && drawingUtilsRef.current !== null,
    maxSupportedHands: MAX_SUPPORTED_HANDS,
  });

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
