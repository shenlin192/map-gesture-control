import type { NormalizedLandmark } from '@mediapipe/tasks-vision';
import type { ControlMode } from '../types';

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
