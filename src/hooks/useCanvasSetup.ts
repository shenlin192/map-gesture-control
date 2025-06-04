import { useEffect, useRef } from 'react';
import { DrawingUtils } from '@mediapipe/tasks-vision';

interface UseCanvasSetupProps {
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  isMediaPipeLoaded: boolean;
}

export function useCanvasSetup({ canvasRef, isMediaPipeLoaded }: UseCanvasSetupProps) {
  const drawingUtilsRef = useRef<DrawingUtils | null>(null);

  useEffect(() => {
    if (!isMediaPipeLoaded) {
      drawingUtilsRef.current = null;
      return;
    }

    if (canvasRef.current) {
      const canvasCtx = canvasRef.current.getContext('2d');
      if (canvasCtx) {
        drawingUtilsRef.current = new DrawingUtils(canvasCtx);
      } else {
        drawingUtilsRef.current = null;
      }
    } else {
      drawingUtilsRef.current = null;
    }
  }, [canvasRef, isMediaPipeLoaded]); 

  return { drawingUtilsRef };
}
