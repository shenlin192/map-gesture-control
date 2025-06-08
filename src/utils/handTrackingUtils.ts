import { GestureRecognizer, type GestureRecognizerResult, type NormalizedLandmark } from '@mediapipe/tasks-vision';
import { EMASmoother } from '../components/EMASmoother'; // Assuming EMASmoother is here

// Helper function to initialize EMASmoother instances for all hands
export function initializeEmaSmoothersForHands(maxHands: number, smoothingFactor: number): EMASmoother[][] {
  return Array(maxHands)
    .fill(null)
    .map(() =>
      Array(21).fill(null).map(() => new EMASmoother(smoothingFactor))
    );
}

export function recognizeGesturesInFrame(
  video: HTMLVideoElement,
  gestureRecognizer: GestureRecognizer
): GestureRecognizerResult {
  const startTimeMs = performance.now();
  return gestureRecognizer.recognizeForVideo(video, startTimeMs);
}

export function getSmoothLandmarks(
  results: GestureRecognizerResult,
  landmarkSmoothers: EMASmoother[][],
  maxSupportedHands: number
): NormalizedLandmark[][] {
  if (!results?.landmarks || landmarkSmoothers.length === 0) {
    return [];
  }
  
  return results.landmarks.map((handLandmarks: NormalizedLandmark[], handIndex: number) => {
    if (handIndex >= maxSupportedHands) return handLandmarks; // Safety check
    const currentHandSmoothers = landmarkSmoothers[handIndex];
    if (!currentHandSmoothers) return handLandmarks; // Safety check

    return handLandmarks.map((lm, landmarkIdx) =>
      currentHandSmoothers[landmarkIdx]?.smoothLandmark(lm) || lm
    );
  });
}


