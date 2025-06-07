import type { NormalizedLandmark } from '@mediapipe/tasks-vision';
import type { ControlMode } from '../types';
import { DEAD_ZONE_CENTER, DEAD_ZONE_RADIUS, PAN_SPEED_AMPLIFIER, CLOSE_PINCH_THRESHOLD, OPEN_PINCH_THRESHOLD, THUMB_EXTENDED_THRESHOLD, THUMB_CURL_THRESHOLD } from './constants';
import { calculateDistance } from './geometry';

export const isIndexPointingUp = (
  landmarks: NormalizedLandmark[],
): boolean => {
  const hand = landmarks;
  const idxT = hand[8],
    idxP = hand[6],
    idxM = hand[5];
  const midT = hand[12],
    midP = hand[10];
  const rngT = hand[16],
    rngP = hand[14];
  const pkyT = hand[20],
    pkyP = hand[18];
  if (
    !idxT ||
    !idxP ||
    !idxM ||
    !midT ||
    !midP ||
    !rngT ||
    !rngP ||
    !pkyT ||
    !pkyP
  )
    return false;
  
  const thumbTip = hand[4];
  const middlePIP = hand[10];

  const thumbMiddleDistance = calculateDistance(thumbTip, middlePIP);
  const thumbCurled = thumbMiddleDistance < THUMB_CURL_THRESHOLD;
  const indexExtended = idxT.y < idxP.y && idxP.y < idxM.y;
  const yTol = 0.04;
  const middleCurled = midT.y > midP.y - yTol;
  const ringCurled = rngT.y > rngP.y - yTol;
  const pinkyCurled = pkyT.y > pkyP.y - yTol;

  return indexExtended && middleCurled && ringCurled && pinkyCurled && thumbCurled;
};

export const isClosePinchGesture = (landmarks: NormalizedLandmark[]): boolean => {  
  const thumbTip = landmarks[4];
  const indexTip = landmarks[8];
  if (!thumbTip || !indexTip) return false;
  const distance = calculateDistance(thumbTip, indexTip);
  return distance < CLOSE_PINCH_THRESHOLD;
};

export const isOpenPinchGesture = (landmarks: NormalizedLandmark[]): boolean => {
  const thumbTip = landmarks[4];
  const indexTip = landmarks[8];
  const middlePIP = landmarks[10];
  
  if (!thumbTip || !indexTip || !middlePIP) return false;
  
  const thumbIndexDistance = calculateDistance(thumbTip, indexTip);
  const thumbMiddleDistance = calculateDistance(thumbTip, middlePIP);
  
  const thumbExtended = thumbMiddleDistance > THUMB_EXTENDED_THRESHOLD;
  return thumbIndexDistance > OPEN_PINCH_THRESHOLD && thumbExtended;
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

export const detectControlMode = (landmarks: NormalizedLandmark[]): ControlMode => {
  if (!landmarks || landmarks.length === 0) return 'IDLE';
  
  if (isClosePinchGesture(landmarks)) {
    return 'ZOOM_OUT';
  }
  
  if (isOpenPinchGesture(landmarks)) {
    return 'ZOOM_IN';
  }

  if (isIndexPointingUp(landmarks)) {
    return 'PANNING';
  }
  
  return 'IDLE';
};
