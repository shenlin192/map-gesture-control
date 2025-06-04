import type { NormalizedLandmark } from '@mediapipe/tasks-vision';

// I don't know what this is for
export const isIndexPointingCustom = (
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
