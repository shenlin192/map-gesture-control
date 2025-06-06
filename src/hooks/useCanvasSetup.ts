import { useEffect, useRef, useState } from 'react';
import { DrawingUtils } from '@mediapipe/tasks-vision';

interface UseCanvasSetupProps {
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  isReady: boolean;
}

export function useCanvasSetup({ canvasRef, isReady }: UseCanvasSetupProps) {
  const [isDrawingUtilsReady, setIsDrawingUtilsReady] = useState<boolean>(false);
  const drawingUtilsRef = useRef<DrawingUtils | null>(null);

  useEffect(() => {
    if (!isReady) {
      drawingUtilsRef.current = null;
      setIsDrawingUtilsReady(false);
      return;
    }

    if (canvasRef.current) {
      const canvasCtx = canvasRef.current.getContext('2d');
      if (canvasCtx) {
        drawingUtilsRef.current = new DrawingUtils(canvasCtx);
        setIsDrawingUtilsReady(true);
      } else {
        drawingUtilsRef.current = null;
        setIsDrawingUtilsReady(false);
      }
    } else {
      drawingUtilsRef.current = null;
      setIsDrawingUtilsReady(false);
    }
  }, [canvasRef, isReady]); 

  return { drawingUtilsRef, isDrawingUtilsReady };
}
