import type { NormalizedLandmark } from '@mediapipe/tasks-vision';

/**
 * Calculates the Euclidean distance between two 3D landmarks.
 * @param p1 The first landmark.
 * @param p2 The second landmark.
 * @returns The distance, or Infinity if either landmark is undefined.
 */
export const calculateDistance = (
  p1?: NormalizedLandmark,
  p2?: NormalizedLandmark,
): number => {
  if (!p1 || !p2) return Infinity;
  // The z-coordinate might be undefined, default to 0 if so.
  const z1 = p1.z ?? 0;
  const z2 = p2.z ?? 0;
  return Math.sqrt(
    Math.pow(p1.x - p2.x, 2) +
    Math.pow(p1.y - p2.y, 2) +
    Math.pow(z1 - z2, 2),
  );
};