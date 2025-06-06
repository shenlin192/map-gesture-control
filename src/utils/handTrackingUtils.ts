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

export function recognizeGesturesInFrame(
  video: HTMLVideoElement,
  gestureRecognizer: GestureRecognizer
) {
  try {
    const startTimeMs = performance.now();
    return gestureRecognizer.recognizeForVideo(video, startTimeMs);
  } catch (err) {
    console.error('Error in recognizeGesturesInFrame:', err);
    return null;
  }
}

export function getSmoothLandmarks(
  results: any,
  landmarkSmoothers: EMASmoother[][],
  maxSupportedHands: number
): NormalizedLandmark[][] {
  if (!results?.landmarks || landmarkSmoothers.length === 0) {
    return [];
  }
  
  return getSmoothedLandmarksForFrame(
    results.landmarks,
    landmarkSmoothers,
    maxSupportedHands
  );
}

export function drawLandmarksOnCanvas(
  canvas: HTMLCanvasElement,
  video: HTMLVideoElement,
  drawingUtils: DrawingUtils,
  smoothedLandmarks: NormalizedLandmark[][]
) {
  const canvasCtx = canvas.getContext('2d');
  if (!canvasCtx) {
    console.error('drawLandmarksOnCanvas: Failed to get 2D context from canvas.');
    return;
  }

  canvasCtx.save();
  canvasCtx.clearRect(0, 0, canvas.width, canvas.height);

  if (video.videoWidth > 0 && video.videoHeight > 0) {
    if (canvas.width !== video.videoWidth || canvas.height !== video.videoHeight) {
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
    }
  }

  if (smoothedLandmarks.length > 0) {
    drawHandsOnCanvas(drawingUtils, smoothedLandmarks);
  }
  
  canvasCtx.restore();
}
