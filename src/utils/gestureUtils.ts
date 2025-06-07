import type { NormalizedLandmark } from '@mediapipe/tasks-vision';
import type { ControlMode } from '../types';
import { DEAD_ZONE_CENTER, DEAD_ZONE_RADIUS, PAN_SPEED_AMPLIFIER } from './constants';

export const isIndexPointingUp = (
  landmarks: NormalizedLandmark[],
): boolean => {
  if (!landmarks || landmarks.length === 0) return false;
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
  const indexExtended = idxT.y < idxP.y && idxP.y < idxM.y;
  const yTol = 0.04;
  const middleCurled = midT.y > midP.y - yTol;
  const ringCurled = rngT.y > rngP.y - yTol;
  const pinkyCurled = pkyT.y > pkyP.y - yTol;
  return indexExtended && middleCurled && ringCurled && pinkyCurled;
};

export const isPinchGesture = (landmarks: NormalizedLandmark[]): boolean => {
  return false;
};

export const isOpenPalm = (landmarks: NormalizedLandmark[]): boolean => {
  if (!landmarks || landmarks.length === 0) return false;
  
  const fingerTips = [8, 12, 16, 20];
  const fingerBases = [6, 10, 14, 18];
  
  for (let i = 0; i < fingerTips.length; i++) {
    const tip = landmarks[fingerTips[i]];
    const base = landmarks[fingerBases[i]];
    
    if (!tip || !base) return false;
    
    if (tip.y > base.y) return false;
  }
  
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
  
  // Implement inverted control (natural scrolling)
  // Hand UP (negative Y) -> Map pans DOWN (positive Y)
  // Hand DOWN (positive Y) -> Map pans UP (negative Y)
  const invertedY = -normalizedY;
  
  // Speed is proportional to distance from dead zone edge
  // Since the coordinate system is normalized (0 to 1), 0.5 is the
  // maximum distance you can be from the center (0.5, 0.5) to reach any edge.
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

export const detectControlMode = (landmarks: NormalizedLandmark[]): ControlMode => {
  if (!landmarks || landmarks.length === 0) return 'IDLE';
  
  if (isIndexPointingUp(landmarks)) {
    return 'PANNING';
  }

  if (isPinchGesture(landmarks)) {
    return 'ZOOMING';
  }
  
  return 'IDLE';
};
