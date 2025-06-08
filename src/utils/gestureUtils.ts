import type { GestureRecognizerResult, NormalizedLandmark } from '@mediapipe/tasks-vision';
import type { ControlMode } from '../types';
import { DEAD_ZONE_CENTER, DEAD_ZONE_RADIUS, PAN_SPEED_AMPLIFIER, CLOSE_PINCH_THRESHOLD, THUMB_CURL_THRESHOLD, VICTORY_ANGLE_THRESHOLD } from './constants';
import { calculateDistance, calculateAngle } from './geometry';

// Helper function to check if middle, ring, and pinky fingers are curled
const areFingersCurled = (landmarks: NormalizedLandmark[], tolerance: number = 0): boolean => {
  const middleTip = landmarks[12];
  const middlePIP = landmarks[10];
  const ringTip = landmarks[16];
  const ringPIP = landmarks[14];
  const pinkyTip = landmarks[20];
  const pinkyPIP = landmarks[18];
  
  if (!middleTip || !middlePIP || !ringTip || !ringPIP || !pinkyTip || !pinkyPIP) {
    return false;
  }
  
  const middleCurled = middleTip.y > middlePIP.y - tolerance;
  const ringCurled = ringTip.y > ringPIP.y - tolerance;
  const pinkyCurled = pinkyTip.y > pinkyPIP.y - tolerance;
  
  return middleCurled && ringCurled && pinkyCurled;
};

export const isIndexPointingUp = (
  landmarks: NormalizedLandmark[],
): boolean => {
  if (!landmarks || landmarks.length === 0) return false;
  
  const thumbTip = landmarks[4];
  const indexTip = landmarks[8];
  const indexPIP = landmarks[6];
  const indexMCP = landmarks[5];
  const middlePIP = landmarks[10];
  
  // Check if all required landmarks exist
  if (!thumbTip || !indexTip || !indexPIP || !indexMCP || !middlePIP) {
    return false;
  }
  
  // 1. Index finger must be extended (tip above PIP above MCP)
  const indexExtended = indexTip.y < indexPIP.y && indexPIP.y < indexMCP.y;
  if (!indexExtended) return false;
  
  // 2. Thumb must be curled (close to middle finger PIP)
  const thumbMiddleDistance = calculateDistance(thumbTip, middlePIP);
  const thumbCurled = thumbMiddleDistance < THUMB_CURL_THRESHOLD;
  if (!thumbCurled) return false;
  
  // 3. Middle, ring, and pinky fingers must be curled (with tolerance)
  const fingersCurled = areFingersCurled(landmarks, 0.04);
  if (!fingersCurled) return false;

  return true;
};

export const isPinchGesture = (landmarks: NormalizedLandmark[]): boolean => {  
  if (!landmarks || landmarks.length === 0) return false;
  
  const thumbTip = landmarks[4];
  const thumbIP = landmarks[3];
  const thumbMCP = landmarks[2];
  const indexPIP = landmarks[6];
  const indexDIP = landmarks[7];
  const indexTip = landmarks[8];
  const middlePIP = landmarks[10];
  
  // Check if all required landmarks exist
  if (!thumbTip || !thumbIP || !thumbMCP || !indexTip || !indexPIP || !indexDIP || !middlePIP) {
    return false;
  }
  
  // 1. Thumb and index tips must be close together
  const thumbIndexDistance = calculateDistance(thumbTip, indexTip);
  if (thumbIndexDistance >= CLOSE_PINCH_THRESHOLD) return false;
  
  // 2. Index finger must be curled
  const indexCurled = indexTip.y > indexDIP.y && indexDIP.y > indexPIP.y;
  if (!indexCurled) return false;
  
  return true;
};

export const isVictoryGesture = (landmarks: NormalizedLandmark[]): boolean => {
  if (!landmarks || landmarks.length === 0) return false;
  
  const thumbCMC = landmarks[1];
  const thumbMCP = landmarks[2];
  const thumbIP = landmarks[3];
  const thumbTip = landmarks[4];
  const indexTip = landmarks[8];
  
  // Check if all required landmarks exist
  if (!thumbCMC || !thumbMCP || !thumbIP || !thumbTip || !indexTip) {
    return false;
  }
  
  // 1. Thumb and index must be spread apart at sufficient angle
  const thumbIndexAngle = calculateAngle(thumbMCP, thumbTip, indexTip);
  console.log('thumbIndexAngle', thumbIndexAngle);

  if (thumbIndexAngle < VICTORY_ANGLE_THRESHOLD) return false;
  
  // 2. Middle, ring, and pinky fingers must be curled (strict)
  const fingersCurled = areFingersCurled(landmarks);
  if (!fingersCurled) return false;
  
  return true;
};

export const calculatePanVector = (landmarks: NormalizedLandmark[]) => {
  if (!landmarks || landmarks.length === 0) return { x: 0, y: 0, speed: 0, inDeadZone: true };
  
  const indexTip = landmarks[8];
  if (!indexTip) return { x: 0, y: 0, speed: 0, inDeadZone: true };
  
  // Calculate vector from dead zone center to finger tip
  const vectorX = indexTip.x - DEAD_ZONE_CENTER.x;
  const vectorY = indexTip.y - DEAD_ZONE_CENTER.y;
  const distance = Math.sqrt(vectorX * vectorX + vectorY * vectorY);
  
  // Check if finger is in dead zone
  if (distance <= DEAD_ZONE_RADIUS) {
    return { x: 0, y: 0, speed: 0, inDeadZone: true };
  }
  
  // Calculate normalized direction and speed
  const normalizedX = vectorX / distance;
  const normalizedY = vectorY / distance;
  const invertedY = -normalizedY;
  
  // Speed is proportional to distance from dead zone edge
  const speedFactor = Math.min(((distance - DEAD_ZONE_RADIUS) / (0.5 - DEAD_ZONE_RADIUS)) * PAN_SPEED_AMPLIFIER, 1.0);
  
  return {
    x: normalizedX,
    y: invertedY,
    speed: speedFactor,
    inDeadZone: false,
    distance: distance.toFixed(3),
    fingerPos: { x: indexTip.x.toFixed(3), y: indexTip.y.toFixed(3) },
    rawDirection: { x: normalizedX.toFixed(3), y: normalizedY.toFixed(3) }
  };
};

export const calculateZoomSpeed = (landmarks: NormalizedLandmark[]) => {
  if (!landmarks || landmarks.length === 0) return { speed: 0, inDeadZone: true };
  
  // Use index finger tip position for zoom speed control (same as panning)
  const indexTip = landmarks[8];
  if (!indexTip) return { speed: 0, inDeadZone: true };
  
  // Calculate distance from dead zone center
  const vectorX = indexTip.x - DEAD_ZONE_CENTER.x;
  const vectorY = indexTip.y - DEAD_ZONE_CENTER.y;
  const distance = Math.sqrt(vectorX * vectorX + vectorY * vectorY);
  
  // Check if finger is in dead zone
  if (distance <= DEAD_ZONE_RADIUS) {
    return { speed: 0, inDeadZone: true };
  }
  
  // Speed is proportional to distance from dead zone edge (same as panning)
  const speedFactor = Math.min(((distance - DEAD_ZONE_RADIUS) / (0.5 - DEAD_ZONE_RADIUS)) * PAN_SPEED_AMPLIFIER, 1.0);
  
  return {
    speed: speedFactor,
    inDeadZone: false,
    distance: distance.toFixed(3),
    fingerPos: { x: indexTip.x.toFixed(3), y: indexTip.y.toFixed(3) }
  };
};

export const detectControlMode = (landmarks: NormalizedLandmark[], categoryName: string): ControlMode => {
  if (!landmarks || landmarks.length === 0) return 'IDLE';

  if (categoryName === 'Closed_Fist' || categoryName === 'Open_Palm') {
    return 'IDLE';
  }

  if (categoryName === 'Pointing_Up') {
    return 'PANNING';
  }
  
  if (isPinchGesture(landmarks)) {
    return 'ZOOM_OUT';
  }
  
  if (isVictoryGesture(landmarks)) {
    return 'ZOOM_IN';
  }

  if (isIndexPointingUp(landmarks)) {
    return 'PANNING';
  }
  
  return 'IDLE';
};

const defaultGestureState = {
  controlMode: 'IDLE' as ControlMode,
  panVector: null,
  zoomVector: null,
}

export const processGestureState = (smoothedLandmarks: NormalizedLandmark[][], results: GestureRecognizerResult) => {
  if (smoothedLandmarks.length === 0) return defaultGestureState;

  const categoryName = results.gestures[0][0].categoryName;
  console.log('categoryName', categoryName);
  const primaryHandLandmarks = smoothedLandmarks[0];

  const controlMode = detectControlMode(primaryHandLandmarks, categoryName);

  console.log('controlMode', controlMode);
  
  switch (controlMode) {
    case 'ZOOM_IN':
    case 'ZOOM_OUT':
      const zoomSpeedInfo = calculateZoomSpeed(primaryHandLandmarks);
      const zoomVec = {
        direction: controlMode,
        ...zoomSpeedInfo
      };
      
      return {
        controlMode,
        panVector: null,
        zoomVector: zoomVec,
      };

    case 'PANNING':
      const panVec = calculatePanVector(primaryHandLandmarks);
      
      return {
        controlMode,
        panVector: panVec,
        zoomVector: null,
      };

    default: // 'IDLE' and unknown cases
      return {
        controlMode,
        panVector: null,
        zoomVector: null,
      };
  }
};
