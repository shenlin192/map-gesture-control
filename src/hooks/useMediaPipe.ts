import { useState, useEffect, useRef } from 'react';
import { GestureRecognizer, FilesetResolver } from '@mediapipe/tasks-vision';
import { EMASmoother } from '../components/EMASmoother';
import type { GestureStatus } from '../types';

const MEDIAPIPE_GESTURE_MODEL_PATH =
  'https://storage.googleapis.com/mediapipe-models/gesture_recognizer/gesture_recognizer/float16/1/gesture_recognizer.task';

interface UseMediaPipeOptions {
  initialStatus: GestureStatus;
  setGestureStatus: (status: GestureStatus) => void;
}

export const useMediaPipe = ({
  initialStatus,
  setGestureStatus,
}: UseMediaPipeOptions) => {
  const gestureRecognizerRef = useRef<GestureRecognizer | null>(null);
  const landmarkSmootherRef = useRef<EMASmoother[]>([]);
  const [isMediaPipeLoaded, setIsMediaPipeLoaded] = useState(false);

  useEffect(() => {
    if (
      isMediaPipeLoaded ||
      gestureRecognizerRef.current ||
      initialStatus !== 'Map Loaded. Initializing MediaPipe...'
    ) {
      return;
    }

    const initializeMediaPipe = async () => {
      try {
        console.log('Initializing MediaPipe (from hook)...');
        const vision = await FilesetResolver.forVisionTasks(
          'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm',
        );

        const recognizer = await GestureRecognizer.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath: MEDIAPIPE_GESTURE_MODEL_PATH,
            delegate: 'GPU',
          },
          runningMode: 'VIDEO',
          numHands: 2,
          minHandDetectionConfidence: 0.6,
          minHandPresenceConfidence: 0.6,
          minTrackingConfidence: 0.6,
        });

        console.log('MediaPipe initialized successfully (from hook)');
        gestureRecognizerRef.current = recognizer;
        landmarkSmootherRef.current = Array(21)
          .fill(null)
          .map(() => new EMASmoother(0.4));
        setIsMediaPipeLoaded(true);
        setGestureStatus('MediaPipe Ready. Starting Webcam...');
      } catch (err) {
        const errorMessage =
          'Error initializing MediaPipe (from hook): ' +
          (err instanceof Error ? err.message : 'Unknown error');
        console.error(errorMessage, err);
        setGestureStatus('Error initializing MediaPipe. Check console.');
        setIsMediaPipeLoaded(false);
      }
    };

    initializeMediaPipe();
  }, [initialStatus, setGestureStatus, isMediaPipeLoaded]);

  return { gestureRecognizerRef, landmarkSmootherRef, isMediaPipeLoaded };
};
