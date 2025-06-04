import { useState, useCallback, useRef, useEffect } from 'react';
import { GestureRecognizer, FilesetResolver } from '@mediapipe/tasks-vision';

const MEDIAPIPE_GESTURE_MODEL_PATH: string =
  'https://storage.googleapis.com/mediapipe-models/gesture_recognizer/gesture_recognizer/float16/1/gesture_recognizer.task';

export function useMediaPipe() {
  const gestureRecognizerRef = useRef<GestureRecognizer | null>(null);
  const [isMediaPipeLoaded, setIsMediaPipeLoaded] = useState<boolean>(false);

  const initializeMediaPipe = useCallback(async () => {
    console.log('Initializing MediaPipe');
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
      setIsMediaPipeLoaded(true);
      console.log('MediaPipe initialized successfully');
    } catch (error) {
      console.error('Failed to initialize MediaPipe:', error);
      setIsMediaPipeLoaded(false);
    }
  }, [setIsMediaPipeLoaded]);

  useEffect(() => {
    initializeMediaPipe();
  }, [initializeMediaPipe]);

  return {
    gestureRecognizerRef,
    isMediaPipeLoaded,
  };
}
