import { useState, useCallback, useRef, useEffect } from 'react';
import {
  GestureRecognizer,
  FilesetResolver,
  DrawingUtils,
} from '@mediapipe/tasks-vision';

const MEDIAPIPE_GESTURE_MODEL_PATH: string =
  'https://storage.googleapis.com/mediapipe-models/gesture_recognizer/gesture_recognizer/float16/1/gesture_recognizer.task';

interface UseMediaPipeProps {
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
}

export function useMediaPipe({ canvasRef }: UseMediaPipeProps) {
  const gestureRecognizerRef = useRef<GestureRecognizer | null>(null);
  const drawingUtilsRef = useRef<DrawingUtils | null>(null);
  const [isMediaPipeLoaded, setIsMediaPipeLoaded] = useState<boolean>(false);

  const initializeMediaPipe = useCallback(async () => {
    console.log('Initializing MediaPipe (from hook)...');
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

      if (canvasRef.current) {
        const canvasCtx = canvasRef.current.getContext('2d');
        if (canvasCtx) {
          drawingUtilsRef.current = new DrawingUtils(canvasCtx);
          console.log('useMediaPipe: DrawingUtils initialized.');
        } else {
          console.error(
            'useMediaPipe: Failed to get 2D context from canvas for DrawingUtils.',
          );
        }
      } else {
        console.warn(
          'useMediaPipe: canvasRef.current is null during init. DrawingUtils may not be initialized yet.',
        );
      }

      console.log('MediaPipe Initialized (from hook).');
      setIsMediaPipeLoaded(true);
    } catch (error) {
      console.error('Failed to initialize MediaPipe (from hook):', error);
      setIsMediaPipeLoaded(false); // Ensure state reflects failure
    }
  }, [canvasRef, setIsMediaPipeLoaded]);

  useEffect(() => {
    initializeMediaPipe();
  }, [initializeMediaPipe]);

  return {
    gestureRecognizerRef,
    drawingUtilsRef,
    isMediaPipeLoaded,
  };
}
