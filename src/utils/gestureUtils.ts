import type {
  GestureRecognizerResult,
  NormalizedLandmark,
} from '@mediapipe/tasks-vision';
import type { ControlMode } from '../types';
import {
  DEAD_ZONE_CENTER,
  DEAD_ZONE_RADIUS,
  PAN_SPEED_AMPLIFIER,
  CLOSE_PINCH_THRESHOLD,
  THUMB_CURL_THRESHOLD,
  VICTORY_ANGLE_THRESHOLD,
} from '../constants';
import { calculateDistance, calculateAngle } from './geometry';

// Helper function to extract commonly used landmarks
const extractLandmarks = (landmarks: NormalizedLandmark[]) => {
  return {
    wrist: landmarks[0],
    thumbCMC: landmarks[1],
    thumbMCP: landmarks[2],
    thumbIP: landmarks[3],
    thumbTip: landmarks[4],
    indexMCP: landmarks[5],
    indexPIP: landmarks[6],
    indexDIP: landmarks[7],
    indexTip: landmarks[8],
    middleMCP: landmarks[9],
    middlePIP: landmarks[10],
    middleDIP: landmarks[11],
    middleTip: landmarks[12],
    ringMCP: landmarks[13],
    ringPIP: landmarks[14],
    ringDIP: landmarks[15],
    ringTip: landmarks[16],
    pinkyMCP: landmarks[17],
    pinkyPIP: landmarks[18],
    pinkyDIP: landmarks[19],
    pinkyTip: landmarks[20],
  };
};

// Helper function to calculate hand size (wrist to middle MCP distance)
const calculateHalfHandSize = (landmarks: NormalizedLandmark[]): number => {
  const { wrist, middleMCP } = extractLandmarks(landmarks);

  if (!wrist || !middleMCP) return 0;

  return calculateDistance(wrist, middleMCP);
};

// Helper function to check if middle, ring, and pinky fingers are curled
const areFingersCurled = (
  landmarks: NormalizedLandmark[],
  tolerance: number = 0,
): boolean => {
  const { middleTip, middlePIP, ringTip, ringPIP, pinkyTip, pinkyPIP } =
    extractLandmarks(landmarks);

  if (
    !middleTip ||
    !middlePIP ||
    !ringTip ||
    !ringPIP ||
    !pinkyTip ||
    !pinkyPIP
  ) {
    return false;
  }

  const middleCurled = middleTip.y > middlePIP.y - tolerance;
  const ringCurled = ringTip.y > ringPIP.y - tolerance;
  const pinkyCurled = pinkyTip.y > pinkyPIP.y - tolerance;

  return middleCurled && ringCurled && pinkyCurled;
};

const areFingersClosed = (landmarks: NormalizedLandmark[]): boolean => {
  const { thumbCMC, middleTip, ringTip, pinkyTip } =
    extractLandmarks(landmarks);

  if (!thumbCMC || !middleTip || !ringTip || !pinkyTip) {
    return false;
  }

  const halfHandSize = calculateHalfHandSize(landmarks);
  const middleTipThumbCMCDistance = calculateDistance(middleTip, thumbCMC);
  const ringTipThumbCMCDistance = calculateDistance(ringTip, thumbCMC);
  const pinkyTipThumbCMCDistance = calculateDistance(pinkyTip, thumbCMC);
  const DISTANCE_RATIO = 0.8;
  const middleClosed =
    middleTipThumbCMCDistance < halfHandSize * DISTANCE_RATIO;
  const ringClosed = ringTipThumbCMCDistance < halfHandSize * DISTANCE_RATIO;
  const pinkyClosed = pinkyTipThumbCMCDistance < halfHandSize * DISTANCE_RATIO;

  return middleClosed && ringClosed && pinkyClosed;
};

export const isIndexPointingUp = (landmarks: NormalizedLandmark[]): boolean => {
  if (!landmarks || landmarks.length === 0) return false;

  const { thumbTip, indexTip, indexPIP, indexMCP, middlePIP } =
    extractLandmarks(landmarks);

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

  // 4. Middle, ring, pinky to distance related to wrist to middle finger distance
  const fingersClosed = areFingersClosed(landmarks);
  if (!fingersClosed) return false;

  return true;
};

// TODO: stricter conditions
export const isPinchGesture = (landmarks: NormalizedLandmark[]): boolean => {
  if (!landmarks || landmarks.length === 0) return false;

  const {
    thumbMCP,
    thumbIP,
    thumbTip,
    indexPIP,
    indexDIP,
    indexTip,
    middleMCP,
  } = extractLandmarks(landmarks);

  // Check if all required landmarks exist
  if (
    !thumbTip ||
    !thumbIP ||
    !thumbMCP ||
    !indexTip ||
    !indexPIP ||
    !indexDIP
  ) {
    return false;
  }

  const halfHandSize = calculateHalfHandSize(landmarks);

  // 1. Thumb and index tips must be close together
  const thumbIndexDistance = calculateDistance(thumbTip, indexTip);
  // replace it with Ratio
  if (thumbIndexDistance >= CLOSE_PINCH_THRESHOLD) return false;

  // 2. Index finger must be curled
  const indexCurled = indexTip.y > indexDIP.y && indexDIP.y > indexPIP.y;
  if (!indexCurled) return false;

  // 3. index to middle finger distance related to the half hand size
  const indexMiddleDistance = calculateDistance(indexTip, middleMCP);
  const indexMiddleDistanceRatio = indexMiddleDistance / halfHandSize;
  if (indexMiddleDistanceRatio < 0.58) return false;

  // 4. Middle, ring, pinky to distance related to wrist to middle finger distance
  const fingersClosed = areFingersClosed(landmarks);
  if (!fingersClosed) return false;

  return true;
};

export const isVictoryGesture = (landmarks: NormalizedLandmark[]): boolean => {
  if (!landmarks || landmarks.length === 0) return false;

  const { thumbCMC, thumbMCP, thumbIP, thumbTip, indexTip } =
    extractLandmarks(landmarks);

  // Check if all required landmarks exist
  if (!thumbCMC || !thumbMCP || !thumbIP || !thumbTip || !indexTip) {
    return false;
  }

  // 1. Thumb and index must be spread apart at sufficient angle
  const thumbIndexAngle = calculateAngle(thumbMCP, thumbTip, indexTip);

  if (thumbIndexAngle < VICTORY_ANGLE_THRESHOLD) return false;

  // 2. Middle, ring, and pinky fingers must be curled (strict)
  const fingersCurled = areFingersCurled(landmarks);
  if (!fingersCurled) return false;

  // 3. Middle, ring, pinky to distance related to wrist to middle finger distance
  const fingersClosed = areFingersClosed(landmarks);
  if (!fingersClosed) return false;

  return true;
};

export const calculatePanVector = (landmarks: NormalizedLandmark[]) => {
  if (!landmarks || landmarks.length === 0)
    return { x: 0, y: 0, speed: 0, inDeadZone: true };

  const { indexTip } = extractLandmarks(landmarks);
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
  const speedFactor = Math.min(
    ((distance - DEAD_ZONE_RADIUS) / (0.5 - DEAD_ZONE_RADIUS)) *
      PAN_SPEED_AMPLIFIER,
    1.0,
  );

  return {
    x: normalizedX,
    y: invertedY,
    speed: speedFactor,
    inDeadZone: false,
    distance: distance.toFixed(3),
    fingerPos: { x: indexTip.x.toFixed(3), y: indexTip.y.toFixed(3) },
    rawDirection: { x: normalizedX.toFixed(3), y: normalizedY.toFixed(3) },
  };
};

export const calculateZoomSpeed = (landmarks: NormalizedLandmark[]) => {
  if (!landmarks || landmarks.length === 0)
    return { speed: 0, inDeadZone: true };

  // Use index finger tip position for zoom speed control (same as panning)
  const { indexTip } = extractLandmarks(landmarks);
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
  const speedFactor = Math.min(
    ((distance - DEAD_ZONE_RADIUS) / (0.5 - DEAD_ZONE_RADIUS)) *
      PAN_SPEED_AMPLIFIER,
    1.0,
  );

  return {
    speed: speedFactor,
    inDeadZone: false,
    distance: distance.toFixed(3),
    fingerPos: { x: indexTip.x.toFixed(3), y: indexTip.y.toFixed(3) },
  };
};

export const detectControlMode = (
  landmarks: NormalizedLandmark[],
  categoryName: string,
): ControlMode => {
  if (!landmarks || landmarks.length === 0) return 'IDLE';

  if (categoryName === 'Closed_Fist') {
    return 'IDLE';
  }

  if (categoryName === 'Open_Palm') {
    return 'FIREWORKS';
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

export const getControlMode = (
  smoothedLandmarks: NormalizedLandmark[][],
  results: GestureRecognizerResult,
): ControlMode => {
  if (smoothedLandmarks.length === 0) return 'IDLE';

  const categoryName = results.gestures[0][0].categoryName;
  const primaryHandLandmarks = smoothedLandmarks[0];

  return detectControlMode(primaryHandLandmarks, categoryName);
};

export const getDebouncedControlMode = (
  detectedMode: ControlMode,
  currentMode: ControlMode,
  historyRef: { current: ControlMode[] },
  debounceFrames: number = 3,
): ControlMode => {
  // Add to history
  historyRef.current.push(detectedMode);
  if (historyRef.current.length > debounceFrames) {
    historyRef.current.shift();
  }

  // Check if we have enough consecutive frames of the same mode
  if (historyRef.current.length >= debounceFrames) {
    const allSame = historyRef.current.every((mode) => mode === detectedMode);
    if (allSame && currentMode !== detectedMode) {
      return detectedMode;
    }
  }

  return currentMode;
};

export const getGestureVectors = (
  controlMode: ControlMode,
  smoothedLandmarks: NormalizedLandmark[][],
) => {
  if (smoothedLandmarks.length === 0) {
    return { panVector: null, zoomVector: null };
  }

  const primaryHandLandmarks = smoothedLandmarks[0];

  switch (controlMode) {
    case 'ZOOM_IN':
    case 'ZOOM_OUT':
      const zoomSpeedInfo = calculateZoomSpeed(primaryHandLandmarks);
      const zoomVec = {
        direction: controlMode,
        ...zoomSpeedInfo,
      };

      return {
        panVector: null,
        zoomVector: zoomVec,
      };

    case 'PANNING':
      const panVec = calculatePanVector(primaryHandLandmarks);

      return {
        panVector: panVec,
        zoomVector: null,
      };

    default: // 'IDLE' and unknown cases
      return {
        panVector: null,
        zoomVector: null,
      };
  }
};
