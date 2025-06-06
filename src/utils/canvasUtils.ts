import { DrawingUtils, GestureRecognizer, type NormalizedLandmark } from '@mediapipe/tasks-vision';

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

export function drawDeadZone(canvas: HTMLCanvasElement) {
  const canvasCtx = canvas.getContext('2d');
  if (!canvasCtx) {
    console.error('drawDeadZone: Failed to get 2D context from canvas.');
    return;
  }

  const deadZoneCenter = { x: 0.5, y: 0.5 };
  const deadZoneRadius = 0.15;
  
  // Convert normalized coordinates to canvas coordinates
  const centerX = deadZoneCenter.x * canvas.width;
  const centerY = deadZoneCenter.y * canvas.height;
  const radius = deadZoneRadius * Math.min(canvas.width, canvas.height);
  
  
  canvasCtx.save();
  
  // Draw semi-transparent filled circle for dead zone
  canvasCtx.fillStyle = 'rgba(0, 255, 0, 0.1)';
  canvasCtx.beginPath();
  canvasCtx.arc(centerX, centerY, radius, 0, 2 * Math.PI);
  canvasCtx.fill();
  
  // Draw dead zone circle border
  canvasCtx.strokeStyle = '#00FF00';
  canvasCtx.lineWidth = 3;
  canvasCtx.setLineDash([10, 5]);
  canvasCtx.beginPath();
  canvasCtx.arc(centerX, centerY, radius, 0, 2 * Math.PI);
  canvasCtx.stroke();
  
  // Draw center point
  canvasCtx.fillStyle = '#00FF00';
  canvasCtx.setLineDash([]);
  canvasCtx.beginPath();
  canvasCtx.arc(centerX, centerY, 5, 0, 2 * Math.PI);
  canvasCtx.fill();
  
  canvasCtx.restore();
}

export function drawLandmarksOnCanvas(
  canvas: HTMLCanvasElement,
  video: HTMLVideoElement,
  drawingUtils: DrawingUtils,
  smoothedLandmarks: NormalizedLandmark[][],
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