import { DrawingUtils, GestureRecognizer, type NormalizedLandmark } from '@mediapipe/tasks-vision';
import { EMASmoother } from '../components/EMASmoother'; // Assuming EMASmoother is here

// Helper function to initialize EMASmoother instances for all hands
export function initializeEmaSmoothersForHands(maxHands: number, smoothingFactor: number): EMASmoother[][] {
  return Array(maxHands)
    .fill(null)
    .map(() =>
      Array(21).fill(null).map(() => new EMASmoother(smoothingFactor))
    );
}

// Helper function to apply smoothing to landmarks for all detected hands
export function getSmoothedLandmarksForFrame(
  rawLandmarksForHands: NormalizedLandmark[][],
  handSmoothers: EMASmoother[][],
  maxSupportedHands: number
): NormalizedLandmark[][] {
  if (!rawLandmarksForHands || rawLandmarksForHands.length === 0) {
    return [];
  }
  return rawLandmarksForHands.map((handLandmarks, handIndex) => {
    if (handIndex >= maxSupportedHands) return handLandmarks; // Safety check
    const currentHandSmoothers = handSmoothers[handIndex];
    if (!currentHandSmoothers) return handLandmarks; // Safety check

    return handLandmarks.map((lm, landmarkIdx) =>
      currentHandSmoothers[landmarkIdx]?.smoothLandmark(lm) || lm
    );
  });
}

// Helper function to draw all detected and smoothed hands on the canvas
export function drawHandsOnCanvas(
  drawingUtils: DrawingUtils,
  landmarksForHands: NormalizedLandmark[][]
) {
  landmarksForHands.forEach((singleHandLandmarks) => {
    drawingUtils.drawConnectors(
      singleHandLandmarks,
      GestureRecognizer.HAND_CONNECTIONS,
      { color: '#FFFFFF', lineWidth: 3 } // White connectors
    );
    drawingUtils.drawLandmarks(singleHandLandmarks, {
      color: '#FF9800', // Orange landmarks
      fillColor: '#FF9800',
      lineWidth: 1,
      radius: (data: any) => {
        // Adjust landmark size based on Z-depth
        return DrawingUtils.lerp(data.from!.z!, -0.15, 0.1, 5, 1);
      },
    });
  });
}
